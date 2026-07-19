import { NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/adminAuth'
import { sendSuspensionEmail, sendReinstatementEmail } from '@/lib/email'

export async function POST(request) {
  const auth = await verifyAdminRequest(request)
  if (auth.error) return auth.error

  try {
    const { email, fullname, suspended } = await request.json()
    if (!email) return NextResponse.json({ ok: false, error: 'Email is required' }, { status: 400 })

    if (suspended) {
      await sendSuspensionEmail({ email, fullname })
    } else {
      await sendReinstatementEmail({ email, fullname })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[notify-suspension]', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
