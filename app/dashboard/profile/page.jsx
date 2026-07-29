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

    useEffect(() => {
        if (user) {
          setProfile({ ...user, vehicles: getVehicles(user) });
        }
    }, [user]);

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

       <DriverProfile profile={profile} setProfile={setProfile} className={`mt-4 ${PROFILE_SECTION_CARD_CLASS}`}/>

       <div className="flex items-center justify-end bg-background py-3">
            <Button onClick={()=> updateProfile(profile)} disabled={isLoading}>{isLoading ? 'Updating... ' : 'Update Profile'}</Button>

       </div>

    </DashboardLayout>
  </>
}
