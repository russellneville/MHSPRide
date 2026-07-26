import { NextResponse } from 'next/server'
import { verifyAuthRequest } from '@/lib/adminAuth'
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'
import { isValidEmailInput } from '@/lib/rateLimit'

// Auth email changes go through the Admin SDK (not the client updateEmail call) so this
// never triggers Firebase's own verification/notice emails — the client already proved
// the current password via reauthenticateWithCredential before calling this route.
export async function POST(request) {
  const auth = await verifyAuthRequest(request)
  if (auth.error) return auth.error

  const { newEmail } = await request.json()
  const email = String(newEmail || '').trim()

  if (!isValidEmailInput(email) || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'A valid email address is required.' }, { status: 400 })
  }

  try {
    await getAdminAuth().updateUser(auth.uid, { email })
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
