import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db, auth } from '@/lib/firebaseClient'
import { logEvent } from '@/lib/activityLog'
import { isCanceledStatus } from '@/lib/rides'

// Admin-initiated booking cancellation. Mirrors context/NetworksContext.jsx's
// cancelBooking (the passenger self-cancel path) minus the ownership check,
// so an admin can cancel any passenger's booking from the Rides page.
export async function adminCancelBooking(bookingId, { actor } = {}) {
  const bookingRef = doc(db, 'bookings', bookingId)
  const bookingSnap = await getDoc(bookingRef)
  if (!bookingSnap.exists()) return
  const booking = bookingSnap.data()
  if (isCanceledStatus(booking.booking_status)) return

  await updateDoc(bookingRef, { booking_status: 'canceled' })

  if (booking.ride_id) {
    const rideRef = doc(db, 'rides', booking.ride_id)
    const rideSnap = await getDoc(rideRef)
    if (rideSnap.exists()) {
      const ride = rideSnap.data()
      const updatedPassengers = (ride.passengers || []).map(p =>
        p.booking_id === bookingId ? { ...p, status: 'canceled' } : p
      )
      await updateDoc(rideRef, {
        available_seats: (ride.available_seats || 0) + (booking.booked_seats || 1),
        passengers: updatedPassengers,
      })
    }
  }

  if (booking.passenger?.email) {
    auth.currentUser?.getIdToken().then(token => {
      fetch('/api/notify-cancellation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingId }),
      }).catch(err => console.error('[notify-cancellation]', err))
    }).catch(() => {})
  }

  logEvent({
    type: 'booking.canceled',
    message: `Admin canceled booking: ${booking.departure} → ${booking.arrival} for ${booking.passenger?.fullname || '—'}`,
    userId: auth.currentUser?.uid,
    userName: actor?.fullname,
    mhspNumber: actor?.mhspNumber,
    metadata: { bookingId, rideId: booking.ride_id, adminAction: true },
  }).catch(() => {})
}

// Cancels every non-canceled booking tied to a ride. Used when an admin
// cancels a whole ride, so bookings don't stay stuck at their prior status.
export async function adminCancelRideBookings(ride, bookings, { actor } = {}) {
  const active = (bookings || []).filter(b => !isCanceledStatus(b.booking_status))
  // Sequential, not Promise.all: each call reads-then-writes the same ride's
  // available_seats, so running them concurrently would race and drop updates.
  for (const b of active) {
    await adminCancelBooking(b.id, { actor })
  }
}
