import { NextResponse } from 'next/server'
import { verifyAuthRequest, isAdminUser } from '@/lib/adminAuth'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { sendCancellationEmail } from '@/lib/email'

// Two callers: a whole ride being canceled (rideId — notify every booked
// passenger from the ride doc) or a single booking being canceled by an
// admin (bookingId — notify just that passenger from the booking doc).
// Recipients and content always come from Firestore, never the request body.
export async function POST(request) {
  const auth = await verifyAuthRequest(request)
  if (auth.error) return auth.error

  try {
    const { rideId, bookingId } = await request.json()
    if (!rideId && !bookingId) {
      return NextResponse.json({ error: 'rideId or bookingId is required' }, { status: 400 })
    }

    const db = getAdminDb()
    let ride
    let passengers

    if (rideId) {
      const rideSnap = await db.collection('rides').doc(rideId).get()
      if (!rideSnap.exists) return NextResponse.json({ ok: true, sent: 0 })
      const rideData = rideSnap.data()

      if (rideData.driverId !== auth.uid && !(await isAdminUser(auth.uid))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      ride = {
        departure: rideData.departure,
        arrival: rideData.arrival,
        departure_date: rideData.departure_date,
        departure_time: rideData.departure_time,
        arrival_time: rideData.arrival_time || '',
        return_departure_time: rideData.return_departure_time || '',
        ride_description: rideData.ride_description || '',
        cancellation_reason: rideData.cancellation_reason || '',
      }
      passengers = (rideData.passengers || [])
        .filter(p => p.email)
        .map(p => ({ fullname: p.fullname || '', email: p.email }))
    } else {
      // Admin-initiated single-booking cancellation
      if (!(await isAdminUser(auth.uid))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const bookingSnap = await db.collection('bookings').doc(bookingId).get()
      if (!bookingSnap.exists) return NextResponse.json({ ok: true, sent: 0 })
      const booking = bookingSnap.data()

      ride = {
        departure: booking.departure,
        arrival: booking.arrival,
        departure_date: booking.departure_date,
        departure_time: booking.departure_time || '',
        arrival_time: booking.arrival_time || '',
        return_departure_time: booking.return_departure_time || '',
        ride_description: '',
      }
      passengers = booking.passenger?.email
        ? [{ fullname: booking.passenger.fullname || '', email: booking.passenger.email }]
        : []
    }

    if (!passengers.length) return NextResponse.json({ ok: true, sent: 0 })

    const results = await Promise.allSettled(
      passengers.map(p => sendCancellationEmail({ passenger: p, ride }))
    )

    results.forEach((r, i) => {
      if (r.status === 'rejected') console.error(`[notify-cancellation] ${passengers[i]?.email} failed:`, r.reason)
    })

    const sent = results.filter(r => r.status === 'fulfilled').length
    return NextResponse.json({ ok: true, sent })
  } catch (error) {
    console.error('[notify-cancellation]', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
