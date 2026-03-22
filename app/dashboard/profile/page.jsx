'use client'
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "../dashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@radix-ui/react-label";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";
import DatePicker from "@/components/ui/date-picker";
import { toLocalDateStr } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import DriverProfile from "@/components/forms/DriverProfile";
import { Button } from "@/components/ui/button";
import DirectorProfile from "@/components/forms/DirectorProfile";
import { Camera, User } from "lucide-react";

export default function ProfilePage (){
    const { user , updateProfile , uploadPhoto, isLoading} = useAuth()
    const [date, setDate] = useState(undefined)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef(null)
    const [ profile , setProfile ] = useState({
        fullname : '', 
        birthdate : '' , 
        bio : '' , 
        phone : '' ,
        email : ''  , 
        password : '' , 
        confirmpassword : '' ,
        roleform : {}
      })

    useEffect(() => {
        if (user) {
          setProfile(user);
        }
        if (user?.roleform){
            setProfile(e => ({...e , roleform : user.roleform}))
        }
    }, [user]);

    
    const handleChange = e =>{
        setProfile(prev => ({...prev , [e.target.id] : e.target.value}))
    }

    const handleDateChange = (selectedDate) => {
        setDate(selectedDate);
        setProfile((prev) => ({
          ...prev,
          birthdate: toLocalDateStr(selectedDate),
        }));
    };

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
        <div className="flex items-center justify-betwee py-3">
            <h3 className="text-xl font-semibold py-2">My Profile</h3>
            
        </div>
       
       <Card>
        <CardHeader className='!pb-3 border-b border-border'>
            <CardTitle>
                Personal information
            </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
            <div className="flex items-center gap-4 pb-2">
                <div className="relative shrink-0">
                    {user?.photoURL ? (
                        <img
                            src={user.photoURL}
                            alt="Profile photo"
                            className="w-16 h-16 rounded-full object-cover border border-border"
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

            <div className="space-y-2 flex items-center gap-2 w-full">
                <div className="w-full mb-0">
                    <Label htmlFor="fullname">Full name</Label>
                    <Input id="fullname" type="text" placeholder={user?.fullname} onChange={handleChange} value={profile.fullname}/>
                </div>
                <div className="w-full">
                    <Label htmlFor="email">Email address</Label>
                    <Input id="email" type="text" placeholder="you@example.com" readOnly disabled onChange={handleChange} value={profile.email}/>
                </div>
            </div>
            
            <div className="space-y-2 flex items-center gap-2 w-full">
                <div className="w-full mb-0">
                    <Label htmlFor="phone">phone number</Label>
                    <Input id="phone" type="text" placeholder={user?.phone} onChange={handleChange} value={profile.phone}/>
                </div>
                <div className="space-y-2 w-full">
                    <Label htmlFor='birthdate'>Date of birth</Label>
                    <DatePicker
                        id="birthdate"
                        date={profile.birthdate ? new Date(profile.birthdate) : undefined}
                        setDate={handleDateChange}
                        />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor='bio'>Bio</Label>
                <Textarea value={profile.bio} id='bio' onChange={handleChange} placeholder='Describe you there' className='resize-none h-45'></Textarea>
            </div>
        </CardContent>
        
       </Card>

       {(user?.role === 'member' || user?.role === 'driver') && <DriverProfile profile={profile} setProfile={setProfile}/>}
       {user?.role === 'admin' && <DirectorProfile profile={profile} setProfile={setProfile}/>}

       <div className="flex items-center justify-end bg-background py-3">
            <Button onClick={()=> updateProfile(profile)} disabled={isLoading}>{isLoading ? 'Updating... ' : 'Update Profile'}</Button>
       
       </div>
       
    </DashboardLayout>
  </> 
}