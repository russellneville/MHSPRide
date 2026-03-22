'use client'
import { useEffect, useState } from 'react'
import DashboardLayout from '@/app/dashboard/dashboardLayout'
import AdminGuard from '@/components/AdminGuard'
import { db } from '@/lib/firebaseClient'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function AdminSettingsPage() {
  const [supportEmail, setSupportEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getDoc(doc(db, 'config', 'site'))
      .then(snap => {
        if (snap.exists()) setSupportEmail(snap.data().support_email || '')
      })
      .catch(err => console.error('[settings]', err))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await setDoc(doc(db, 'config', 'site'), { support_email: supportEmail.trim() }, { merge: true })
      toast.success('Settings saved')
    } catch (err) {
      console.error('[settings]', err)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminGuard>
      <DashboardLayout>
        <h3 className="text-xl font-semibold mb-4">Settings</h3>
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : (
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="text-base">Contact Form</CardTitle>
              <CardDescription>
                Support requests from the public contact form are emailed here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="support_email">Support email address</Label>
                  <Input
                    id="support_email"
                    type="email"
                    value={supportEmail}
                    onChange={e => setSupportEmail(e.target.value)}
                    placeholder="admin@example.com"
                  />
                </div>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </DashboardLayout>
    </AdminGuard>
  )
}
