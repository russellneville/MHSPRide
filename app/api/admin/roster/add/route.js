import { NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/adminAuth'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { geocodeAddress } from '@/lib/geocodeAddress'
import { normalizeEmail } from '@/lib/rosterDiff'

export async function POST(request) {
  const auth = await verifyAdminRequest(request)
  if (auth.error) return auth.error

  const { mhspNumber, lastName, firstName, email, status, classification, address } = await request.json()

  // Not every org has MHSP-style patrol ID numbers (Armadillo Mountain, the
  // Troopiter integration's rehearsal org, has none) — fall back to the
  // normalized email as the member doc ID when no MHSP # is given.
  const trimmedMhspNumber = String(mhspNumber || '').trim()
  const trimmedLastName = String(lastName || '').trim()
  const trimmedEmail = String(email || '').trim()
  const id = trimmedMhspNumber || normalizeEmail(trimmedEmail)

  if (!id || !trimmedLastName || !trimmedEmail) {
    return NextResponse.json({ error: 'Last Name, Troopiter Email, and either an MHSP # or the email are required' }, { status: 400 })
  }

  const db = getAdminDb()
  const memberRef = db.collection('members').doc(id)
  const existing = await memberRef.get()
  if (existing.exists) {
    return NextResponse.json({ error: `${trimmedMhspNumber ? `MHSP #${id}` : trimmedEmail} already exists in the roster` }, { status: 409 })
  }

  const trimmedAddress = String(address || '').trim()
  let latitude = null
  let longitude = null
  if (trimmedAddress && status === 'Active') {
    try {
      const coords = await geocodeAddress(trimmedAddress)
      latitude = coords.latitude
      longitude = coords.longitude
    } catch (err) {
      console.warn(`[roster/add] geocode failed for "${trimmedAddress}":`, err.message)
    }
  }

  await memberRef.set({
    mhspNumber: trimmedMhspNumber,
    firstName: String(firstName || '').trim(),
    lastName: trimmedLastName,
    email: trimmedEmail,
    status: status || '',
    classifications: classification ? [classification] : [],
    address: trimmedAddress,
    latitude,
    longitude,
    active: true,
    claimed: false,
    claimedBy: null,
  })

  await db.collection('activity_log').add({
    type: 'member.added_manually',
    message: `Roster record added manually: ${firstName || ''} ${trimmedLastName} ${trimmedMhspNumber ? `#${trimmedMhspNumber}` : `<${trimmedEmail}>`}`.trim(),
    userId: auth.uid,
    userName: 'Admin',
    userMhspHex: null,
    metadata: { mhspNumber: trimmedMhspNumber, memberId: id },
    timestamp: new Date(),
  })

  return NextResponse.json({ ok: true })
}
