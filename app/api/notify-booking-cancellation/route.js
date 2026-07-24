import { NextResponse } from 'next/server'
import { verifyAuthRequest } from '@/lib/adminAuth'
import { sendBookingCanceledByPassengerEmail, sendBookingCanceledConfirmationEmail } from '@/lib/email'

export async function POST(request) {
  const auth = await verifyAuthRequest(request)
  if (auth.error) return auth.error

  try {
    const { passenger, driver, ride, bookedSeats } = await request.json()

    const labels = []
    const sends = []
    if (driver?.email) {
      labels.push('cancellation->driver')
      sends.push(sendBookingCanceledByPassengerEmail({ driver, passenger, ride, bookedSeats }))
    }
    if (passenger?.email) {
      labels.push('confirmation->passenger')
      sends.push(sendBookingCanceledConfirmationEmail({ passenger, ride }))
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
