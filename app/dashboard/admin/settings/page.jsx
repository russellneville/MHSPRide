'use client'
import { useEffect, useState } from 'react'
import DashboardLayout from '@/app/dashboard/dashboardLayout'
import SuperAdminGuard from '@/components/SuperAdminGuard'
import { auth, db } from '@/lib/firebaseClient'
import { doc, getDoc, setDoc, collection, onSnapshot } from 'firebase/firestore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { usePopup } from '@/context/PopupContext'
import { logEvent } from '@/lib/activityLog'
import { getMessageStatus } from '@/lib/systemMessages'
import AddSystemMessagePopup from '@/components/popup-forms/AddSystemMessagePopup'
import EditSystemMessagePopup from '@/components/popup-forms/EditSystemMessagePopup'

const STATUS_BADGE = {
  active: 'approved',
  upcoming: 'on progress',
  expired: 'canceled',
}

const SEVERITY_BADGE = {
  info: 'default',
  warning: 'pending',
  urgent: 'destructive',
}

function SystemMessagesSection() {
  const { user: currentUser } = useAuth()
  const { openPopup } = usePopup()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Live subscription (not a one-off fetch) so the list reflects edits/deletes
  // immediately — including ones made from another tab or another admin — without
  // needing a manual refresh after the add/edit popups save.
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'system_messages'),
      snap => {
        const rows = snap.docs
          .map(d => {
            const data = d.data()
            return {
              id: d.id,
              message: data.message,
              severity: data.severity,
              show_on_login: data.show_on_login,
              start_at: data.start_at.toDate(),
              end_at: data.end_at.toDate(),
            }
          })
          .sort((a, b) => b.start_at - a.start_at)
        setMessages(rows)
        setLoading(false)
      },
      err => {
        console.error('[settings/system-messages]', err)
        setLoading(false)
      }
    )
    return unsubscribe
  }, [])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const token = await auth.currentUser.getIdToken()
      const res = await fetch('/api/admin/system-messages/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: deleteTarget.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not delete message')

      logEvent({
        type: 'admin.system_message_deleted',
        message: `System message deleted: "${deleteTarget.message}"`,
        userId: currentUser?.uid,
        userName: currentUser?.fullname,
        mhspNumber: currentUser?.mhspNumber,
        metadata: { messageId: deleteTarget.id },
      }).catch(() => {})

      toast.success('Message deleted')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">System Message Banner</CardTitle>
          <CardDescription>
            Scheduled messages shown at the top of the dashboard (and optionally the login page).
          </CardDescription>
        </div>
        <Button
          size="sm"
          onClick={() => openPopup('Schedule system message', <AddSystemMessagePopup existingMessages={messages} />)}
        >
          Add Message
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4">Loading…</p>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Message</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Login page</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No system messages scheduled.
                    </TableCell>
                  </TableRow>
                ) : (
                  messages.map(m => {
                    const status = getMessageStatus(m.start_at, m.end_at)
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="max-w-xs truncate">{m.message}</TableCell>
                        <TableCell>
                          <Badge variant={SEVERITY_BADGE[m.severity] || 'default'} className="capitalize">{m.severity}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {m.start_at.toLocaleString()} – {m.end_at.toLocaleString()}
                        </TableCell>
                        <TableCell>{m.show_on_login ? 'Yes' : 'No'}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_BADGE[status]} className="capitalize">{status}</Badge>
                        </TableCell>
                        <TableCell className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Edit message"
                            onClick={() => openPopup('Edit system message', (
                              <EditSystemMessagePopup
                                systemMessage={m}
                                existingMessages={messages}
                              />
                            ))}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete message"
                            onClick={() => setDeleteTarget(m)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this system message?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.message}" will stop displaying immediately if it's currently active. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

export default function AdminSettingsPage() {
  const { user } = useAuth()
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
      logEvent({
        type: 'admin.settings_updated',
        message: `Support email updated to ${supportEmail.trim()}`,
        userId: user?.uid,
        userName: user?.fullname,
        mhspNumber: user?.mhspNumber,
        metadata: { support_email: supportEmail.trim() },
      }).catch(() => {})
    } catch (err) {
      console.error('[settings]', err)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SuperAdminGuard>
      <DashboardLayout>
        <h3 className="text-xl font-semibold mb-4">Settings</h3>
        <div className="space-y-6">
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

          <SystemMessagesSection />
        </div>
      </DashboardLayout>
    </SuperAdminGuard>
  )
}
