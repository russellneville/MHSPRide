'use client'
import { useAuth } from "@/context/AuthContext";
import { useNetwork } from "@/context/NetworksContext";
import DashboardLayout from "../dashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import DriverProfile from "@/components/forms/DriverProfile";
import ProfileForm, { PROFILE_SECTION_CARD_CLASS } from "@/components/forms/ProfileForm";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/ui/user-avatar";
import { resolveLivePhotoUrl } from "@/lib/profilePhoto";
import { getVehicles } from "@/lib/vehicles";
import BadgesCard from "@/components/BadgesCard";
import AchievementBadge from "@/components/AchievementBadge";
import { badgeById } from "@/lib/badges/catalog";
import { acknowledgeBadge, fetchUnseenBadges } from "@/lib/badges/client";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

export default function ProfilePage (){
    const { user , updateProfile , uploadPhoto, isLoading } = useAuth()
    const { toggleFavoriteDriver } = useNetwork()
    const { theme, setTheme } = useTheme()
    const [themeMounted, setThemeMounted] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [photoSrc, setPhotoSrc] = useState(null)
    const [photoTriedLive, setPhotoTriedLive] = useState(false)
    const [ profile , setProfile ] = useState({
        fullname : '',
        bio : '' ,
        phone : '' ,
      })
    const [badges, setBadges] = useState([])
    const [missedBadges, setMissedBadges] = useState([])
    const [missedDialogOpen, setMissedDialogOpen] = useState(false)

    useEffect(() => {
        if (user) {
          setProfile({ ...user, vehicles: getVehicles(user) });
        }
    }, [user]);

    // users/{uid}/badges (resources/badging.md) — owner-readable per firestore.rules
    useEffect(() => {
        if (!user?.uid) return
        let cancelled = false
        fetchBadgeDocs(user.uid).then((docs) => {
            if (!cancelled) setBadges(docs)
        }).catch((error) => console.error('[profile] badge fetch failed:', error))
        return () => { cancelled = true }
    }, [user?.uid]);

    function fetchBadgeDocs(uid) {
        return getDocs(collection(db, 'users', uid, 'badges')).then(
            (snapshot) => snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        )
    }

    useEffect(() => {
        setPhotoSrc(user?.photoURL || null)
        setPhotoTriedLive(false)
    }, [user?.photoURL]);

    const handlePhotoError = () => {
        if (!photoTriedLive && user?.uid) {
            setPhotoTriedLive(true)
            resolveLivePhotoUrl(user.uid).then(setPhotoSrc)
        } else {
            setPhotoSrc(null)
        }
    }

    useEffect(() => {
        setThemeMounted(true)
    }, []);

    // Badging is opt-out (users/{uid}.hide_badges, off by default), saved
    // immediately on toggle rather than batched into the "Update Profile"
    // button below — same pattern as the theme select and unfavorite buttons
    // on this page. Unchecking replays anything earned while hidden (or any
    // other never-shown badge — see fetchUnseenBadges) as the normal
    // celebration dialog, right here rather than waiting for a dashboard visit.
    const handleToggleHideBadges = async (checked) => {
        if (!user?.uid) return
        try {
            await updateDoc(doc(db, 'users', user.uid), { hide_badges: checked })
        } catch (error) {
            console.error('[profile] hide_badges update failed:', error)
            return
        }
        if (checked) return
        try {
            const unseenIds = await fetchUnseenBadges(user.uid)
            const resolved = unseenIds.map(badgeById).filter(Boolean)
            if (resolved.length) {
                setMissedBadges(resolved)
                setMissedDialogOpen(true)
                // The grid's badges state was fetched on mount and won't
                // otherwise pick up anything earned since — without this,
                // the celebration dialog could show a badge that then isn't
                // in the grid right below it until the page is reloaded.
                fetchBadgeDocs(user.uid).then(setBadges).catch((error) =>
                    console.error('[profile] badge refetch failed:', error)
                )
            }
        } catch (error) {
            console.error('[profile] fetching missed badges failed:', error)
        }
    }

    function handleMissedBadgeAcknowledge(badgeId) {
        acknowledgeBadge(badgeId).catch((error) => console.error('[profile] badge acknowledge failed:', error))
    }

    const handlePhotoChange = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        await uploadPhoto(file)
        setUploading(false)
        e.target.value = ''
    }
    return <>
    <DashboardLayout>
        <div className="flex items-center justify-between py-3">
            <h3 className="text-xl font-semibold py-2">My Profile</h3>
        </div>

        <ProfileForm
            profile={profile}
            setProfile={setProfile}
            displayName={user?.fullname}
            photoSrc={photoSrc}
            onPhotoError={handlePhotoError}
            onPhotoChange={handlePhotoChange}
            uploading={uploading}
        />

       <Card className={`mt-4 ${PROFILE_SECTION_CARD_CLASS}`}>
        <CardHeader className='!pb-3 border-b border-border'>
            <CardTitle>
                Preferences
            </CardTitle>
        </CardHeader>
        <CardContent>
            <div className="flex items-center justify-between gap-4">
                <div>
                    <Label htmlFor="theme-select">Appearance</Label>
                    <p className="text-muted-foreground text-sm">Choose how MHSP Ride looks on this device.</p>
                </div>
                <Select
                    value={themeMounted ? theme : undefined}
                    onValueChange={setTheme}
                    disabled={!themeMounted}
                >
                    <SelectTrigger id="theme-select" className="w-40">
                        <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {user?.favorite_drivers?.length > 0 && (
                <div className="border-t border-border mt-4 pt-4 space-y-3">
                    <Label>⭐️ Favorite Drivers</Label>
                    <div className="space-y-2">
                        {user.favorite_drivers.map(driver => (
                            <div key={driver.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                                <div className="flex items-center gap-3">
                                    <UserAvatar user={driver} size="sm" />
                                    <div>
                                        <p className="text-sm font-medium text-foreground">{driver.fullname || "Unknown"}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {[driver.vehicle_make, driver.vehicle_model].filter(Boolean).join(" ") || "No vehicle listed"}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors shrink-0"
                                    onClick={() => toggleFavoriteDriver(driver)}
                                >
                                    unfavorite
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </CardContent>
       </Card>

       <BadgesCard
            badges={badges}
            hideBadges={!!user?.hide_badges}
            onToggleHide={handleToggleHideBadges}
            className={`mt-4 ${PROFILE_SECTION_CARD_CLASS}`}
       />

       <DriverProfile profile={profile} setProfile={setProfile} className={`mt-4 ${PROFILE_SECTION_CARD_CLASS}`}/>

       <div className="flex items-center justify-end bg-background py-3">
            <Button onClick={()=> updateProfile(profile)} disabled={isLoading}>{isLoading ? 'Updating... ' : 'Update Profile'}</Button>

       </div>

       <AchievementBadge
            open={missedDialogOpen}
            onOpenChange={setMissedDialogOpen}
            badges={missedBadges}
            onAcknowledge={handleMissedBadgeAcknowledge}
       />

    </DashboardLayout>
  </>
}
