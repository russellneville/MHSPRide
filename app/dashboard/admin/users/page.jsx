// See firestore.rules for the security rules this page depends on (admin access, and the
// suspended-user restrictions described there).
'use client'
import { useEffect, useState } from 'react'
import DashboardLayout from '@/app/dashboard/dashboardLayout'
import AdminGuard from '@/components/AdminGuard'
import { db } from '@/lib/firebaseClient'
import { auth } from '@/lib/firebaseClient'
import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
} from 'firebase/firestore'
import { logEvent } from '@/lib/activityLog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'sonner'

function formatDate(val) {
  if (!val) return '—'
  const d = val.seconds ? new Date(val.seconds * 1000) : new Date(val)
  return d.toLocaleDateString()
}

export default function AdminUsersPage() {
  return (
    <DashboardLayout>
      <AdminGuard>
        <UsersContent />
      </AdminGuard>
    </DashboardLayout>
  )
}

function UsersContent() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [resetTarget, setResetTarget] = useState(null) // { uid, mhspNumber, fullname }
  const [resetting, setResetting] = useState(false)
  const [suspendTarget, setSuspendTarget] = useState(null) // { uid, fullname, email, role, suspended }
  const [suspending, setSuspending] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'users'))
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })))
    } finally {
      setLoading(false)
    }
  }

  async function handleRoleChange(uid, newRole, targetUser) {
    await updateDoc(doc(db, 'users', uid), { role: newRole })
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u))
    logEvent({
      type: 'admin.role_changed',
      message: `Role changed for ${targetUser.fullname} to ${newRole}`,
      userId: auth.currentUser?.uid,
      userName: currentUser?.fullname,
      mhspNumber: currentUser?.mhspNumber,
      metadata: { targetUserId: uid, targetUserName: targetUser.fullname, newRole },
    }).catch(() => {})
  }

  async function handleResetMembership() {
    if (!resetTarget) return
    setResetting(true)
    try {
      const { uid, mhspNumber, fullname } = resetTarget
      // Members are keyed by MHSP number as the document ID
      const memberRef = doc(db, 'members', String(mhspNumber).trim())
      const memberSnap = await getDoc(memberRef)
      if (memberSnap.exists()) {
        await updateDoc(memberRef, { claimed: false, claimedBy: null })
      }
      logEvent({
        type: 'membership.unclaimed',
        message: `Membership reset for ${fullname} (MHSP #${mhspNumber})`,
        userId: auth.currentUser?.uid,
        userName: currentUser?.fullname,
        mhspNumber: currentUser?.mhspNumber,
        metadata: { targetUserId: uid, targetMhspNumber: mhspNumber },
      }).catch(() => {})
    } finally {
      setResetting(false)
      setResetTarget(null)
    }
  }

  async function handleSuspendToggle() {
    if (!suspendTarget) return
    setSuspending(true)
    try {
      const { uid, fullname, email, role, suspended } = suspendTarget
      const nextSuspended = !suspended
      const updates = { suspended: nextSuspended }
      if (nextSuspended && role === 'admin') {
        updates.role = 'member'
      }

      await updateDoc(doc(db, 'users', uid), updates)
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, ...updates } : u))

      logEvent({
        type: nextSuspended ? 'admin.user_suspended' : 'admin.user_unsuspended',
        message: `${fullname} ${nextSuspended ? 'suspended' : 'unsuspended'}${updates.role ? ' (demoted from admin)' : ''}`,
        userId: auth.currentUser?.uid,
        userName: currentUser?.fullname,
        mhspNumber: currentUser?.mhspNumber,
        metadata: { targetUserId: uid, targetUserName: fullname },
      }).catch(() => {})

      auth.currentUser.getIdToken().then(token => {
        fetch('/api/admin/notify-suspension', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ email, fullname, suspended: nextSuspended }),
        }).catch(err => console.error('[notify-suspension]', err))
      }).catch(() => {})

      toast.success(`${fullname} ${nextSuspended ? 'suspended' : 'unsuspended'}`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSuspending(false)
      setSuspendTarget(null)
    }
  }

  const filtered = users.filter(u => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (u.fullname || '').toLowerCase().includes(s) ||
      (u.email || '').toLowerCase().includes(s)
    )
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-semibold">Users</h2>
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-64"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>MHSP #</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(u => (
                  <TableRow key={u.uid}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {u.fullname || '—'}
                        {u.suspended && <Badge variant="destructive">Suspended</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email || '—'}</TableCell>
                    <TableCell>{u.mhspNumber || '—'}</TableCell>
                    <TableCell>
                      <Select
                        value={u.role || 'member'}
                        onValueChange={val => handleRoleChange(u.uid, val, u)}
                      >
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">member</SelectItem>
                          <SelectItem value="admin">admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(u.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setResetTarget({ uid: u.uid, mhspNumber: u.mhspNumber, fullname: u.fullname })}
                        >
                          Reset Membership
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const token = await auth.currentUser.getIdToken()
                              const res = await fetch('/api/reset-password', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ email: u.email, adminInitiated: true }),
                              })
                              if (!res.ok) throw new Error('Could not send reset email')
                              toast.success(`Password reset email sent to ${u.email}`)
                              logEvent({
                                type: 'admin.password_reset_requested',
                                message: `Password reset requested for ${u.fullname}`,
                                userId: auth.currentUser?.uid,
                                userName: currentUser?.fullname,
                                mhspNumber: currentUser?.mhspNumber,
                                metadata: { targetUserId: u.uid, targetUserName: u.fullname },
                              }).catch(() => {})
                            } catch (e) {
                              toast.error(e.message)
                            }
                          }}
                        >
                          Reset Password
                        </Button>
                        {u.uid !== currentUser?.uid && (
                          <Button
                            variant="outline"
                            size="sm"
                            className={u.suspended ? '' : 'text-red-600 hover:text-red-600'}
                            onClick={() => setSuspendTarget({
                              uid: u.uid,
                              fullname: u.fullname,
                              email: u.email,
                              role: u.role,
                              suspended: !!u.suspended,
                            })}
                          >
                            {u.suspended ? 'Unsuspend' : 'Suspend'}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!resetTarget} onOpenChange={open => { if (!open) setResetTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset membership for {resetTarget?.fullname}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark MHSP #{resetTarget?.mhspNumber} as unclaimed, allowing another account to register with it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetMembership} disabled={resetting}>
              {resetting ? 'Resetting…' : 'Reset'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!suspendTarget} onOpenChange={open => { if (!open) setSuspendTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {suspendTarget?.suspended
                ? `Unsuspend ${suspendTarget?.fullname}?`
                : suspendTarget?.role === 'admin'
                  ? 'You are suspending an admin'
                  : `Suspend ${suspendTarget?.fullname}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {suspendTarget?.suspended
                ? `${suspendTarget?.fullname} will regain access immediately and be notified by email.`
                : suspendTarget?.role === 'admin'
                  ? `Set this user to a 'member' and suspend them?`
                  : `${suspendTarget?.fullname} will be logged out immediately, unable to log back in, and notified by email.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSuspendToggle} disabled={suspending}>
              {suspending
                ? 'Working…'
                : suspendTarget?.suspended
                  ? 'Unsuspend'
                  : suspendTarget?.role === 'admin'
                    ? 'Demote & Suspend'
                    : 'Suspend'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
