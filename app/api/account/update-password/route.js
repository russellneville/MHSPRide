import { NextResponse } from 'next/server'
import { verifyAuthRequest, verifyCurrentPassword } from '@/lib/adminAuth'
import { getAdminAuth } from '@/lib/firebaseAdmin'
import { getPasswordError } from '@/lib/passwordPolicy'

// Goes through the Admin SDK. A valid ID token alone only proves an active session, not
// that the caller just reauthenticated — the client-side reauth is a UX nicety a stolen
// token would skip entirely, so currentPassword is independently verified here first.
export async function POST(request) {
  const auth = await verifyAuthRequest(request)
  if (auth.error) return auth.error

  const { newPassword, currentPassword } = await request.json()

  const passwordError = getPasswordError(newPassword)
  if (passwordError) {
    return NextResponse.json({ ok: false, error: passwordError }, { status: 400 })
  }

  const adminAuth = getAdminAuth()
  const currentUser = await adminAuth.getUser(auth.uid)
  if (!(await verifyCurrentPassword(currentUser.email, currentPassword))) {
    return NextResponse.json({ ok: false, error: 'Current password is incorrect.' }, { status: 401 })
  }

  try {
    await adminAuth.updateUser(auth.uid, { password: newPassword })
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'Could not update password. Please try again.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
