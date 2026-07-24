'use client'
import { useEffect, useState } from 'react'
import DashboardLayout from '@/app/dashboard/dashboardLayout'
import AdminGuard from '@/components/AdminGuard'
import { db, auth } from '@/lib/firebaseClient'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { logEvent } from '@/lib/activityLog'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'sonner'
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
import { Textarea } from '@/components/ui/textarea'
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

const TYPE_VARIANTS = {
  bug: 'destructive',
  feedback: 'default',
  support: 'secondary',
}

export default function AdminFeedbackPage() {
  return (
    <DashboardLayout>
      <AdminGuard>
        <FeedbackContent />
      </AdminGuard>
    </DashboardLayout>
  )
}

function FeedbackContent() {
  const { user: currentUser } = useAuth()
  const [items, setItems] = useState([])
  const [userDirectory, setUserDirectory] = useState({})
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('open')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [acting, setActing] = useState(false)
  const [respondTarget, setRespondTarget] = useState(null)
  const [responseText, setResponseText] = useState('')
  const [responding, setResponding] = useState(false)

  useEffect(() => {
    fetchFeedback()
  }, [])

  async function fetchFeedback() {
    setLoading(true)
    try {
      const [feedbackSnap, usersSnap] = await Promise.all([
        getDocs(query(collection(db, 'feedback'), orderBy('submittedAt', 'desc'))),
        getDocs(collection(db, 'users')),
      ])
      setItems(feedbackSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      const directory = {}
      usersSnap.docs.forEach(d => { directory[d.id] = { fullname: d.data().fullname, email: d.data().email } })
      setUserDirectory(directory)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleResolved(item) {
    const resolved = !item.resolved
    await updateDoc(doc(db, 'feedback', item.id), { resolved })
    logEvent({
      type: 'feedback.submitted',
      message: `Feedback marked ${resolved ? 'resolved' : 'open'}: "${(item.message || '').slice(0, 120)}"`,
      userId: currentUser?.uid,
      userName: currentUser?.fullname,
      mhspNumber: currentUser?.mhspNumber,
      metadata: { feedbackId: item.id, resolved, adminAction: true },
    }).catch(() => {})
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, resolved } : i))
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setActing(true)
    try {
      await deleteDoc(doc(db, 'feedback', deleteTarget.id))
      setItems(prev => prev.filter(i => i.id !== deleteTarget.id))
    } finally {
      setActing(false)
      setDeleteTarget(null)
    }
  }

  function submittedBy(item) {
    if (item.name) return item.email ? `${item.name} (${item.email})` : item.name
    if (item.userId) return userDirectory[item.userId]?.fullname || item.userId
    return '—'
  }

  function recipientEmail(item) {
    if (!item) return null
    return item.email || userDirectory[item.userId]?.email || null
  }

  async function handleRespond() {
    if (!respondTarget || !responseText.trim()) return
    const item = respondTarget
    const text = responseText.trim()
    const email = recipientEmail(item)
    if (!email) {
      toast.error('No email on file for this user')
      return
    }
    setResponding(true)
    try {
      const token = await auth.currentUser.getIdToken()
      const res = await fetch('/api/notify-feedback-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          email,
          name: item.name || userDirectory[item.userId]?.fullname || '',
          originalMessage: item.message,
          response: text,
        }),
      })
      if (!res.ok) throw new Error('Could not send response email')

      const updatedMessage = `${item.message}\nRESPONSE: ${text}`
      await updateDoc(doc(db, 'feedback', item.id), {
        responded: true,
        response: text,
        message: updatedMessage,
        respondedAt: serverTimestamp(),
        respondedBy: currentUser?.uid,
      })
      logEvent({
        type: 'feedback.submitted',
        message: `Responded to feedback from ${item.name || userDirectory[item.userId]?.fullname || email}: "${text.slice(0, 120)}"`,
        userId: currentUser?.uid,
        userName: currentUser?.fullname,
        mhspNumber: currentUser?.mhspNumber,
        metadata: { feedbackId: item.id, adminAction: true },
      }).catch(() => {})

      toast.success('Response sent')
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, responded: true, response: text, message: updatedMessage } : i))
      setRespondTarget(null)
      setResponseText('')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setResponding(false)
    }
  }

  function formatTs(ts) {
    if (!ts) return '—'
    try {
      return new Date(ts.toDate()).toLocaleString()
    } catch {
      return '—'
    }
  }

  const filtered = items.filter(item => {
    if (filterType !== 'all' && item.type !== filterType) return false
    if (filterStatus === 'open' && item.resolved) return false
    if (filterStatus === 'resolved' && !item.resolved) return false
    return true
  })

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Feedback</h2>

      <div className="flex flex-wrap gap-2 items-center">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="feedback">Feedback</SelectItem>
            <SelectItem value="bug">Bug</SelectItem>
            <SelectItem value="support">Support</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
          </SelectContent>
        </Select>
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
                <TableHead className="whitespace-nowrap">Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Submitted By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No feedback found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm whitespace-nowrap">{formatTs(item.submittedAt)}</TableCell>
                    <TableCell>
                      <Badge variant={TYPE_VARIANTS[item.type] || 'secondary'}>{item.type || '—'}</Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-md whitespace-pre-wrap">{item.message || '—'}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{submittedBy(item)}</TableCell>
                    <TableCell>
                      <Badge variant={item.resolved ? 'approved' : 'pending'}>
                        {item.resolved ? 'Resolved' : 'Open'}
                      </Badge>
                    </TableCell>
                    <TableCell className="flex gap-2 items-center">
                      {item.responded ? (
                        <span className="text-sm text-muted-foreground">Responded</span>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => { setRespondTarget(item); setResponseText('') }}>
                          Respond
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => handleToggleResolved(item)}>
                        {item.resolved ? 'Reopen' : 'Resolve'}
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(item)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this feedback?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the entry. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={acting}>
              {acting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!respondTarget} onOpenChange={open => { if (!open && !responding) { setRespondTarget(null); setResponseText('') } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Respond to feedback</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left">
                <p className="text-sm bg-muted rounded p-2 whitespace-pre-wrap">{respondTarget?.message}</p>
                <p>An email with your response will be sent to {recipientEmail(respondTarget) || 'this user'}.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Write your response…"
            value={responseText}
            onChange={e => setResponseText(e.target.value)}
            className="resize-none h-28 text-sm"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={responding}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRespond} disabled={!responseText.trim() || responding}>
              {responding ? 'Sending…' : 'OK'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
