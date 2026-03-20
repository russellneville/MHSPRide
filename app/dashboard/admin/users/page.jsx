/*
 * FIRESTORE RULES NOTE:
 * The admin pages require the following Firestore security rules additions:
 *
 * match /users/{userId} {
 *   allow read: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
 *   allow write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
 * }
 * match /members/{memberId} {
 *   allow read, write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
 * }
 * match /rides/{rideId} {
 *   allow read, write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
 * }
 * match /bookings/{bookingId} {
 *   allow read, write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
 * }
 * match /activity_log/{logId} {
 *   allow read, write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
 * }
 */
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
  query,
  where,
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
      const membersRef = collection(db, 'members')
      const q = query(membersRef, where('mhspNumber', '==', String(mhspNumber).trim()))
      const snap = await getDocs(q)
      if (!snap.empty) {
        await updateDoc(snap.docs[0].ref, { claimed: false, claimedBy: null })
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
                    <TableCell className="font-medium">{u.fullname || '—'}</TableCell>
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setResetTarget({ uid: u.uid, mhspNumber: u.mhspNumber, fullname: u.fullname })}
                      >
                        Reset Membership
                      </Button>
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
    </div>
  )
}
