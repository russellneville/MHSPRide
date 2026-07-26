/**
 * Drive times between locations, read from the Firestore `driveTimes`
 * collection (issue #66) — each doc id is a location id, holding a map of
 * { [otherLocationId]: minutes }. Computed once per location when it's added
 * via the admin Locations page (app/api/admin/locations/add).
 */
import { db } from './firebaseClient'
import { doc, getDoc } from 'firebase/firestore'

const cache = new Map() // fromId -> { [toId]: minutes }

async function loadDriveTimesFor(fromId) {
  if (cache.has(fromId)) return cache.get(fromId)
  const snap = await getDoc(doc(db, 'driveTimes', fromId))
  const data = snap.exists() ? snap.data() : {}
  cache.set(fromId, data)
  return data
}

/**
 * Returns estimated drive time in minutes between two location IDs.
 * Returns null if the pair isn't in the table.
 */
export async function getDriveMinutes(fromId, toId) {
  if (!fromId || !toId) return null
  const times = await loadDriveTimesFor(fromId)
  return times[toId] ?? null
}

/**
 * Given a departure time string ("HH:MM") and a from/to pair,
 * returns the estimated arrival time string ("HH:MM"), or null.
 */
export async function estimateArrival(departureTime, fromId, toId) {
  const minutes = await getDriveMinutes(fromId, toId)
  if (!minutes || !departureTime) return null
  const [h, m] = departureTime.split(':').map(Number)
  const total = h * 60 + m + minutes
  const ah = String(Math.floor(total / 60) % 24).padStart(2, '0')
  const am = String(total % 60).padStart(2, '0')
  return `${ah}:${am}`
}
