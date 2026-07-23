import { NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import { sendPasswordResetEmail } from '@/lib/email'
import { verifyAdminRequest } from '@/lib/adminAuth'
import { recordAttempt, getClientIp, normalizeEmail, isValidEmailInput } from '@/lib/rateLimit'

const RESET_REDIRECT_URL = 'https://mhspride.com/login'
const RESET_EMAIL_LIMIT = { limit: 3, windowMs: 60 * 60 * 1000 }
const RESET_IP_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 }

export async function POST(request) {
  const { email, adminInitiated } = await request.json()
  if (!isValidEmailInput(email)) return NextResponse.json({ ok: false, error: 'Email is required' }, { status: 400 })

  if (adminInitiated) {
    const auth = await verifyAdminRequest(request)
    if (auth.error) return auth.error
  } else {
    // Rate limit only applies to the self-service path — admin-initiated resets
    // are already authenticated and logged separately as admin.password_reset_requested.
    const ip = getClientIp(request)
    const normalizedEmail = normalizeEmail(email)
    const [emailResult, ipResult] = await Promise.all([
      recordAttempt({ key: `reset:email:${normalizedEmail}`, ...RESET_EMAIL_LIMIT }),
      recordAttempt({ key: `reset:ip:${ip}`, ...RESET_IP_LIMIT }),
    ])

    if (emailResult.blocked || ipResult.blocked) {
      if (emailResult.crossedThreshold || ipResult.crossedThreshold) {
        await getAdminDb().collection('activity_log').add({
          type: 'security.rate_limit_exceeded',
          message: `Password reset rate limit exceeded (${emailResult.blocked ? 'email' : 'ip'}: ${emailResult.blocked ? email : ip})`,
          userId: null,
          userName: null,
          userMhspHex: null,
          metadata: { email, ip, scope: 'password_reset' },
          timestamp: FieldValue.serverTimestamp(),
        })
      }
      return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 })
    }
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
