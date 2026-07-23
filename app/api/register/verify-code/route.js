import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import { recordAttempt, getClientIp } from '@/lib/rateLimit'
import { hashCode } from '@/lib/registrationCode'

// Secondary defense-in-depth guard on top of the per-token attempt cap below —
// stops someone from hammering many different tokens from one IP.
const CODE_IP_LIMIT = { limit: 20, windowMs: 60 * 60 * 1000 }

function mhspHex(mhspNumber) {
  return mhspNumber
    ? parseInt(String(mhspNumber).trim(), 10).toString(16).toUpperCase().padStart(4, '0')
    : null
}

export async function POST(request) {
  try {
    const { token, code } = await request.json()
    if (!token || !code) {
      return NextResponse.json({ ok: false, error: 'Code is required.' }, { status: 400 })
    }

    const ip = getClientIp(request)
    const ipResult = await recordAttempt({ key: `register:code:ip:${ip}`, ...CODE_IP_LIMIT })
    if (ipResult.blocked) {
      return NextResponse.json({ ok: false, error: 'Too many attempts. Please try again later.' }, { status: 429 })
    }

    const db = getAdminDb()
    const ref = db.collection('registration_verifications').doc(token)
    const snap = await ref.get()

    if (!snap.exists) {
      return NextResponse.json({ ok: false, expired: true, error: 'Verification session expired. Please start over.' })
    }

    const data = snap.data()
    const expired = data.used || data.expiresAt.toMillis() < Date.now()
    if (expired) {
      return NextResponse.json({ ok: false, expired: true, error: 'Verification session expired. Please start over.' })
    }

    if (data.attempts >= data.maxAttempts) {
      return NextResponse.json({ ok: false, locked: true, error: 'Too many incorrect attempts. Please start over.' })
    }

    if (hashCode(code) !== data.codeHash) {
      const attempts = await db.runTransaction(async (tx) => {
        const freshSnap = await tx.get(ref)
        const next = (freshSnap.data().attempts || 0) + 1
        tx.update(ref, { attempts: next })
        return next
      })

      if (attempts >= data.maxAttempts) {
        await db.collection('activity_log').add({
          type: 'security.registration_code_exceeded',
          message: `Registration verification code exceeded max attempts (MHSP #${data.mhspNumber}, ${data.lastName})`,
          userId: null,
          userName: data.lastName,
          userMhspHex: mhspHex(data.mhspNumber),
          metadata: { mhspNumber: data.mhspNumber, lastName: data.lastName, email: data.email, ip },
          timestamp: FieldValue.serverTimestamp(),
        })
        return NextResponse.json({ ok: false, locked: true, error: 'Too many incorrect attempts. Please start over.' })
      }

      return NextResponse.json({ ok: false, error: `Incorrect code. ${data.maxAttempts - attempts} attempt(s) left.` })
    }

    await ref.update({ verified: true })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[verify-code]', error)
    return NextResponse.json({ ok: false, error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
