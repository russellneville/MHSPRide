import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { verifyAuthRequest } from '@/lib/adminAuth'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { evaluateActivityBadges, evaluateMilestoneBadges, evaluateRideRequestBadges, evaluateThemeBadges } from '@/lib/badges/evaluate'
import { badgeById } from '@/lib/badges/catalog'

// Re-running this on every dashboard load is wasted read volume once a member
// has no new badges to earn — skip evaluation if we ran it recently.
const THROTTLE_MINUTES = 10

function toDate(value) {
  if (!value) return value
  if (value instanceof Date) return value
  if (typeof value?.toDate === 'function') return value.toDate()
  return new Date(value)
}

// "Gone to the Dark Side" reads a next-themes preference that only exists
// client-side (see lib/badges/evaluate.js) — the client optionally supplies
// it in the request body. Nothing else in this route depends on the body.
export async function POST(request) {
  const auth = await verifyAuthRequest(request)
  if (auth.error) return auth.error

  try {
    const { theme } = await request.json().catch(() => ({}))
    const db = getAdminDb()
    const uid = auth.uid

    const userSnap = await db.collection('users').doc(uid).get()
    if (!userSnap.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const user = userSnap.data()

    const lastEvaluatedAt = toDate(user.badges_last_evaluated_at)
    if (lastEvaluatedAt && Date.now() - lastEvaluatedAt.getTime() < THROTTLE_MINUTES * 60 * 1000) {
      return NextResponse.json({ newlyEarned: [], throttled: true })
    }

    const [offeredRidesSnap, bookedRidesSnap, rideRequestsSnap, existingBadgesSnap] = await Promise.all([
      db.collection('rides').where('driverId', '==', uid).get(),
      db.collection('bookings').where('passengerId', '==', uid).get(),
      db.collection('ride_requests').where('requesterId', '==', uid).get(),
      db.collection('users').doc(uid).collection('badges').get(),
    ])

    const offeredRides = offeredRidesSnap.docs.map((d) => d.data())
    const bookedRides = bookedRidesSnap.docs.map((d) => ({
      ...d.data(),
      booked_at: toDate(d.data().booked_at),
    }))
    const rideRequests = rideRequestsSnap.docs.map((d) => d.data())
    const alreadyEarnedIds = new Set(existingBadgesSnap.docs.map((d) => d.id))

    const now = new Date()
    const earnedIds = new Set([
      ...evaluateMilestoneBadges({ offeredRides, bookedRides, now }),
      ...evaluateActivityBadges({ offeredRides, bookedRides, user, now }),
      ...evaluateRideRequestBadges({ rideRequests, offeredRides, bookedRides }),
      ...evaluateThemeBadges({ theme }),
    ])

    const newlyEarnedIds = [...earnedIds].filter((id) => !alreadyEarnedIds.has(id))

    const batch = db.batch()
    for (const badgeId of newlyEarnedIds) {
      const badge = badgeById(badgeId)
      if (!badge) continue // catalog/evaluator drift — skip rather than write a dangling award
      const ref = db.collection('users').doc(uid).collection('badges').doc(badgeId)
      batch.set(ref, {
        badgeId,
        earnedAt: FieldValue.serverTimestamp(),
        definitionVersion: badge.version,
        reason: 'auto-evaluated',
        seenAt: null,
      })
    }
    batch.update(db.collection('users').doc(uid), { badges_last_evaluated_at: FieldValue.serverTimestamp() })
    await batch.commit()

    if (newlyEarnedIds.length) {
      db.collection('activity_log').add({
        type: 'badge.awarded',
        userId: uid,
        message: `Earned badge(s): ${newlyEarnedIds.join(', ')}`,
        metadata: { badgeIds: newlyEarnedIds },
        timestamp: FieldValue.serverTimestamp(),
      }).catch((error) => console.error('[badges/evaluate] activity log failed:', error))
    }

    return NextResponse.json({ newlyEarned: newlyEarnedIds })
  } catch (error) {
    console.error('[badges/evaluate]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
