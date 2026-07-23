import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp, normalizeEmail, isValidEmailInput } from '@/lib/rateLimit'

const LOGIN_EMAIL_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 }
const LOGIN_IP_LIMIT = { limit: 20, windowMs: 60 * 60 * 1000 }

export async function POST(request) {
  try {
    const { email } = await request.json()
    if (!isValidEmailInput(email)) {
      return NextResponse.json({ ok: false, error: 'Email is required' }, { status: 400 })
    }

    const ip = getClientIp(request)
    const [emailCheck, ipCheck] = await Promise.all([
      checkRateLimit({ key: `login:email:${normalizeEmail(email)}`, ...LOGIN_EMAIL_LIMIT }),
      checkRateLimit({ key: `login:ip:${ip}`, ...LOGIN_IP_LIMIT }),
    ])

    const blocked = emailCheck.blocked || ipCheck.blocked
    const retryAfterMs = Math.max(
      emailCheck.blocked ? emailCheck.retryAfterMs : 0,
      ipCheck.blocked ? ipCheck.retryAfterMs : 0
    )

    return NextResponse.json({ ok: true, blocked, retryAfterMs })
  } catch (error) {
    console.error('[login-guard]', error)
    // Fail open — a guard-endpoint error must never block a real login attempt.
    return NextResponse.json({ ok: true, blocked: false })
  }
}
