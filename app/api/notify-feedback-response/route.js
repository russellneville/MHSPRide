import { NextResponse } from 'next/server'
import { sendFeedbackResponseEmail } from '@/lib/email'
import { verifyAdminRequest } from '@/lib/adminAuth'

export async function POST(request) {
  const auth = await verifyAdminRequest(request)
  if (auth.error) return auth.error

  const { email, name, originalMessage, response } = await request.json()
  if (!email?.trim() || !response?.trim()) {
    return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 })
  }

  try {
    await sendFeedbackResponseEmail({ email: email.trim(), name, originalMessage, response: response.trim() })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[notify-feedback-response]', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
