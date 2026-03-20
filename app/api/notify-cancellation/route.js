import { NextResponse } from 'next/server'
import { sendCancellationEmail } from '@/lib/email'

export async function POST(request) {
  try {
    const { passengers, ride } = await request.json()
    if (!passengers?.length) return NextResponse.json({ ok: true, sent: 0 })

    const results = await Promise.allSettled(
      passengers.map(p => sendCancellationEmail({ passenger: p, ride }))
    )

    const sent = results.filter(r => r.status === 'fulfilled').length
    return NextResponse.json({ ok: true, sent })
  } catch (error) {
    console.error('[notify-cancellation]', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
