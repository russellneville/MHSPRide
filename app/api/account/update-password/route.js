import { NextResponse } from 'next/server'
import { verifyAuthRequest } from '@/lib/adminAuth'
import { getAdminAuth } from '@/lib/firebaseAdmin'

// Goes through the Admin SDK — the client already proved the current password via
// reauthenticateWithCredential before calling this route.
export async function POST(request) {
  const auth = await verifyAuthRequest(request)
  if (auth.error) return auth.error

  const { newPassword } = await request.json()

  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ ok: false, error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  try {
    await getAdminAuth().updateUser(auth.uid, { password: newPassword })
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'Could not update password. Please try again.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
