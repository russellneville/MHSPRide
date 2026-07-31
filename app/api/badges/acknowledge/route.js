import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { verifyAuthRequest } from '@/lib/adminAuth'
import { getAdminDb } from '@/lib/firebaseAdmin'

// Marks a badge as seen once the celebration dialog has shown it. Until this
// runs, the badge stays eligible for the celebration dialog on the next load
// — a dropped request here shouldn't permanently suppress it (resources/badging.md).
export async function POST(request) {
  const auth = await verifyAuthRequest(request)
  if (auth.error) return auth.error

  try {
    const { badgeId } = await request.json()
    if (!badgeId) return NextResponse.json({ error: 'badgeId is required' }, { status: 400 })

    const db = getAdminDb()
    const ref = db.collection('users').doc(auth.uid).collection('badges').doc(badgeId)
    const snap = await ref.get()
    if (!snap.exists) return NextResponse.json({ error: 'Badge not found' }, { status: 404 })

    await ref.update({ seenAt: FieldValue.serverTimestamp() })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[badges/acknowledge]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
