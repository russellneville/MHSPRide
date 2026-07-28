import { NextResponse } from 'next/server'
import { verifyAuthRequest, isAdminUser } from '@/lib/adminAuth'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { sendRideUpdateEmail } from '@/lib/email'

// Recipients and content come from the (already-updated) ride doc, never
// from the request body — the caller only supplies which ride to notify about.
export async function POST(request) {
  const auth = await verifyAuthRequest(request)
  if (auth.error) return auth.error

  try {
    const { rideId } = await request.json()
    if (!rideId) return NextResponse.json({ error: 'rideId is required' }, { status: 400 })

    const db = getAdminDb()
    const rideSnap = await db.collection('rides').doc(rideId).get()
    if (!rideSnap.exists) return NextResponse.json({ ok: true, sent: 0 })
    const rideData = rideSnap.data()

    if (rideData.driverId !== auth.uid && !(await isAdminUser(auth.uid))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const passengers = (rideData.passengers || [])
      .filter(p => p.status !== 'canceled' && p.status !== 'cancled' && p.email)
      .map(p => ({ fullname: p.fullname || '', email: p.email }))

    if (!passengers.length) {
      return NextResponse.json({ ok: true, sent: 0 })
    }

    const ride = {
      departure: rideData.departure,
      arrival: rideData.arrival,
      departure_date: rideData.departure_date,
      departure_time: rideData.departure_time,
      arrival_time: rideData.arrival_time || '',
      return_departure_time: rideData.return_departure_time || '',
      ride_description: rideData.ride_description || '',
    }

    const results = await Promise.allSettled(
      passengers.map(p => sendRideUpdateEmail({ passenger: p, ride }))
    )

    results.forEach((r, i) => {
      if (r.status === 'rejected') console.error(`[notify-ride-update] ${passengers[i]?.email} failed:`, r.reason)
    })

    const sent = results.filter(r => r.status === 'fulfilled').length
    return NextResponse.json({ ok: true, sent })
  } catch (error) {
    console.error('[notify-ride-update]', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
