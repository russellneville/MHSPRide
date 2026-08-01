import { NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/adminAuth'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { computeRequestExpiresAt } from '@/lib/rideRequests'

const EDITABLE_FIELDS = [
  'departure', 'arrival', 'custom_departure', 'custom_arrival',
  'departure_date', 'departure_time', 'seats_requested', 'equipment', 'notes',
]

// Client writes to ride_requests are create-only (see firestore.rules) — an
// admin editing a request's details goes through here instead of a direct
// updateDoc. Only 'open' requests are editable; a fulfilled/expired/canceled
// request already has a resolved outcome that editing shouldn't disturb.
export async function POST(request) {
  const auth = await verifyAdminRequest(request)
  if (auth.error) return auth.error

  try {
    const { requestId, updates } = await request.json()
    if (!requestId || !updates) {
      return NextResponse.json({ error: 'requestId and updates are required' }, { status: 400 })
    }

    const db = getAdminDb()
    const reqRef = db.collection('ride_requests').doc(requestId)
    const reqSnap = await reqRef.get()
    if (!reqSnap.exists) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

    if (reqSnap.data().status !== 'open') {
      return NextResponse.json({ error: 'Only open requests can be edited' }, { status: 409 })
    }

    const fields = Object.fromEntries(
      Object.entries(updates).filter(([key]) => EDITABLE_FIELDS.includes(key))
    )
    fields.expires_at = computeRequestExpiresAt(
      fields.departure_date ?? reqSnap.data().departure_date,
      fields.departure_time ?? reqSnap.data().departure_time
    )

    await reqRef.update(fields)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[ride-requests/update]', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
