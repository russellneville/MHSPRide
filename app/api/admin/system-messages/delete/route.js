import { NextResponse } from 'next/server'
import { verifySuperAdminRequest } from '@/lib/adminAuth'
import { getAdminDb } from '@/lib/firebaseAdmin'

export async function POST(request) {
  const auth = await verifySuperAdminRequest(request)
  if (auth.error) return auth.error

  const { id } = await request.json()
  const trimmedId = String(id || '').trim()
  if (!trimmedId) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  try {
    const db = getAdminDb()
    const ref = db.collection('system_messages').doc(trimmedId)
    const existing = await ref.get()
    if (!existing.exists) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    await ref.delete()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/system-messages/delete]', err)
    return NextResponse.json({ error: err.message || 'Could not delete message' }, { status: 500 })
  }
}
