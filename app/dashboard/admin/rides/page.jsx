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

const KNOWN_NETWORKS = [
  { id: 'network-HILLPATROL',    name: 'Hill Patrol' },
  { id: 'network-MOUNTAINHOSTS', name: 'Mountain Hosts' },
  { id: 'network-NORDIC',        name: 'Nordic' },
]

const STATUS_VARIANTS = {
  'not started': 'secondary',
  'on progress': 'default',
  'finished':    'outline',
  'canceled':    'destructive',
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
  const [filterStatus, setFilterStatus] = useState('')
  const [filterNetwork, setFilterNetwork] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [cancelTarget, setCancelTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [acting, setActing] = useState(false)

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
        fetch('/api/notify-cancellation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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

  const filtered = rides.filter(r => {
    if (filterStatus && r.ride_status !== filterStatus) return false
    if (filterNetwork && r.network_id !== filterNetwork) return false
    if (filterFrom && r.departure_date < filterFrom) return false
    if (filterTo && r.departure_date > filterTo) return false
    return true
  })

  const networkName = (id) => KNOWN_NETWORKS.find(n => n.id === id)?.name || id || '—'

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Rides</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All statuses</SelectItem>
            <SelectItem value="not started">Not Started</SelectItem>
            <SelectItem value="on progress">In Progress</SelectItem>
            <SelectItem value="finished">Finished</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterNetwork} onValueChange={setFilterNetwork}>
          <SelectTrigger className="w-40 h-9 text-sm">
            <SelectValue placeholder="All networks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All networks</SelectItem>
            {KNOWN_NETWORKS.map(n => (
              <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          className="w-38 h-9 text-sm"
          value={filterFrom}
          onChange={e => setFilterFrom(e.target.value)}
          placeholder="From date"
        />
        <Input
          type="date"
          className="w-38 h-9 text-sm"
          value={filterTo}
          onChange={e => setFilterTo(e.target.value)}
          placeholder="To date"
        />
        {(filterStatus || filterNetwork || filterFrom || filterTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterStatus(''); setFilterNetwork(''); setFilterFrom(''); setFilterTo('') }}>
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
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No rides found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(ride => {
                  const isEmpty = ride.available_seats === ride.total_seats
                  return (
                    <TableRow key={ride.id}>
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
                        <Badge variant={STATUS_VARIANTS[ride.ride_status] || 'secondary'}>
                          {ride.ride_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPopup('Edit ride', <EditRidePopup ride={ride} onSaved={fetchRides} />)}
                          >
                            Edit
                          </Button>
                          {ride.ride_status !== 'canceled' && (
                            <Button
                              variant="destructive"
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
