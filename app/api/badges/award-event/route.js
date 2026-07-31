import { NextResponse } from 'next/server'
import { verifyAuthRequest } from '@/lib/adminAuth'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { awardBadge } from '@/lib/badges/award'

// Network favoriting, driver favoriting, and photo upload are all direct
// client Firestore writes (context/NetworksContext.jsx, context/AuthContext.jsx)
// with no server route of their own — see resources/badging.md's note on why
// most whimsical badges ended up lazy-evaluated instead of event-based for the
// same reason. This route exists so those three specific actions can still
// award a badge through the Admin-SDK-only write path, without moving the
// underlying writes themselves server-side. The client calls this
// fire-and-forget right after its own Firestore write succeeds; every claim
// here is re-checked against the current Firestore state before anything is
// awarded, since the request body is not trusted.
const NETWORK_BADGE_IDS = {
  'network-NORDIC': 'nordic-patrol-networker',
  'network-HILLPATROL': 'hill-patrol-networker',
  'network-MOUNTAINHOSTS': 'mountain-host-networker',
  'network-MOUNTAINBIKING': 'mountain-biking-networker',
}

const HIGH_FIVE_THRESHOLD = 5
const EVERYBODYS_FAVORITE_THRESHOLD = 10

async function countFavoriters(db, driverId) {
  // Same full-collection-scan approach already used by the admin favorites
  // leaderboard (app/dashboard/admin/reports/page.jsx) — favorite_drivers is
  // an array of snapshot objects, not plain ids, so there's no array-contains
  // query that can match on driverId alone without a reverse index.
  const usersSnap = await db.collection('users').get()
  let count = 0
  for (const doc of usersSnap.docs) {
    const favorites = doc.data().favorite_drivers || []
    if (favorites.some((d) => d.id === driverId)) count += 1
  }
  return count
}

export async function POST(request) {
  const auth = await verifyAuthRequest(request)
  if (auth.error) return auth.error

  try {
    const { event, networkId, driverId } = await request.json()
    const db = getAdminDb()
    const uid = auth.uid

    if (event === 'network-favorited') {
      const badgeId = NETWORK_BADGE_IDS[networkId]
      if (!badgeId) return NextResponse.json({ error: 'Unknown networkId' }, { status: 400 })

      const userSnap = await db.collection('users').doc(uid).get()
      const favoriteNetworks = userSnap.data()?.favorite_networks || []
      if (!favoriteNetworks.includes(networkId)) {
        return NextResponse.json({ awarded: [] })
      }
      const awarded = (await awardBadge(db, uid, badgeId)) ? [badgeId] : []
      return NextResponse.json({ awarded })
    }

    if (event === 'photo-uploaded') {
      const userSnap = await db.collection('users').doc(uid).get()
      if (!userSnap.data()?.photoURL) return NextResponse.json({ awarded: [] })
      const awarded = (await awardBadge(db, uid, 'photogenic')) ? ['photogenic'] : []
      return NextResponse.json({ awarded })
    }

    if (event === 'driver-favorited') {
      if (!driverId) return NextResponse.json({ error: 'driverId is required' }, { status: 400 })
      // favorite_drivers is a member's own array — nothing stops them writing
      // an arbitrary entry into it directly (firestore.rules only restricts a
      // handful of user-doc fields, not this one). Excluding self-favorites
      // closes the trivial version of that gap; the app's UI never offers a
      // "favorite yourself" option anyway, so this changes no real behavior.
      if (driverId === uid) return NextResponse.json({ awarded: [] })

      const userSnap = await db.collection('users').doc(uid).get()
      const favoriteDrivers = userSnap.data()?.favorite_drivers || []
      if (!favoriteDrivers.some((d) => d.id === driverId)) {
        return NextResponse.json({ awarded: [] })
      }

      const awarded = []
      if (await awardBadge(db, uid, 'picking-favorites')) awarded.push('picking-favorites')

      const favoriterCount = await countFavoriters(db, driverId)
      if (favoriterCount >= 1 && (await awardBadge(db, driverId, 'favorited'))) awarded.push('favorited')
      if (favoriterCount >= HIGH_FIVE_THRESHOLD && (await awardBadge(db, driverId, 'high-five-driver'))) {
        awarded.push('high-five-driver')
      }
      if (favoriterCount >= EVERYBODYS_FAVORITE_THRESHOLD && (await awardBadge(db, driverId, 'everybodys-favorite'))) {
        awarded.push('everybodys-favorite')
      }
      return NextResponse.json({ awarded })
    }

    return NextResponse.json({ error: 'Unknown event' }, { status: 400 })
  } catch (error) {
    console.error('[badges/award-event]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
