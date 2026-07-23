import { NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import { recordAttempt, getClientIp, normalizeEmail, isValidEmailInput } from '@/lib/rateLimit'

const LOGIN_EMAIL_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 }
const LOGIN_IP_LIMIT = { limit: 20, windowMs: 60 * 60 * 1000 }
// This route is public/unauthenticated by necessity (see comment below), which
// means it's itself a target: anyone could POST fake failures for a victim's
// email to trip their login cooldown. This IP limit doesn't eliminate that, but
// bounds the blast radius and gives admins a visible signal if someone's doing it.
const SELF_IP_LIMIT = { limit: 30, windowMs: 60 * 60 * 1000 }

// Logs failed-login attempts. These can't go through the client Firestore SDK:
// unknown-credential failures happen with no authenticated session at all, and
// suspended-account failures are blocked by the same !isSuspended() write rule
// that stops suspended users from writing anywhere else. Admin SDK bypasses both.
export async function POST(request) {
  try {
    const { email, reason } = await request.json()
    if (!isValidEmailInput(email)) return NextResponse.json({ ok: false, error: 'Email is required' }, { status: 400 })

    const token = request.headers.get('authorization')?.replace('Bearer ', '').trim()
    let uid = null
    let userData = {}
    if (token) {
      try {
        const decoded = await getAdminAuth().verifyIdToken(token)
        uid = decoded.uid
        const userSnap = await getAdminDb().collection('users').doc(uid).get()
        if (userSnap.exists) userData = userSnap.data()
      } catch {
        // token invalid/expired — log without identity
      }
    }

    const mhspHex = userData.mhspNumber
      ? parseInt(String(userData.mhspNumber).trim(), 10).toString(16).toUpperCase().padStart(4, '0')
      : null

    await getAdminDb().collection('activity_log').add({
      type: 'user.login_failed',
      message: `Login failed for ${email}: ${reason || 'unknown'}`,
      userId: uid,
      userName: userData.fullname || null,
      userMhspHex: mhspHex,
      metadata: { email, reason: reason || 'unknown' },
      timestamp: FieldValue.serverTimestamp(),
    })

    const ip = getClientIp(request)
    const normalizedEmail = normalizeEmail(email)
    const [emailResult, ipResult, selfResult] = await Promise.all([
      recordAttempt({ key: `login:email:${normalizedEmail}`, ...LOGIN_EMAIL_LIMIT }),
      recordAttempt({ key: `login:ip:${ip}`, ...LOGIN_IP_LIMIT }),
      recordAttempt({ key: `log-event:ip:${ip}`, ...SELF_IP_LIMIT }),
    ])

    const crossings = [
      emailResult.crossedThreshold && { scope: 'login_email', detail: email },
      ipResult.crossedThreshold && { scope: 'login_ip', detail: ip },
      selfResult.crossedThreshold && { scope: 'log_auth_event_ip', detail: ip },
    ].filter(Boolean)

    await Promise.all(crossings.map(c =>
      getAdminDb().collection('activity_log').add({
        type: 'security.rate_limit_exceeded',
        message: `Rate limit exceeded: ${c.scope} (${c.detail})`,
        userId: uid,
        userName: userData.fullname || null,
        userMhspHex: mhspHex,
        metadata: { email, ip, reason: reason || 'unknown', scope: c.scope },
        timestamp: FieldValue.serverTimestamp(),
      })
    ))

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[log-auth-event]', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
