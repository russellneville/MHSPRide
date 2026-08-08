import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { recordAttempt, getClientIp, normalizeEmail, isValidEmailInput } from '@/lib/rateLimit'
import { generateCode, hashCode } from '@/lib/registrationCode'
import { sendRegistrationCodeEmail } from '@/lib/email'
import { NAME_MAX_LENGTH, MHSP_NUMBER_MAX_LENGTH } from '@/lib/utils'

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

    // Not every org has MHSP-style patrol ID numbers (Armadillo Mountain, the
    // Troopiter integration's rehearsal org, has none) — mhspNumber is optional;
    // when omitted, matching falls back to last name + Troopiter email against
    // a members doc keyed by normalized email instead of a patrol ID.
    if (!lastName || !String(lastName).trim() || !isValidEmailInput(troopiterEmail)) {
      return NextResponse.json({ ok: false, error: 'All fields are required.' }, { status: 400 })
    }
    if (String(mhspNumber || '').trim().length > MHSP_NUMBER_MAX_LENGTH || String(lastName).trim().length > NAME_MAX_LENGTH) {
      return NextResponse.json({ ok: false, error: 'One or more fields exceed the maximum length.' }, { status: 400 })
    }

    const maintenanceSnap = await getAdminDb().collection('config').doc('maintenance').get()
    if (maintenanceSnap.exists && maintenanceSnap.data().enabled) {
      return NextResponse.json({ ok: false, error: 'Registration is currently disabled. MHSP Ride is in maintenance mode.' }, { status: 503 })
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
    const trimmedMhspNumber = String(mhspNumber || '').trim()

    let memberSnap
    if (trimmedMhspNumber) {
      memberSnap = await db.collection('members').doc(trimmedMhspNumber).get()
      if (!memberSnap.exists) {
        return NextResponse.json({ ok: false, error: MISMATCH_ERROR }, { status: 400 })
      }
    } else {
      // No MHSP # given — for orgs like Armadillo Mountain the member doc is
      // keyed by normalized email (see lib/rosterDiff.js), so look it up directly.
      const direct = await db.collection('members').doc(normalizedEmail).get()
      memberSnap = direct.exists ? direct : null
      if (!memberSnap) {
        const query = await db.collection('members').where('email', '==', normalizedEmail).limit(1).get()
        memberSnap = query.empty ? null : query.docs[0]
      }
      if (!memberSnap) {
        return NextResponse.json({ ok: false, error: MISMATCH_ERROR }, { status: 400 })
      }
    }

    const memberData = memberSnap.data()
    const memberId = memberSnap.id

    if (norm(memberData.lastName) !== norm(lastName) || norm(memberData.email) !== normalizedEmail) {
      return NextResponse.json({ ok: false, error: MISMATCH_ERROR }, { status: 400 })
    }

    if (memberData.claimed) {
      return NextResponse.json({ ok: false, error: 'This membership has already been registered.' }, { status: 400 })
    }

    const code = generateCode()
    const token = randomUUID()

    await db.collection('registration_verifications').doc(token).set({
      memberId,
      mhspNumber: memberData.mhspNumber || '',
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

    return NextResponse.json({ ok: true, token, address: memberData.address || '' })
  } catch (error) {
    console.error('[verify-membership]', error)
    return NextResponse.json({ ok: false, error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
