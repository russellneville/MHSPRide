import { NextResponse } from 'next/server'
import { verifyCronRequest } from '@/lib/adminAuth'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { sendRideRequestExpiredEmail } from '@/lib/email'

// Hourly job (see .github/workflows/expire-ride-requests.yml): marks any
// still-open request whose 6h cutoff has passed as 'expired' (never
// deleted, so admins keep a record of unmet demand) and emails the
// requester. Each request is an independent document, unlike a ride's
// shared available_seats counter, so Promise.allSettled across all of them
// is safe here — no read-then-write race the way adminCancelRideBookings
// has to guard against.
export async function POST(request) {
  const auth = await verifyCronRequest(request)
  if (auth.error) return auth.error

  try {
    const db = getAdminDb()
    const now = new Date()
    const snap = await db.collection('ride_requests')
      .where('status', '==', 'open')
      .where('expires_at', '<=', now)
      .get()

    if (snap.empty) return NextResponse.json({ ok: true, expired: 0, emailed: 0 })

    await Promise.all(snap.docs.map(doc => doc.ref.update({ status: 'expired' })))

    const requests = snap.docs.map(doc => doc.data()).filter(r => r.requester?.email)
    const results = await Promise.allSettled(
      requests.map(r => sendRideRequestExpiredEmail({ requester: r.requester, request: r }))
    )
    results.forEach((r, i) => {
      if (r.status === 'rejected') console.error(`[expire-ride-requests] ${requests[i]?.requester?.email} failed:`, r.reason)
    })

    const emailed = results.filter(r => r.status === 'fulfilled').length
    return NextResponse.json({ ok: true, expired: snap.size, emailed })
  } catch (error) {
    console.error('[expire-ride-requests]', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
