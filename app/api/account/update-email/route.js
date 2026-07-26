import { NextResponse } from 'next/server'
import { verifyAuthRequest, verifyCurrentPassword } from '@/lib/adminAuth'
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'
import { isValidEmailInput } from '@/lib/rateLimit'

// Auth email changes go through the Admin SDK (not the client updateEmail call) so this
// never triggers Firebase's own verification/notice emails. A valid ID token alone only
// proves an active session, not that the caller just reauthenticated — the client-side
// reauth is a UX nicety a stolen token would skip entirely, so currentPassword is
// independently verified here before anything is mutated.
export async function POST(request) {
  const auth = await verifyAuthRequest(request)
  if (auth.error) return auth.error

  const { newEmail, currentPassword } = await request.json()
  const email = String(newEmail || '').trim()

  if (!isValidEmailInput(email) || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'A valid email address is required.' }, { status: 400 })
  }

  const adminAuth = getAdminAuth()
  const currentUser = await adminAuth.getUser(auth.uid)
  if (!(await verifyCurrentPassword(currentUser.email, currentPassword))) {
    return NextResponse.json({ ok: false, error: 'Current password is incorrect.' }, { status: 401 })
  }

  try {
    await adminAuth.updateUser(auth.uid, { email })
  } catch (error) {
    const message = error.code === 'auth/email-already-exists'
      ? 'An account with this email already exists.'
      : 'Could not update email. Please check the address and try again.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }

  const db = getAdminDb()
  await db.collection('users').doc(auth.uid).update({ email })

  return NextResponse.json({ ok: true })
}
