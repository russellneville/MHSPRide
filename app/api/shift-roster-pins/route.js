/**
 * Resolves a shift's roster into map-pickable pins (issue #225). The roster
 * embedded on shifts/{orgId}_{shiftId} (see upsertShift in app/api/launch)
 * already carries each member's latitude/longitude straight from Troopiter's
 * launch payload, refreshed on every relaunch — but a member's own
 * users/{uid} address, if they've confirmed one inside this app since, is
 * more current than whatever Troopiter last sent, so it wins when present.
 * That precedence check requires the Admin SDK: firestore.rules locks other
 * members' users/ docs from direct client reads.
 */
import { NextResponse } from 'next/server'
import { verifyAuthRequest } from '@/lib/adminAuth'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { normalizeEmail } from '@/lib/rateLimit'

export async function POST(request) {
  const auth = await verifyAuthRequest(request)
  if (auth.error) return auth.error

  try {
    // The shift.id the dashboard hands to Offer/RequestRidePopup (and that
    // they pass straight through here) is already shifts/{orgId}_{shiftId}'s
    // full document id, not the bare Troopiter shiftId — see
    // getShiftsForOrg() in context/NetworksContext.jsx, which maps `{id:
    // d.id, ...d.data()}` from the doc snapshot. Re-prefixing it here was a
    // bug that made every lookup miss silently.
    const { shiftDocId } = await request.json()
    if (!shiftDocId) return NextResponse.json({ error: 'shiftDocId is required' }, { status: 400 })

    const db = getAdminDb()
    const shiftSnap = await db.collection('shifts').doc(shiftDocId).get()
    if (!shiftSnap.exists) return NextResponse.json({ roster: [] })

    const shiftData = shiftSnap.data()

    // firestore.rules lets any authed user read a shift doc (for the
    // dashboard's Available Rides listing), but pins carry home
    // addresses — only someone actually rostered on this shift should be
    // able to resolve them, not any signed-in account guessing shift ids.
    const callerSnap = await db.collection('users').doc(auth.uid).get()
    const callerEmail = normalizeEmail(callerSnap.data()?.email || '')
    if (!(shiftData.rosterEmails || []).includes(callerEmail)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const roster = shiftData.roster || []

    const resolved = await Promise.all(roster.map(async (member) => {
      const normalizedEmail = normalizeEmail(member.email)
      const userQuery = await db.collection('users').where('email', '==', normalizedEmail).limit(1).get()
      const userDoc = userQuery.empty ? null : userQuery.docs[0]
      const userData = userDoc?.data() || null

      const hasUserCoords = userData?.latitude != null && userData?.longitude != null
      const latitude = hasUserCoords ? userData.latitude : (member.latitude ?? null)
      const longitude = hasUserCoords ? userData.longitude : (member.longitude ?? null)

      return {
        name: member.name || '',
        email: member.email,
        uid: userDoc?.id || null,
        latitude,
        longitude,
        hasPlottableLocation: latitude != null && longitude != null,
      }
    }))

    return NextResponse.json({ roster: resolved })
  } catch (error) {
    console.error('[shift-roster-pins]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
