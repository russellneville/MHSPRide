import { NextResponse } from 'next/server'
import { verifyAuthRequest } from '@/lib/adminAuth'
import { sendRegistrationEmail } from '@/lib/email'

export async function POST(request) {
  const auth = await verifyAuthRequest(request)
  if (auth.error) return auth.error

  try {
    const { email, fullname } = await request.json()
    if (!email) return NextResponse.json({ ok: true, sent: 0 })
    await sendRegistrationEmail({ email, fullname })
    return NextResponse.json({ ok: true, sent: 1 })
  } catch (error) {
    console.error('[notify-registration]', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
