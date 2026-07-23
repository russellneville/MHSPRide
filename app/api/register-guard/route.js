import { NextResponse } from 'next/server'
import { recordAttempt, getClientIp } from '@/lib/rateLimit'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'

const REGISTER_IP_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 }

// Every attempt counts (not just failures) — account-creation spam and
// membership-check enumeration are the concerns here, not credential guessing.
export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const result = await recordAttempt({ key: `register:ip:${ip}`, ...REGISTER_IP_LIMIT })

    if (result.crossedThreshold) {
      await getAdminDb().collection('activity_log').add({
        type: 'security.rate_limit_exceeded',
        message: `Registration rate limit exceeded for IP ${ip}`,
        userId: null,
        userName: null,
        userMhspHex: null,
        metadata: { ip, scope: 'register_ip', limit: result.limit, count: result.count },
        timestamp: FieldValue.serverTimestamp(),
      })
    }

    return NextResponse.json({ ok: true, blocked: result.blocked })
  } catch (error) {
    console.error('[register-guard]', error)
    // Fail open — a guard-endpoint error must never block a real registration attempt.
    return NextResponse.json({ ok: true, blocked: false })
  }
}
