'use client'
import { useEffect, useState } from 'react'
import DashboardLayout from '@/app/dashboard/dashboardLayout'
import AdminGuard from '@/components/AdminGuard'
import { db, auth } from '@/lib/firebaseClient'
import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
} from 'firebase/firestore'
import { logEvent } from '@/lib/activityLog'
import { resolveLocation } from '@/lib/locations'
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

const STATUS_VARIANTS = {
  booked:       'default',
  'on progress':'secondary',
  finished:     'outline',
  canceled:     'destructive',
  cancled:      'destructive',
  declined:     'destructive',
}

export default function AdminBookingsPage() {
  return (
    <DashboardLayout>
      <AdminGuard>
        <BookingsContent />
      </AdminGuard>
    </DashboardLayout>
  )
}

function BookingsContent() {
  const { user: currentUser } = useAuth()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [cancelTarget, setCancelTarget] = useState(null)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    fetchBookings()
  }, [])

  async function fetchBookings() {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'bookings'))
      setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    if (!cancelTarget) return
    setActing(true)
    try {
      const booking = cancelTarget
      await updateDoc(doc(db, 'bookings', booking.id), { booking_status: 'canceled' })

      // Adjust available_seats on the ride
      if (booking.ride_id) {
        try {
          const rideRef = doc(db, 'rides', booking.ride_id)
          const rideSnap = await getDoc(rideRef)
          if (rideSnap.exists()) {
            const rideData = rideSnap.data()
            const newSeats = (rideData.available_seats || 0) + (booking.booked_seats || 1)
            await updateDoc(rideRef, { available_seats: newSeats })
          }
        } catch (e) {
          console.error('[admin cancel booking seats adjust]', e)
        }
      }

      // Notify cancellation (fire-and-forget)
      if (booking.passenger?.email) {
        fetch('/api/notify-cancellation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            passengers: [{ fullname: booking.passenger.fullname || '', email: booking.passenger.email, phone: booking.passenger.phone || '' }],
            ride: {
              departure: booking.departure,
              arrival: booking.arrival,
              departure_date: booking.departure_date,
              departure_time: booking.departure_time || '',
              arrival_time: booking.arrival_time || '',
              return_departure_time: booking.return_departure_time || '',
              ride_description: '',
            },
          }),
        }).catch(err => console.error('[notify-cancellation]', err))
      }

      logEvent({
        type: 'booking.canceled',
        message: `Admin canceled booking: ${booking.departure} → ${booking.arrival} for ${booking.passenger?.fullname || '—'}`,
        userId: auth.currentUser?.uid,
        userName: currentUser?.fullname,
        mhspNumber: currentUser?.mhspNumber,
        metadata: { bookingId: booking.id, rideId: booking.ride_id, adminAction: true },
      }).catch(() => {})

      setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, booking_status: 'canceled' } : b))
    } finally {
      setActing(false)
      setCancelTarget(null)
    }
  }

  const filtered = bookings.filter(b => {
    if (filterStatus && b.booking_status !== filterStatus) return false
    if (filterFrom && b.departure_date < filterFrom) return false
    if (filterTo && b.departure_date > filterTo) return false
    return true
  })

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Bookings</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All statuses</SelectItem>
            <SelectItem value="booked">Booked</SelectItem>
            <SelectItem value="on progress">In Progress</SelectItem>
            <SelectItem value="finished">Finished</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="date"
          className="w-38 h-9 text-sm"
          value={filterFrom}
          onChange={e => setFilterFrom(e.target.value)}
        />
        <Input
          type="date"
          className="w-38 h-9 text-sm"
          value={filterTo}
          onChange={e => setFilterTo(e.target.value)}
        />
        {(filterStatus || filterFrom || filterTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterStatus(''); setFilterFrom(''); setFilterTo('') }}>
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
                <TableHead>Passenger</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Seats</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No bookings found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(booking => (
                  <TableRow key={booking.id}>
                    <TableCell className="text-sm whitespace-nowrap">{booking.departure_date || '—'}</TableCell>
                    <TableCell className="text-sm">{booking.passenger?.fullname || '—'}</TableCell>
                    <TableCell className="text-sm">{booking.driver?.fullname || '—'}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {resolveLocation(booking.departure)} → {resolveLocation(booking.arrival)}
                    </TableCell>
                    <TableCell className="text-sm text-center">{booking.booked_seats || 1}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[booking.booking_status] || 'secondary'}>
                        {booking.booking_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {booking.booking_status !== 'canceled' && booking.booking_status !== 'cancled' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setCancelTarget(booking)}
                        >
                          Cancel
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!cancelTarget} onOpenChange={open => { if (!open) setCancelTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the booking for {cancelTarget?.passenger?.fullname || 'this passenger'} and restore the seat to the ride. A cancellation email will be sent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={acting}>
              {acting ? 'Canceling…' : 'Cancel Booking'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
