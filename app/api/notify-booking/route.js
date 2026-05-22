import { NextResponse } from 'next/server'
import { verifyAuthRequest } from '@/lib/adminAuth'
import { sendBookingReceiptEmail, sendBookingNoticeEmail } from '@/lib/email'

export async function POST(request) {
  const auth = await verifyAuthRequest(request)
  if (auth.error) return auth.error

  try {
    const { passenger, driver, ride, bookedSeats } = await request.json()

    const results = await Promise.allSettled([
      sendBookingReceiptEmail({ passenger, driver, ride, bookedSeats }),
      sendBookingNoticeEmail({ driver, passenger, ride, bookedSeats }),
    ])

    const sent = results.filter(r => r.status === 'fulfilled').length
    return NextResponse.json({ ok: true, sent })
  } catch (error) {
    console.error('[notify-booking]', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
