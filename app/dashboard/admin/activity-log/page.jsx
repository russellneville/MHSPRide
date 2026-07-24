'use client'
import { useEffect, useState } from 'react'
import DashboardLayout from '@/app/dashboard/dashboardLayout'
import AdminGuard from '@/components/AdminGuard'
import { db } from '@/lib/firebaseClient'
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
} from 'firebase/firestore'
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
import { Skeleton } from '@/components/ui/skeleton'

const PAGE_SIZE = 25

// Badge color mapping by type prefix
function badgeVariant(type) {
  if (!type) return 'secondary'
  if (type.startsWith('ride.'))     return 'default'        // blue-ish (default)
  if (type.startsWith('booking.'))  return 'outline'        // green not available natively, use outline
  if (type.startsWith('user.'))     return 'secondary'      // purple-ish
  if (type.startsWith('admin.'))    return 'destructive'    // red
  if (type.startsWith('feedback.')) return 'outline'
  if (type.startsWith('membership.')) return 'secondary'
  if (type.startsWith('member.'))   return 'secondary'
  if (type.startsWith('network.'))  return 'default'
  if (type.startsWith('security.')) return 'destructive'
  return 'secondary'
}

const EVENT_TYPES = [
  'admin.password_reset_requested',
  'admin.role_changed',
  'admin.settings_updated',
  'admin.user_suspended',
  'admin.user_unsuspended',
  'booking.canceled',
  'booking.created',
  'feedback.submitted',
  'member.deactivated',
  'member.id_changed',
  'membership.unclaimed',
  'network.created',
  'network.deleted',
  'network.joined',
  'network.member_status_changed',
  'ride.canceled',
  'ride.created',
  'ride.deleted',
  'ride.updated',
  'security.rate_limit_exceeded',
  'security.registration_code_exceeded',
  'user.login',
  'user.login_failed',
  'user.logout',
  'user.password_reset_requested',
  'user.profile_updated',
  'user.registered',
]

export default function AdminActivityLogPage() {
  return (
    <DashboardLayout>
      <AdminGuard>
        <ActivityLogContent />
      </AdminGuard>
    </DashboardLayout>
  )
}

function ActivityLogContent() {
  const [allLogs, setAllLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [filterType, setFilterType] = useState('all')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [messageSearch, setMessageSearch] = useState('')

  useEffect(() => {
    fetchLogs()
    const interval = setInterval(() => fetchLogs({ silent: true }), 30_000)
    return () => clearInterval(interval)
  }, [])

  async function fetchLogs({ silent = false } = {}) {
    if (!silent) setLoading(true)
    try {
      const q = query(collection(db, 'activity_log'), orderBy('timestamp', 'desc'))
      const snap = await getDocs(q)
      setAllLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } finally {
      if (!silent) setLoading(false)
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

  const filtered = allLogs.filter(log => {
    if (filterType !== 'all' && log.type !== filterType) return false
    if (filterFrom || filterTo) {
      let logDate = null
      try { logDate = log.timestamp?.toDate() } catch {}
      if (logDate) {
        if (filterFrom && logDate < new Date(filterFrom + 'T00:00:00')) return false
        if (filterTo && logDate > new Date(filterTo + 'T23:59:59')) return false
      }
    }
    if (userSearch && !(log.userName || '').toLowerCase().includes(userSearch.toLowerCase())) return false
    if (messageSearch && !(log.message || '').toLowerCase().includes(messageSearch.toLowerCase())) return false
    return true
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function resetPage() { setPage(0) }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Activity Log</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={filterType} onValueChange={v => { setFilterType(v); resetPage() }}>
          <SelectTrigger className="w-48 h-9 text-sm">
            <SelectValue placeholder="All event types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All event types</SelectItem>
            {EVENT_TYPES.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          className="w-38 h-9 text-sm"
          value={filterFrom}
          onChange={e => { setFilterFrom(e.target.value); resetPage() }}
        />
        <Input
          type="date"
          className="w-38 h-9 text-sm"
          value={filterTo}
          onChange={e => { setFilterTo(e.target.value); resetPage() }}
        />
        <Input
          placeholder="Search user…"
          className="w-40 h-9 text-sm"
          value={userSearch}
          onChange={e => { setUserSearch(e.target.value); resetPage() }}
        />
        <Input
          placeholder="Search message…"
          className="w-52 h-9 text-sm"
          value={messageSearch}
          onChange={e => { setMessageSearch(e.target.value); resetPage() }}
        />
        {(filterType !== 'all' || filterFrom || filterTo || userSearch || messageSearch) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterType('all'); setFilterFrom(''); setFilterTo(''); setUserSearch(''); setMessageSearch(''); resetPage() }}>
            Clear
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Timestamp</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>MHSP Hex</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No log entries found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm whitespace-nowrap">{formatTs(log.timestamp)}</TableCell>
                      <TableCell>
                        <Badge variant={badgeVariant(log.type)} className="text-xs">
                          {log.type || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{log.userName || '—'}</TableCell>
                      <TableCell className="text-sm font-mono">{log.userMhspHex || '—'}</TableCell>
                      <TableCell className="text-sm max-w-xs truncate">{log.message || '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {filtered.length === 0
                ? 'No entries'
                : `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
