/**
 * fixStaleBookingStatuses.mjs
 *
 * One-time cleanup for issue #54: bookings never get flipped to "finished"
 * unless a driver manually clicks Finish on the ride, so old bookings for
 * long-past rides were still showing as "booked". This walks every
 * non-terminal booking, looks up its ride, and sets booking_status to
 * 'finished' (ride's departure/return window has passed) or 'canceled'
 * (the ride itself was canceled) — matching what the admin Rides page now
 * keeps in sync going forward for new cancellations.
 *
 * Does NOT touch rides/{id}.passengers[].status — that embedded array is no
 * longer read for status display anywhere in the app, only the `bookings`
 * collection is authoritative.
 *
 * Prerequisites:
 *   - scripts/serviceAccountKey.json (Firebase Admin service account)
 *
 * Usage:
 *   node scripts/fixStaleBookingStatuses.mjs --dry-run
 *   node scripts/fixStaleBookingStatuses.mjs
 */

import { createRequire } from 'module'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { computeRideStatus, isCanceledStatus } from '../lib/rides.js'

const require = createRequire(import.meta.url)
const serviceAccount = require('./serviceAccountKey.json')

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const DRY_RUN = process.argv.includes('--dry-run')

function isTestRecord(booking) {
  return (booking.id || '').includes('TEST') || (booking.ride_id || '').includes('TEST')
}

async function main() {
  console.log(`=== MHSPRide stale booking status cleanup ${DRY_RUN ? '(dry run)' : ''} ===\n`)

  const bookingsSnap = await db.collection('bookings').get()
  const bookings = bookingsSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(b => !isTestRecord(b))
    .filter(b => !isCanceledStatus(b.booking_status) && b.booking_status !== 'finished')

  console.log(`Found ${bookings.length} non-terminal booking(s) to check.\n`)

  const rideCache = new Map()
  async function getRide(rideId) {
    if (!rideCache.has(rideId)) {
      const snap = await db.collection('rides').doc(rideId).get()
      rideCache.set(rideId, snap.exists ? snap.data() : null)
    }
    return rideCache.get(rideId)
  }

  const changes = []
  for (const booking of bookings) {
    if (!booking.ride_id) {
      console.warn(`  skip ${booking.id}: no ride_id`)
      continue
    }
    const ride = await getRide(booking.ride_id)
    if (!ride) {
      console.warn(`  skip ${booking.id}: ride ${booking.ride_id} not found`)
      continue
    }

    let target = null
    if (isCanceledStatus(ride.ride_status)) {
      target = 'canceled'
    } else if (computeRideStatus(ride) === 'completed') {
      target = 'finished'
    }

    if (target) {
      changes.push({ bookingId: booking.id, from: booking.booking_status, to: target, rideDate: ride.departure_date })
    }
  }

  if (changes.length === 0) {
    console.log('Nothing to update.')
    return
  }

  console.log(`${changes.length} booking(s) will be updated:\n`)
  changes.forEach(c => console.log(`  ${c.bookingId}  ${c.from} -> ${c.to}  (ride ${c.rideDate})`))

  if (DRY_RUN) {
    console.log('\nDry run — no writes made.')
    return
  }

  for (let i = 0; i < changes.length; i += 500) {
    const chunk = changes.slice(i, i + 500)
    const batch = db.batch()
    chunk.forEach(c => batch.update(db.collection('bookings').doc(c.bookingId), { booking_status: c.to }))
    await batch.commit()
  }

  console.log(`\nDone. Updated ${changes.length} booking(s).`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
