'use client'
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "../dashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@radix-ui/react-label";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    AlertDialog, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getPasswordError, PASSWORD_REQUIREMENT_TEXT } from "@/lib/passwordPolicy";

const SECTION_CARD_CLASS = "bg-muted/45 dark:bg-[oklch(0.39_0_0)]"

export default function SecurityPage() {
    const { user, isLoading, changeEmail, changePassword, resetPassword } = useAuth()

    const [emailValue, setEmailValue] = useState(user?.email || '')
    const [emailError, setEmailError] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmNewPassword, setConfirmNewPassword] = useState('')
    const [passwordError, setPasswordError] = useState('')

    const [pendingAction, setPendingAction] = useState(null) // null | 'email' | 'password'
    const [currentPassword, setCurrentPassword] = useState('')
    const [confirming, setConfirming] = useState(false)

    useEffect(() => {
        if (user) setEmailValue(user.email || '')
    }, [user]);

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

    return <>
    <DashboardLayout>
        <div className="flex items-center justify-between py-3">
            <h3 className="text-xl font-semibold py-2">Security</h3>
        </div>

        <Card className={SECTION_CARD_CLASS}>
            <CardHeader className='!pb-3 border-b border-border'>
                <CardTitle>
                    Email address
                </CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
        </Card>

        <Card className={`mt-4 ${SECTION_CARD_CLASS}`}>
            <CardHeader className='!pb-3 border-b border-border'>
                <CardTitle>
                    Password
                </CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
        </Card>

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
