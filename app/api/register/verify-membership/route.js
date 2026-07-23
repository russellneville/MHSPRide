import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { recordAttempt, getClientIp, normalizeEmail, isValidEmailInput } from '@/lib/rateLimit'
import { generateCode, hashCode } from '@/lib/registrationCode'
import { sendRegistrationCodeEmail } from '@/lib/email'

const REGISTER_IP_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 }
const REGISTER_EMAIL_LIMIT = { limit: 3, windowMs: 60 * 60 * 1000 }
const CODE_TTL_MS = 15 * 60 * 1000
const MAX_CODE_ATTEMPTS = 5

const MISMATCH_ERROR = 'The provided information does not match our records. Please check your trooper information and try again.'

function norm(s) {
  return (s || '').toString().trim().toLowerCase()
}

// Every attempt counts (not just mismatches) — account-creation spam and
// membership-check enumeration are the concerns here, not credential guessing.
export async function POST(request) {
  try {
    const { mhspNumber, lastName, troopiterEmail } = await request.json()

    if (!mhspNumber || !String(mhspNumber).trim() || !lastName || !String(lastName).trim() || !isValidEmailInput(troopiterEmail)) {
      return NextResponse.json({ ok: false, error: 'All fields are required.' }, { status: 400 })
    }

    const ip = getClientIp(request)
    const normalizedEmail = normalizeEmail(troopiterEmail)
    const [ipResult, emailResult] = await Promise.all([
      recordAttempt({ key: `register:ip:${ip}`, ...REGISTER_IP_LIMIT }),
      recordAttempt({ key: `register:email:${normalizedEmail}`, ...REGISTER_EMAIL_LIMIT }),
    ])

    if (ipResult.blocked || emailResult.blocked) {
      if (ipResult.crossedThreshold || emailResult.crossedThreshold) {
        await getAdminDb().collection('activity_log').add({
          type: 'security.rate_limit_exceeded',
          message: `Registration rate limit exceeded (${ipResult.blocked ? 'ip' : 'email'}: ${ipResult.blocked ? ip : troopiterEmail})`,
          userId: null,
          userName: null,
          userMhspHex: null,
          metadata: { ip, email: troopiterEmail, scope: 'register_verify_membership' },
          timestamp: FieldValue.serverTimestamp(),
        })
      }
      return NextResponse.json({ ok: false, error: 'Too many registration attempts. Please try again later.' }, { status: 429 })
    }

    const db = getAdminDb()
    const memberId = String(mhspNumber).trim()
    const memberSnap = await db.collection('members').doc(memberId).get()

    if (!memberSnap.exists) {
      return NextResponse.json({ ok: false, error: MISMATCH_ERROR }, { status: 400 })
    }

    const memberData = memberSnap.data()

    if (norm(memberData.lastName) !== norm(lastName) || norm(memberData.email) !== normalizedEmail) {
      return NextResponse.json({ ok: false, error: MISMATCH_ERROR }, { status: 400 })
    }

    if (memberData.claimed) {
      return NextResponse.json({ ok: false, error: 'This membership has already been registered.' }, { status: 400 })
    }

    const code = generateCode()
    const token = randomUUID()

    await db.collection('registration_verifications').doc(token).set({
      mhspNumber: memberId,
      lastName: memberData.lastName,
      email: memberData.email,
      codeHash: hashCode(code),
      attempts: 0,
      maxAttempts: MAX_CODE_ATTEMPTS,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + CODE_TTL_MS),
      verified: false,
      used: false,
    })

    await sendRegistrationCodeEmail({ email: memberData.email, code })

    return NextResponse.json({ ok: true, token })
  } catch (error) {
    console.error('[verify-membership]', error)
    return NextResponse.json({ ok: false, error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
