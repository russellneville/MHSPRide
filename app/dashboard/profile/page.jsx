'use client'
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "../dashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@radix-ui/react-label";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { TEXTAREA_MAX_LENGTH } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import DriverProfile from "@/components/forms/DriverProfile";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, User } from "lucide-react";
import { resolveLivePhotoUrl } from "@/lib/profilePhoto";

const SECTION_CARD_CLASS = "bg-muted/65 dark:bg-[oklch(0.39_0_0)]"

export default function ProfilePage (){
    const { user , updateProfile , uploadPhoto, isLoading } = useAuth()
    const { theme, setTheme } = useTheme()
    const [themeMounted, setThemeMounted] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [photoSrc, setPhotoSrc] = useState(null)
    const [photoTriedLive, setPhotoTriedLive] = useState(false)
    const fileInputRef = useRef(null)
    const [ profile , setProfile ] = useState({
        fullname : '',
        bio : '' ,
        phone : '' ,
      })

    useEffect(() => {
        if (user) {
          setProfile(user);
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


    const handleChange = e =>{
        setProfile(prev => ({...prev , [e.target.id] : e.target.value}))
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

       <Card className={SECTION_CARD_CLASS}>
        <CardHeader className='!pb-3 border-b border-border'>
            <CardTitle>
                Personal information
            </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
            <div className="flex items-center gap-4 pb-2">
                <div className="relative shrink-0">
                    {photoSrc ? (
                        <img
                            src={photoSrc}
                            alt="Profile photo"
                            className="w-16 h-16 rounded-full object-cover border border-border"
                            onError={handlePhotoError}
                        />
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border border-border">
                            <User className="w-7 h-7 text-muted-foreground" />
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
                        title="Change photo"
                    >
                        <Camera className="w-3 h-3" />
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoChange}
                    />
                </div>
                <div>
                    <p className="text-sm font-medium">{user?.fullname}</p>
                    <p className="text-xs text-muted-foreground">{uploading ? 'Uploading…' : 'Click the camera icon to change your photo'}</p>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="fullname">Full name</Label>
                <Input id="fullname" type="text" placeholder={user?.fullname} onChange={handleChange} value={profile.fullname}/>
            </div>

            <div className="space-y-2">
                <Label htmlFor="phone">phone number</Label>
                <Input id="phone" type="text" placeholder={user?.phone} onChange={handleChange} value={profile.phone}/>
            </div>
            <div className="space-y-2">
                <Label htmlFor='bio'>Bio</Label>
                <Textarea value={profile.bio} id='bio' onChange={handleChange} placeholder='Describe you there' className='resize-none h-45' maxLength={TEXTAREA_MAX_LENGTH}></Textarea>
            </div>
        </CardContent>

       </Card>

       <Card className={`mt-4 ${SECTION_CARD_CLASS}`}>
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
        </CardContent>
       </Card>

       <DriverProfile profile={profile} setProfile={setProfile} className={`mt-4 ${SECTION_CARD_CLASS}`}/>

       <div className="flex items-center justify-end bg-background py-3">
            <Button onClick={()=> updateProfile(profile)} disabled={isLoading}>{isLoading ? 'Updating... ' : 'Update Profile'}</Button>

       </div>

    </DashboardLayout>
  </>
}