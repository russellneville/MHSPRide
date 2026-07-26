import { NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/adminAuth'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { geocodeAddress } from '@/lib/geocodeAddress'

export async function POST(request) {
  const auth = await verifyAdminRequest(request)
  if (auth.error) return auth.error

  const { mhspNumber, lastName, firstName, email, status, classification, address } = await request.json()

  const id = String(mhspNumber || '').trim()
  const trimmedLastName = String(lastName || '').trim()
  const trimmedEmail = String(email || '').trim()

  if (!id || !trimmedLastName || !trimmedEmail) {
    return NextResponse.json({ error: 'MHSP #, Last Name, and Troopiter Email are required' }, { status: 400 })
  }

  const db = getAdminDb()
  const memberRef = db.collection('members').doc(id)
  const existing = await memberRef.get()
  if (existing.exists) {
    return NextResponse.json({ error: `MHSP #${id} already exists in the roster` }, { status: 409 })
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
    mhspNumber: id,
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
    message: `Roster record added manually: ${firstName || ''} ${trimmedLastName} #${id}`.trim(),
    userId: auth.uid,
    userName: 'Admin',
    userMhspHex: null,
    metadata: { mhspNumber: id },
    timestamp: new Date(),
  })

  return NextResponse.json({ ok: true })
}
