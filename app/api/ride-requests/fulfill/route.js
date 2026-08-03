import { NextResponse } from 'next/server'
import { verifyAuthRequest } from '@/lib/adminAuth'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { flattenVehicleForSnapshot } from '@/lib/vehicles'
import { diffPrefilledFields } from '@/lib/rideRequests'
import { sendRideRequestFulfilledEmail } from '@/lib/email'
import { awardBadge } from '@/lib/badges/award'
import { SITE_URL } from '@/lib/siteUrl'

function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length))
  return code
}

// Turns an open ride request into a real ride, atomically. Race protection
// is a compare-and-swap inside the transaction (status must still be
// 'open') — no claim/lock state, matching how every other race in this app
// (day-conflict checks, booking cutoffs) is handled: validate at submit,
// not via a held lock. This is also the first server-authored write to the
// rides/bookings collections — every existing invariant the client-side
// offerRide()/bookRide() flow relies on (driverId from the caller's own
// auth, not the request body; seats/passengers denormalized onto the ride)
// is reproduced here explicitly, since Admin SDK writes bypass Firestore
// rules entirely.
export async function POST(request) {
  const auth = await verifyAuthRequest(request)
  if (auth.error) return auth.error

  try {
    const { requestId, networkId, vehicle, rideData } = await request.json()
    if (!requestId || !networkId || !rideData) {
      return NextResponse.json({ error: 'requestId, networkId, and rideData are required' }, { status: 400 })
    }

    const db = getAdminDb()
    const userSnap = await db.collection('users').doc(auth.uid).get()
    if (!userSnap.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const userData = userSnap.data()

    const requestRef = db.collection('ride_requests').doc(requestId)
    const rideRef = db.collection('rides').doc(`ride-${generateInviteCode()}`)
    const bookingRef = db.collection('bookings').doc(`book-${generateInviteCode()}`)

    const result = await db.runTransaction(async (t) => {
      const reqSnap = await t.get(requestRef)
      if (!reqSnap.exists) {
        throw Object.assign(new Error('Request not found'), { status: 404 })
      }
      const reqData = reqSnap.data()
      if (reqData.status !== 'open') {
        throw Object.assign(new Error('This request has already been fulfilled or is no longer available.'), { status: 409 })
      }

      // Never trust a client-supplied "changed" flag — recompute server-side
      // from the request doc, same as recipients/content always come from
      // Firestore (never the request body) in the other notify-* routes.
      const diffs = diffPrefilledFields(reqData, rideData)
      if (diffs.length > 0 && !rideData.ride_description?.trim()) {
        throw Object.assign(new Error('Notes are required when changing any requested ride details.'), { status: 400 })
      }

      const totalSeats = Number(rideData.total_seats)
      const bookedSeats = Math.min(totalSeats, reqData.seats_requested)

      // driverId/driver snapshot come from the verified caller's own profile,
      // never the request body — mirrors offerRide()'s exact shape.
      const driver = { ...userData, ...flattenVehicleForSnapshot(vehicle), id: auth.uid }

      // Response-time facts, computed once here rather than re-derived later
      // from raw timestamps — feeds the "Quick Draw"/"Down to the Wire" lazy
      // badge evaluators (lib/badges/evaluate.js), which only see the ride
      // doc, never the (now-fulfilled) request doc.
      const now = new Date()
      const responseMinutes = Math.round((now - reqData.created_at.toDate()) / 60000)
      const minutesUntilExpiry = Math.round((reqData.expires_at.toDate() - now) / 60000)

      const passengerEntry = {
        id: reqData.requesterId,
        email: reqData.requester?.email || '',
        phone: reqData.requester?.phone || '',
        fullname: reqData.requester?.fullname || '',
        photoURL: reqData.requester?.photoURL || '',
        booked_seats: bookedSeats,
        booked_at: now,
        booking_id: bookingRef.id,
        status: 'booked',
      }

      t.set(rideRef, {
        departure: rideData.departure,
        arrival: rideData.arrival,
        custom_departure: !!rideData.custom_departure,
        custom_arrival: !!rideData.custom_arrival,
        departure_date: rideData.departure_date,
        arrival_date: rideData.departure_date,
        departure_time: rideData.departure_time,
        arrival_time: rideData.arrival_time || '',
        one_way: !!rideData.one_way,
        return_departure_time: rideData.one_way ? '' : (rideData.return_departure_time || ''),
        ride_description: rideData.ride_description || '',
        total_seats: totalSeats,
        available_seats: totalSeats - bookedSeats,
        started_at: '',
        finished_at: '',
        driver,
        driverId: auth.uid,
        network_id: networkId,
        passengers: [passengerEntry],
        ride_status: 'not started',
        created_at: now,
        source_request_id: requestId,
        source_requester_id: reqData.requesterId,
        request_response_minutes: responseMinutes,
        request_minutes_until_expiry: minutesUntilExpiry,
      })

      t.set(bookingRef, {
        passenger: {
          id: reqData.requesterId,
          phone: reqData.requester?.phone || '',
          email: reqData.requester?.email || '',
          fullname: reqData.requester?.fullname || '',
          photoURL: reqData.requester?.photoURL || '',
        },
        passengerId: reqData.requesterId,
        driver: {
          id: auth.uid,
          phone: driver.phone || '',
          email: driver.email || '',
          fullname: driver.fullname || '',
          vehicle_make: driver.vehicle_make || '',
          vehicle_model: driver.vehicle_model || '',
          vehicle_year: driver.vehicle_year || '',
          vehicle_color: driver.vehicle_color || '',
          vehicle_plate: driver.vehicle_plate || '',
          vehicle_seats: driver.vehicle_seats || '',
        },
        driverId: auth.uid,
        ride_id: rideRef.id,
        departure: rideData.departure,
        custom_departure: !!rideData.custom_departure,
        custom_arrival: !!rideData.custom_arrival,
        departure_date: rideData.departure_date,
        departure_time: rideData.departure_time,
        arrival: rideData.arrival,
        arrival_date: rideData.departure_date,
        arrival_time: rideData.arrival_time || '',
        return_departure_time: rideData.one_way ? '' : (rideData.return_departure_time || ''),
        booking_status: 'booked',
        booked_seats: bookedSeats,
        networkId,
        booked_at: now,
        source_request_id: requestId,
        request_changed: diffs.length > 0,
      })

      t.update(requestRef, { status: 'fulfilled', fulfilled_ride_id: rideRef.id })

      return { diffs, driver, totalSeats, bookedSeats, reqData }
    })

    if (result.diffs.length > 0) {
      awardBadge(db, auth.uid, 'switching-it-up').catch(err => console.error('[ride-requests/fulfill] badge award failed', err))
    }
    if (result.totalSeats > result.reqData.seats_requested) {
      awardBadge(db, auth.uid, 'room-to-spare').catch(err => console.error('[ride-requests/fulfill] badge award failed', err))
    }

    if (result.reqData.requester?.email) {
      const ride = {
        departure: rideData.departure,
        arrival: rideData.arrival,
        departure_date: rideData.departure_date,
        departure_time: rideData.departure_time,
        arrival_time: rideData.arrival_time || '',
        return_departure_time: rideData.one_way ? '' : (rideData.return_departure_time || ''),
        ride_description: rideData.ride_description || '',
        total_seats: result.totalSeats,
      }
      await sendRideRequestFulfilledEmail({
        requester: result.reqData.requester,
        driver: result.driver,
        ride,
        diffs: result.diffs,
        seatsShortfall: result.bookedSeats < result.reqData.seats_requested,
        deepLink: `${SITE_URL}/dashboard/network/${networkId}/rides/${rideRef.id}`,
      }).catch(err => console.error('[ride-requests/fulfill] email failed:', err))
    }

    return NextResponse.json({ ok: true, rideId: rideRef.id })
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[ride-requests/fulfill]', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
