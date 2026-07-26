import { NextResponse } from 'next/server'
import { verifyAuthRequest } from '@/lib/adminAuth'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { sendBookingCanceledByPassengerEmail, sendBookingCanceledConfirmationEmail } from '@/lib/email'

// Recipients and content come from the booking doc, never from the request
// body — the caller only supplies which booking to notify about.
export async function POST(request) {
  const auth = await verifyAuthRequest(request)
  if (auth.error) return auth.error

  try {
    const { bookingId } = await request.json()
    if (!bookingId) return NextResponse.json({ error: 'bookingId is required' }, { status: 400 })

    const db = getAdminDb()
    const bookingSnap = await db.collection('bookings').doc(bookingId).get()
    if (!bookingSnap.exists) return NextResponse.json({ ok: true, sent: 0 })

    const booking = bookingSnap.data()
    if (auth.uid !== booking.passengerId && auth.uid !== booking.driverId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const ride = {
      departure: booking.departure,
      arrival: booking.arrival,
      departure_date: booking.departure_date,
      departure_time: booking.departure_time,
      arrival_time: booking.arrival_time || '',
      return_departure_time: booking.return_departure_time || '',
    }

    const reason = booking.cancellation_reason || ''

    const labels = []
    const sends = []
    if (booking.driver?.email) {
      labels.push('cancellation->driver')
      sends.push(sendBookingCanceledByPassengerEmail({ driver: booking.driver, passenger: booking.passenger, ride, bookedSeats: booking.booked_seats, reason }))
    }
    if (booking.passenger?.email) {
      labels.push('confirmation->passenger')
      sends.push(sendBookingCanceledConfirmationEmail({ passenger: booking.passenger, ride, reason }))
    }

    const results = await Promise.allSettled(sends)
    results.forEach((r, i) => {
      if (r.status === 'rejected') console.error(`[notify-booking-cancellation] ${labels[i]} failed:`, r.reason)
    })

    const sent = results.filter(r => r.status === 'fulfilled').length
    return NextResponse.json({ ok: true, sent })
  } catch (error) {
    console.error('[notify-booking-cancellation]', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
