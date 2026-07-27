import { NextResponse } from 'next/server'
import { verifySuperAdminRequest } from '@/lib/adminAuth'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'

// Per issue #66, editing a location only ever touches name/lat/lon — drive
// times are not recomputed here (only when a location is first added).
export async function POST(request) {
  const auth = await verifySuperAdminRequest(request)
  if (auth.error) return auth.error

  const { id, name, lat, lon } = await request.json()

  const trimmedId = String(id || '').trim()
  const trimmedName = String(name || '').trim()
  const latitude = Number(lat)
  const longitude = Number(lon)

  if (!trimmedId) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }
  if (!trimmedName) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: 'Valid lat/lon are required' }, { status: 400 })
  }

  try {
    const db = getAdminDb()
    const ref = db.collection('locations').doc(trimmedId)
    const existing = await ref.get()
    if (!existing.exists) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    await ref.update({
      name: trimmedName,
      lat: latitude,
      lon: longitude,
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/locations/update]', err)
    return NextResponse.json({ error: err.message || 'Could not update location' }, { status: 500 })
  }
}
