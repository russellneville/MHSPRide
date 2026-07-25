import { NextResponse } from 'next/server'
import { verifyAuthRequest } from '@/lib/adminAuth'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { sendBookingReceiptEmail, sendBookingNoticeEmail } from '@/lib/email'

// Recipients and content come from the booking/ride docs, never from the
// request body — the caller only supplies which booking to notify about.
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

    let ride_description = ''
    if (booking.ride_id) {
      const rideSnap = await db.collection('rides').doc(booking.ride_id).get()
      if (rideSnap.exists) ride_description = rideSnap.data().ride_description || ''
    }

    const ride = {
      departure: booking.departure,
      arrival: booking.arrival,
      departure_date: booking.departure_date,
      departure_time: booking.departure_time,
      arrival_time: booking.arrival_time || '',
      return_departure_time: booking.return_departure_time || '',
      ride_description,
    }

    const results = await Promise.allSettled([
      sendBookingReceiptEmail({ passenger: booking.passenger, driver: booking.driver, ride, bookedSeats: booking.booked_seats }),
      sendBookingNoticeEmail({ driver: booking.driver, passenger: booking.passenger, ride, bookedSeats: booking.booked_seats }),
    ])

    const labels = ['receipt->passenger', 'notice->driver']
    results.forEach((r, i) => {
      if (r.status === 'rejected') console.error(`[notify-booking] ${labels[i]} failed:`, r.reason)
    })

    const sent = results.filter(r => r.status === 'fulfilled').length
    return NextResponse.json({ ok: true, sent })
  } catch (error) {
    console.error('[notify-booking]', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
