import { NextResponse } from 'next/server'
import { verifySuperAdminRequest } from '@/lib/adminAuth'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { NAME_MAX_LENGTH } from '@/lib/utils'

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

function isValidUrl(value) {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export async function POST(request) {
  const auth = await verifySuperAdminRequest(request)
  if (auth.error) return auth.error

  const { id, displayName, logoUrl } = await request.json()

  const trimmedId = String(id || '').trim().toLowerCase()
  const trimmedName = String(displayName || '').trim()
  const trimmedLogoUrl = String(logoUrl || '').trim()

  if (!ID_PATTERN.test(trimmedId)) {
    return NextResponse.json({ error: 'Org ID must be lowercase letters, numbers, and hyphens only (e.g. "armadillo-mountain")' }, { status: 400 })
  }
  if (!trimmedName || trimmedName.length > NAME_MAX_LENGTH) {
    return NextResponse.json({ error: 'Display name is required' }, { status: 400 })
  }
  if (trimmedLogoUrl && !isValidUrl(trimmedLogoUrl)) {
    return NextResponse.json({ error: 'Logo URL must be a valid http(s) URL' }, { status: 400 })
  }

  const db = getAdminDb()
  const ref = db.collection('organizations').doc(trimmedId)
  const existing = await ref.get()
  if (existing.exists) {
    return NextResponse.json({ error: `An organization with ID "${trimmedId}" already exists` }, { status: 409 })
  }

  await ref.set({ displayName: trimmedName, logoUrl: trimmedLogoUrl })

  await db.collection('activity_log').add({
    type: 'organization.created',
    message: `Organization created: ${trimmedName} (${trimmedId})`,
    userId: auth.uid,
    userName: 'Admin',
    userMhspHex: null,
    metadata: { orgId: trimmedId },
    timestamp: new Date(),
  })

  return NextResponse.json({ ok: true, id: trimmedId })
}
