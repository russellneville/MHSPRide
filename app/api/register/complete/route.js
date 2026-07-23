import { NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import { recordAttempt, getClientIp, isValidEmailInput } from '@/lib/rateLimit'
import { sendRegistrationEmail } from '@/lib/email'

const REGISTER_IP_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 }

function mhspHex(mhspNumber) {
  return mhspNumber
    ? parseInt(String(mhspNumber).trim(), 10).toString(16).toUpperCase().padStart(4, '0')
    : null
}

export async function POST(request) {
  try {
    const { token, email, password, fullname, phone, birthdate } = await request.json()

    if (!token || !isValidEmailInput(email) || !password || password.length < 8 || !fullname?.trim() || !phone?.trim() || !birthdate) {
      return NextResponse.json({ ok: false, error: 'All fields are required.' }, { status: 400 })
    }

    const ip = getClientIp(request)
    const ipResult = await recordAttempt({ key: `register:ip:${ip}`, ...REGISTER_IP_LIMIT })
    if (ipResult.blocked) {
      return NextResponse.json({ ok: false, error: 'Too many registration attempts. Please try again later.' }, { status: 429 })
    }

    const db = getAdminDb()
    const verificationRef = db.collection('registration_verifications').doc(token)
    const verificationSnap = await verificationRef.get()

    if (!verificationSnap.exists) {
      return NextResponse.json({ ok: false, expired: true, error: 'Verification session expired. Please start over.' }, { status: 400 })
    }

    const verification = verificationSnap.data()
    const expired = verification.used || !verification.verified || verification.expiresAt.toMillis() < Date.now()
    if (expired) {
      return NextResponse.json({ ok: false, expired: true, error: 'Verification session expired. Please start over.' }, { status: 400 })
    }

    const memberRef = db.collection('members').doc(verification.mhspNumber)
    const memberSnap = await memberRef.get()

    if (!memberSnap.exists || memberSnap.data().claimed) {
      return NextResponse.json({ ok: false, error: 'This membership has already been registered.' }, { status: 400 })
    }

    const memberData = memberSnap.data()

    let userRecord
    try {
      userRecord = await getAdminAuth().createUser({ email, password, displayName: fullname })
    } catch (error) {
      const message = error.code === 'auth/email-already-exists'
        ? 'An account with this email already exists.'
        : 'Could not create account. Please check your details and try again.'
      return NextResponse.json({ ok: false, error: message }, { status: 400 })
    }

    const uid = userRecord.uid

    await db.collection('users').doc(uid).set({
      email,
      fullname,
      phone,
      birthdate,
      bio: '',
      role: 'member',
      mhspNumber: verification.mhspNumber,
      classifications: memberData.classifications || [],
      latitude: memberData.latitude || null,
      longitude: memberData.longitude || null,
      created_at: FieldValue.serverTimestamp(),
    })

    await memberRef.update({ claimed: true, claimedBy: uid })
    await verificationRef.update({ used: true })

    await db.collection('activity_log').add({
      type: 'user.registered',
      message: `New user registered: ${fullname}`,
      userId: uid,
      userName: fullname,
      userMhspHex: mhspHex(verification.mhspNumber),
      metadata: { email },
      timestamp: FieldValue.serverTimestamp(),
    })

    sendRegistrationEmail({ email, fullname }).catch(err => console.error('[register/complete] welcome email failed', err))

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[register/complete]', error)
    return NextResponse.json({ ok: false, error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
