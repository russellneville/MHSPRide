import { NextResponse } from 'next/server'
import { verifySuperAdminRequest } from '@/lib/adminAuth'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { TROOPITER_ORG_ID } from '@/lib/skin'

export async function POST(request) {
  const auth = await verifySuperAdminRequest(request)
  if (auth.error) return auth.error

  const { id } = await request.json()
  const trimmedId = String(id || '').trim()
  if (!trimmedId) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  // This is the one org lib/skin.js actually resolves and renders on the
  // Troopiter skin — deleting it out from under a live deployment would
  // silently fall back to the unbranded default. Not a technical
  // impossibility, just a footgun worth blocking here.
  if (trimmedId === TROOPITER_ORG_ID) {
    return NextResponse.json({ error: `"${trimmedId}" is the org currently live on the Troopiter skin — update it instead of deleting it.` }, { status: 409 })
  }

  const db = getAdminDb()
  const ref = db.collection('organizations').doc(trimmedId)
  const existing = await ref.get()
  if (!existing.exists) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }
  const org = existing.data()

  await ref.delete()

  await db.collection('activity_log').add({
    type: 'organization.deleted',
    message: `Organization deleted: ${org.displayName || trimmedId}`,
    userId: auth.uid,
    userName: 'Admin',
    userMhspHex: null,
    metadata: { orgId: trimmedId },
    timestamp: new Date(),
  })

  return NextResponse.json({ ok: true })
}
