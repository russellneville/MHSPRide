import { NextResponse } from 'next/server'
import { verifySuperAdminRequest } from '@/lib/adminAuth'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'

const MAX_MESSAGE_LENGTH = 500

export async function POST(request) {
  const auth = await verifySuperAdminRequest(request)
  if (auth.error) return auth.error

  const { enabled, message } = await request.json()

  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 })
  }

  const trimmedMessage = String(message || '').trim()
  if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer` }, { status: 400 })
  }

  try {
    await getAdminDb().collection('config').doc('maintenance').set({
      enabled,
      message: trimmedMessage,
      updatedBy: auth.uid,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/maintenance]', err)
    return NextResponse.json({ error: err.message || 'Could not update maintenance mode' }, { status: 500 })
  }
}
