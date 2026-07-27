import { NextResponse } from 'next/server'
import { verifySuperAdminRequest } from '@/lib/adminAuth'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import { isCanceledStatus } from '@/lib/rides'

// Same pairing rule as the add route — used here to find every other
// location whose driveTimes doc holds a stale key pointing at the deleted one.
const canBeOrigin = (role) => role === 'origin' || role === 'both'
const canBeDestination = (role) => role === 'destination' || role === 'both'
const canPair = (roleA, roleB) =>
  (canBeOrigin(roleA) && canBeDestination(roleB)) || (canBeDestination(roleA) && canBeOrigin(roleB))

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
    const locRef = db.collection('locations').doc(trimmedId)
    const locSnap = await locRef.get()
    if (!locSnap.exists) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }
    const location = locSnap.data()

    // Block deletion if any non-canceled ride departing today or later still
    // references this location — deleting it out from under an active ride
    // would strand that ride's departure/arrival on a name nobody manages.
    // Past/completed/canceled rides don't block: resolveLocation() falls back
    // to a prettified id for them, which is an acceptable cosmetic tradeoff
    // for cleaning up a stale or misconfigured location.
    const today = new Date().toISOString().slice(0, 10)
    const [depSnap, arrSnap] = await Promise.all([
      db.collection('rides').where('departure', '==', trimmedId).get(),
      db.collection('rides').where('arrival', '==', trimmedId).get(),
    ])
    const referencingRides = new Map()
    for (const doc of [...depSnap.docs, ...arrSnap.docs]) referencingRides.set(doc.id, doc.data())

    const upcoming = [...referencingRides.values()].filter(r =>
      r.departure_date >= today && !isCanceledStatus(r.ride_status)
    )
    if (upcoming.length > 0) {
      return NextResponse.json({
        error: `Cannot delete — referenced by ${upcoming.length} upcoming ride${upcoming.length !== 1 ? 's' : ''}. Cancel or reassign ${upcoming.length !== 1 ? 'those rides' : 'that ride'} first.`,
      }, { status: 409 })
    }

    const historicalRideCount = referencingRides.size

    const allSnap = await db.collection('locations').get()
    const partners = allSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(other => other.id !== trimmedId && canPair(location.role, other.role))

    await Promise.all(partners.map(other =>
      db.collection('driveTimes').doc(other.id).update({ [trimmedId]: FieldValue.delete() })
        .catch(err => console.error(`[locations/delete] cleaning up ${other.id}:`, err.message))
    ))

    await db.collection('driveTimes').doc(trimmedId).delete()
    await locRef.delete()

    return NextResponse.json({ ok: true, historicalRideCount })
  } catch (err) {
    console.error('[admin/locations/delete]', err)
    return NextResponse.json({ error: err.message || 'Could not delete location' }, { status: 500 })
  }
}
