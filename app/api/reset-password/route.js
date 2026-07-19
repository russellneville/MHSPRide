import { NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebaseAdmin'
import { sendPasswordResetEmail } from '@/lib/email'
import { verifyAdminRequest } from '@/lib/adminAuth'

const RESET_REDIRECT_URL = 'https://mhspride.com/login'

export async function POST(request) {
  const { email, adminInitiated } = await request.json()
  if (!email) return NextResponse.json({ ok: false, error: 'Email is required' }, { status: 400 })

  if (adminInitiated) {
    const auth = await verifyAdminRequest(request)
    if (auth.error) return auth.error
  }

  try {
    const link = await getAdminAuth().generatePasswordResetLink(email, { url: RESET_REDIRECT_URL })
    await sendPasswordResetEmail({ email, link, adminInitiated: !!adminInitiated })
  } catch (error) {
    // Don't reveal whether the email has an account — log server-side only.
    console.error('[reset-password]', email, error.message)
  }

  return NextResponse.json({ ok: true })
}
