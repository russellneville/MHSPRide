import { NextResponse } from 'next/server'
import { verifyAuthRequest } from '@/lib/adminAuth'
import { sendCancellationEmail } from '@/lib/email'

export async function POST(request) {
  const auth = await verifyAuthRequest(request)
  if (auth.error) return auth.error

  try {
    const { passengers, ride } = await request.json()
    if (!passengers?.length) return NextResponse.json({ ok: true, sent: 0 })

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
