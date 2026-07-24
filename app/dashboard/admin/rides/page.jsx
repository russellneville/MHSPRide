'use client'
import { useEffect, useState } from 'react'
import DashboardLayout from '@/app/dashboard/dashboardLayout'
import AdminGuard from '@/components/AdminGuard'
import { db, auth } from '@/lib/firebaseClient'
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore'
import { logEvent } from '@/lib/activityLog'
import { computeRideStatus } from '@/lib/rides'
import { resolveLocation } from '@/lib/locations'
import { formatTime, toLocalDateStr } from '@/lib/utils'
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
import { usePopup } from '@/context/PopupContext'
import EditRidePopup from '@/components/popup-forms/EditRidePopup'
import AdminRideDetailsPopup from '@/components/popup-forms/AdminRideDetailsPopup'

const PAGE_SIZE = 25

const KNOWN_NETWORKS = [
  { id: 'network-HILLPATROL',    name: 'Hill Patrol' },
  { id: 'network-MOUNTAINHOSTS', name: 'Mountain Hosts' },
  { id: 'network-NORDIC',        name: 'Nordic' },
]

const STATUS_VARIANTS = {
  'not started': 'secondary',
  'in progress': 'default',
  'finished':    'outline',
  'canceled':    'destructive',
}

// Maps the time-derived computeRideStatus() result onto the admin page's display labels.
// Status is computed from ride timing rather than the stored ride_status field, since
// that field only updates when a driver manually clicks Start/Finish and often never does.
const DISPLAY_STATUS = {
  open:        'not started',
  full:        'not started',
  in_progress: 'in progress',
  completed:   'finished',
  canceled:    'canceled',
}

function displayStatus(ride) {
  return DISPLAY_STATUS[computeRideStatus(ride)]
}

export default function AdminRidesPage() {
  return (
    <DashboardLayout>
      <AdminGuard>
        <RidesContent />
      </AdminGuard>
    </DashboardLayout>
  )
}

