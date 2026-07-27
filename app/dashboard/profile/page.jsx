'use client'
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "../dashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@radix-ui/react-label";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";
import DatePicker from "@/components/ui/date-picker";
import { toLocalDateStr, TEXTAREA_MAX_LENGTH } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import DriverProfile from "@/components/forms/DriverProfile";
import { Button } from "@/components/ui/button";
import { Camera, User } from "lucide-react";
import {
    AlertDialog, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getPasswordError, PASSWORD_REQUIREMENT_TEXT } from "@/lib/passwordPolicy";

export default function ProfilePage (){
    const { user , updateProfile , uploadPhoto, isLoading, changeEmail, changePassword, resetPassword } = useAuth()
    const [date, setDate] = useState(undefined)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef(null)
    const [ profile , setProfile ] = useState({
        fullname : '',
        birthdate : '' ,
        bio : '' ,
        phone : '' ,
      })

    const [emailValue, setEmailValue] = useState('')
    const [emailError, setEmailError] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmNewPassword, setConfirmNewPassword] = useState('')
    const [passwordError, setPasswordError] = useState('')

    const [pendingAction, setPendingAction] = useState(null) // null | 'email' | 'password'
    const [currentPassword, setCurrentPassword] = useState('')
    const [confirming, setConfirming] = useState(false)

    useEffect(() => {
        if (user) {
          setProfile(user);
          setEmailValue(user.email || '')
        }
    }, [user]);


    const handleChange = e =>{
        setProfile(prev => ({...prev , [e.target.id] : e.target.value}))
    }

    function handleEmailSaveClick() {
        const trimmed = emailValue.trim()
        if (!trimmed || !/^\S+@\S+\.\S+$/.test(trimmed)) {
            setEmailError('Enter a valid email address')
            return
        }
        if (trimmed === user?.email) {
            setEmailError('This is already your email address')
            return
        }
        setEmailError('')
        setCurrentPassword('')
        setPendingAction('email')
    }

    function handlePasswordSaveClick() {
        const validationError = getPasswordError(newPassword)
        if (validationError) {
            setPasswordError(validationError)
            return
        }
        if (newPassword !== confirmNewPassword) {
            setPasswordError('Passwords do not match')
            return
        }
        setPasswordError('')
        setCurrentPassword('')
        setPendingAction('password')
    }

    async function handleConfirmPending() {
        if (!currentPassword.trim()) return
        setConfirming(true)
        try {
            const result = pendingAction === 'email'
                ? await changeEmail(currentPassword, emailValue.trim())
                : await changePassword(currentPassword, newPassword)
            if (result.ok) {
                setPendingAction(null)
                setCurrentPassword('')
                if (pendingAction === 'password') {
                    setNewPassword('')
                    setConfirmNewPassword('')
                }
            }
        } finally {
            setConfirming(false)
        }
    }

    function handleForgotPassword() {
        if (user?.email) resetPassword(user.email)
        setPendingAction(null)
        setCurrentPassword('')
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

            <div className="space-y-2">
                <Label htmlFor="fullname">Full name</Label>
                <Input id="fullname" type="text" placeholder={user?.fullname} onChange={handleChange} value={profile.fullname}/>
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
                        date={profile.birthdate ? new Date(profile.birthdate + 'T12:00:00') : undefined}
                        setDate={handleDateChange}
                        />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor='bio'>Bio</Label>
                <Textarea value={profile.bio} id='bio' onChange={handleChange} placeholder='Describe you there' className='resize-none h-45' maxLength={TEXTAREA_MAX_LENGTH}></Textarea>
            </div>
        </CardContent>

       </Card>

       <Card className="mt-4">
        <CardHeader className='!pb-3 border-b border-border'>
            <CardTitle>
                Account &amp; Security
            </CardTitle>
        </CardHeader>
        <CardContent className='space-y-6'>
            <div className="space-y-2">
                <Label htmlFor="emailValue">Email address</Label>
                <div className="flex items-start gap-2">
                    <div className="w-full">
                        <Input
                            id="emailValue"
                            type="email"
                            placeholder="you@example.com"
                            value={emailValue}
                            onChange={e => { setEmailValue(e.target.value); setEmailError('') }}
                        />
                        {emailError && <p className="text-red-500 text-sm mt-1">{emailError}</p>}
                    </div>
                    <Button variant="outline" onClick={handleEmailSaveClick} disabled={isLoading}>
                        Update Email
                    </Button>
                </div>
            </div>

            <div className="space-y-2 border-t border-border pt-4">
                <div className="flex items-start gap-2">
                    <div className="w-full space-y-2">
                        <div>
                            <Label htmlFor="newPassword">New password</Label>
                            <Input
                                id="newPassword"
                                type="password"
                                placeholder="*********"
                                value={newPassword}
                                onChange={e => { setNewPassword(e.target.value); setPasswordError('') }}
                            />
                            {!passwordError && <p className="text-muted-foreground text-sm">{PASSWORD_REQUIREMENT_TEXT}</p>}
                        </div>
                        <div>
                            <Label htmlFor="confirmNewPassword">Confirm new password</Label>
                            <Input
                                id="confirmNewPassword"
                                type="password"
                                placeholder="*********"
                                value={confirmNewPassword}
                                onChange={e => { setConfirmNewPassword(e.target.value); setPasswordError('') }}
                            />
                        </div>
                        {passwordError && <p className="text-red-500 text-sm">{passwordError}</p>}
                    </div>
                    <Button variant="outline" onClick={handlePasswordSaveClick} disabled={isLoading} className="mt-6">
                        Update Password
                    </Button>
                </div>
            </div>
        </CardContent>
       </Card>

       <DriverProfile profile={profile} setProfile={setProfile}/>

       <div className="flex items-center justify-end bg-background py-3">
            <Button onClick={()=> updateProfile(profile)} disabled={isLoading}>{isLoading ? 'Updating... ' : 'Update Profile'}</Button>

       </div>

       <AlertDialog open={!!pendingAction} onOpenChange={open => { if (!open) { setPendingAction(null); setCurrentPassword('') } }}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Confirm your password</AlertDialogTitle>
                <AlertDialogDescription>
                    Enter your current password to {pendingAction === 'email' ? 'update your email address' : 'update your password'}.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                    id="currentPassword"
                    type="password"
                    placeholder="*********"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                />
                <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                    Forgot password?
                </button>
            </div>
            <AlertDialogFooter>
                <Button variant="outline" onClick={() => { setPendingAction(null); setCurrentPassword('') }} disabled={confirming}>
                    Cancel
                </Button>
                <Button onClick={handleConfirmPending} disabled={confirming || !currentPassword.trim()}>
                    {confirming ? 'Confirming...' : 'Confirm'}
                </Button>
            </AlertDialogFooter>
        </AlertDialogContent>
       </AlertDialog>

    </DashboardLayout>
  </>
}