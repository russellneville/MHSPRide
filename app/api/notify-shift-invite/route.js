import { NextResponse } from 'next/server'
import { verifyAuthRequest } from '@/lib/adminAuth'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { sendShiftInviteEmail } from '@/lib/email'
import { SITE_URL } from '@/lib/siteUrl'
import { normalizeEmail } from '@/lib/rateLimit'

// Fires invite emails for people picked in the shift-member map picker
// (issue #225) once a driver's ride or a rider's request has actually been
// created. Recipients and content come from the ride/request doc's own
// invite_emails field, never trusted from the request body — only which
// doc to notify about is — same pattern as notify-booking.
export async function POST(request) {
  const auth = await verifyAuthRequest(request)
  if (auth.error) return auth.error

  try {
    const { type, id } = await request.json()
    if (!id || (type !== 'ride' && type !== 'request')) {
      return NextResponse.json({ error: 'type ("ride" or "request") and id are required' }, { status: 400 })
    }

    const db = getAdminDb()
    const collectionName = type === 'ride' ? 'rides' : 'ride_requests'
    const docSnap = await db.collection(collectionName).doc(id).get()
    if (!docSnap.exists) return NextResponse.json({ ok: true, sent: 0 })

    const data = docSnap.data()
    const ownerId = type === 'ride' ? data.driverId : data.requesterId
    if (auth.uid !== ownerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const requestedEmails = Array.isArray(data.invite_emails) ? data.invite_emails : []
    if (requestedEmails.length === 0) return NextResponse.json({ ok: true, sent: 0 })

    // invite_emails rides on a client-written doc (rides/ride_requests create
    // rules only check ownership + address length, not this field), so it
    // can't be trusted as-is — a tampered client could point it at arbitrary
    // addresses and use this route to send mail to them. Only actual shift
    // roster members are legitimate recipients, so intersect against the
    // shift's own rosterEmails (same field /api/shift-roster-pins checks)
    // before sending anything. data.shift_id is already shifts/{orgId}_
    // {shiftId}'s full document id (see buildSubmittedRideData in
    // OfferRidePopup.jsx: `shift_id: shift?.id`, where shift.id came from
    // getShiftsForOrg()'s doc snapshot) — not the bare Troopiter shiftId.
    let inviteEmails = []
    if (data.shift_id) {
      const shiftSnap = await db.collection('shifts').doc(data.shift_id).get()
      const rosterEmails = new Set(shiftSnap.data()?.rosterEmails || [])
      inviteEmails = requestedEmails.filter(email => rosterEmails.has(normalizeEmail(email)))
    }
    if (inviteEmails.length === 0) return NextResponse.json({ ok: true, sent: 0 })

    const inviterName = (type === 'ride' ? data.driver?.fullname : data.requester?.fullname) || 'A shift-mate'
    const shiftTitle = data.shift_name || 'the shift'
    const ride = {
      departure: data.departure,
      arrival: data.arrival,
      departure_date: data.departure_date,
      departure_time: data.departure_time,
    }

    const results = await Promise.allSettled(
      inviteEmails.map(to => sendShiftInviteEmail({
        to,
        inviterName,
        isDriver: type === 'ride',
        ride,
        shiftTitle,
        deepLink: `${SITE_URL}/dashboard`,
      }))
    )

    results.forEach((r, i) => {
      if (r.status === 'rejected') console.error(`[notify-shift-invite] invite->${inviteEmails[i]} failed:`, r.reason)
    })

    const sent = results.filter(r => r.status === 'fulfilled').length
    return NextResponse.json({ ok: true, sent })
  } catch (error) {
    console.error('[notify-shift-invite]', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