function RidesContent() {
  const { user: currentUser } = useAuth()
  const { openPopup } = usePopup()
  const [rides, setRides] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterNetwork, setFilterNetwork] = useState('all')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [cancelTarget, setCancelTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [acting, setActing] = useState(false)

  function resetPage() { setPage(0) }

  useEffect(() => {
    fetchRides()
  }, [])

  async function fetchRides() {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'rides'))
      setRides(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    if (!cancelTarget) return
    setActing(true)
    try {
      const ride = cancelTarget
      await updateDoc(doc(db, 'rides', ride.id), { ride_status: 'canceled' })

      // Notify passengers
      const passengersWithEmail = (ride.passengers || []).filter(p => p.email)
      if (passengersWithEmail.length > 0) {
        auth.currentUser?.getIdToken().then(token => {
          fetch('/api/notify-cancellation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              passengers: passengersWithEmail.map(p => ({
                fullname: p.fullname || '',
                email: p.email,
                phone: p.phone || '',
              })),
              ride: {
                departure: ride.departure,
                arrival: ride.arrival,
                departure_date: ride.departure_date,
                departure_time: ride.departure_time,
                arrival_time: ride.arrival_time || '',
                return_departure_time: ride.return_departure_time || '',
                ride_description: ride.ride_description || '',
              },
            }),
          }).catch(err => console.error('[notify-cancellation]', err))
        }).catch(() => {})
      }

      logEvent({
        type: 'ride.canceled',
        message: `Admin canceled ride: ${ride.departure} → ${ride.arrival} on ${ride.departure_date}`,
        userId: auth.currentUser?.uid,
        userName: currentUser?.fullname,
        mhspNumber: currentUser?.mhspNumber,
        metadata: { rideId: ride.id, adminAction: true },
      }).catch(() => {})

      setRides(prev => prev.map(r => r.id === ride.id ? { ...r, ride_status: 'canceled' } : r))
    } finally {
      setActing(false)
      setCancelTarget(null)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setActing(true)
    try {
      const ride = deleteTarget
      await deleteDoc(doc(db, 'rides', ride.id))
      logEvent({
        type: 'ride.deleted',
        message: `Admin deleted ride: ${ride.departure} → ${ride.arrival} on ${ride.departure_date}`,
        userId: auth.currentUser?.uid,
        userName: currentUser?.fullname,
        mhspNumber: currentUser?.mhspNumber,
        metadata: { rideId: ride.id, adminAction: true },
      }).catch(() => {})
      setRides(prev => prev.filter(r => r.id !== ride.id))
    } finally {
      setActing(false)
      setDeleteTarget(null)
    }
  }

  const filtered = rides
    .filter(r => {
      if (filterStatus !== 'all' && displayStatus(r) !== filterStatus) return false
      if (filterNetwork !== 'all' && r.network_id !== filterNetwork) return false
      if (filterFrom && r.departure_date < filterFrom) return false
      if (filterTo && r.departure_date > filterTo) return false
      return true
    })
    .sort((a, b) => {
      const aKey = `${a.departure_date}T${a.departure_time || '00:00'}`
      const bKey = `${b.departure_date}T${b.departure_time || '00:00'}`
      return bKey.localeCompare(aKey)
    })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const networkName = (id) => KNOWN_NETWORKS.find(n => n.id === id)?.name || id || '—'

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Rides</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); resetPage() }}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="not started">Not Started</SelectItem>
            <SelectItem value="in progress">In Progress</SelectItem>
            <SelectItem value="finished">Finished</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterNetwork} onValueChange={v => { setFilterNetwork(v); resetPage() }}>
          <SelectTrigger className="w-40 h-9 text-sm">
            <SelectValue placeholder="All networks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All networks</SelectItem>
            {KNOWN_NETWORKS.map(n => (
              <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          className="w-38 h-9 text-sm"
          value={filterFrom}
          onChange={e => { setFilterFrom(e.target.value); resetPage() }}
          placeholder="From date"
        />
        <Input
          type="date"
          className="w-38 h-9 text-sm"
          value={filterTo}
          onChange={e => { setFilterTo(e.target.value); resetPage() }}
          placeholder="To date"
        />
        {(filterStatus !== 'all' || filterNetwork !== 'all' || filterFrom || filterTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterStatus('all'); setFilterNetwork('all'); setFilterFrom(''); setFilterTo(''); resetPage() }}>
            Clear
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Network</TableHead>
                <TableHead>Departure</TableHead>
                <TableHead>Arrival</TableHead>
                <TableHead>Seats</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No rides found.
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map(ride => {
                  const isEmpty = ride.available_seats === ride.total_seats
                  const status = displayStatus(ride)
                  return (
                    <TableRow
                      key={ride.id}
                      className="cursor-pointer"
                      onClick={() => openPopup(
                        'Ride details',
                        <AdminRideDetailsPopup ride={ride} status={status} networkName={networkName(ride.network_id)} />
                      )}
                    >
                      <TableCell className="text-sm whitespace-nowrap">
                        {ride.departure_date}<br />
                        <span className="text-muted-foreground">{formatTime(ride.departure_time)}</span>
                      </TableCell>
                      <TableCell className="text-sm">{ride.driver?.fullname || '—'}</TableCell>
                      <TableCell className="text-sm">{networkName(ride.network_id)}</TableCell>
                      <TableCell className="text-sm">{resolveLocation(ride.departure)}</TableCell>
                      <TableCell className="text-sm">{resolveLocation(ride.arrival)}</TableCell>
                      <TableCell className="text-sm text-center">
                        {ride.available_seats}/{ride.total_seats}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[status] || 'secondary'}>
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPopup('Edit ride', <EditRidePopup ride={ride} onSaved={fetchRides} />)}
                          >
                            Edit
                          </Button>
                          {status !== 'canceled' && (
                            <Button
                              variant="cancel"
                              size="sm"
                              onClick={() => setCancelTarget(ride)}
                            >
                              Cancel
                            </Button>
                          )}
                          {isEmpty && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(ride)}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {filtered.length === 0
              ? 'No rides'
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

      {/* Cancel dialog */}
      <AlertDialog open={!!cancelTarget} onOpenChange={open => { if (!open) setCancelTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this ride?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the ride as canceled and notify any booked passengers by email. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={acting}>
              {acting ? 'Canceling…' : 'Cancel Ride'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this ride?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the ride record. Only rides with no bookings can be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={acting}>
              {acting ? 'Deleting…' : 'Delete Ride'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
