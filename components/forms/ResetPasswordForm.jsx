'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { getPasswordError, PASSWORD_REQUIREMENT_TEXT } from "@/lib/passwordPolicy";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState(token ? 'ready' : 'invalid') // ready | invalid | done
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const passwordError = getPasswordError(password)
    if (passwordError) {
      setError(passwordError)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/reset-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      })
      const data = await res.json()
      if (!data.ok) {
        if (data.expired) setStatus('invalid')
        else setError(data.error || 'Could not reset password. Please try again.')
        return
      }
      setStatus('done')
    } catch (err) {
      setError('Could not reset password. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const cardDescription = status === 'done'
    ? 'Your password has been updated.'
    : status === 'invalid'
      ? 'This reset link is no longer valid.'
      : 'Choose a new password for your account.'

  return (
    <div className="min-h-screen flex items-center justify-center px-6 md:px-16 lg:px-20 py-10">
      <Card className="w-full max-w-md shadow-lg border border-border">
        <CardHeader className="flex flex-col items-center gap-3 text-center">
          <div className="flex justify-center">
            <Image
              className="rounded-xl border-2 border-slate-900"
              src="/assets/mhspride_logo.png"
              alt="logo"
              height={130}
              width={164}
            />
          </div>
          <CardTitle className="text-2xl font-semibold">Reset Password</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {cardDescription}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {status === 'invalid' && (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">
                Request a new reset link from the login page and try again.
              </p>
              <Link href="/login" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
                Back to login
              </Link>
            </div>
          )}

          {status === 'done' && (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">
                You can now log in with your new password.
              </p>
              <Link href="/login" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
                Go to login
              </Link>
            </div>
          )}

          {status === 'ready' && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="*********"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                />
                {!error && <p className="text-muted-foreground text-sm">{PASSWORD_REQUIREMENT_TEXT}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="*********"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError('') }}
                />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="text-sm text-center text-muted-foreground">
          Remembered your password?{" "}
          <Link href="/login" className="ml-1 text-blue-600 hover:underline dark:text-blue-400">
            Log in
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
