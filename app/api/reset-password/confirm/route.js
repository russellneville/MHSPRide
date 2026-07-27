import { NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import { getPasswordError } from '@/lib/passwordPolicy'

function mhspHex(mhspNumber) {
  return mhspNumber
    ? parseInt(String(mhspNumber).trim(), 10).toString(16).toUpperCase().padStart(4, '0')
    : null
}

export async function POST(request) {
  const { token, newPassword } = await request.json()
  if (!token) {
    return NextResponse.json({ ok: false, expired: true, error: 'This reset link is invalid.' }, { status: 400 })
  }

  const passwordError = getPasswordError(newPassword)
  if (passwordError) {
    return NextResponse.json({ ok: false, error: passwordError }, { status: 400 })
  }

  const db = getAdminDb()
  const tokenRef = db.collection('password_resets').doc(token)
  const tokenSnap = await tokenRef.get()

  const invalidError = { ok: false, expired: true, error: 'This reset link has expired or already been used.' }
  if (!tokenSnap.exists) {
    return NextResponse.json(invalidError, { status: 400 })
  }

  const tokenData = tokenSnap.data()
  if (tokenData.used || tokenData.expiresAt.toMillis() < Date.now()) {
    return NextResponse.json(invalidError, { status: 400 })
  }

  try {
    await getAdminAuth().updateUser(tokenData.uid, { password: newPassword })
  } catch (error) {
    console.error('[reset-password/confirm]', tokenData.email, error.message)
    return NextResponse.json({ ok: false, error: 'Could not reset password. Please try again.' }, { status: 400 })
  }

  await tokenRef.update({ used: true })

  const userSnap = await db.collection('users').doc(tokenData.uid).get()
  const userData = userSnap.data()
  await db.collection('activity_log').add({
    type: 'user.password_reset_completed',
    message: `Password reset completed: ${userData?.fullname || tokenData.email}`,
    userId: tokenData.uid,
    userName: userData?.fullname || null,
    userMhspHex: mhspHex(userData?.mhspNumber),
    metadata: { email: tokenData.email },
    timestamp: FieldValue.serverTimestamp(),
  }).catch(err => console.error('[reset-password/confirm] activity log failed', err))

  return NextResponse.json({ ok: true })
}
