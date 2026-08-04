/**
 * Server-side drive-time estimation via Google Directions API, for location
 * pairs the precomputed driveTimes Firestore table (lib/drive-times.js)
 * doesn't cover — that table only holds predefined-location pairs, computed
 * once when an admin adds a location. A free-text ride location has no such
 * precomputed entry, so any pair involving one needs a live lookup instead.
 * Requires GOOGLE_MAPS_API_KEY (never expose to client).
 */
export async function estimateDriveMinutes(origin, destination) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY is not set')

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=${apiKey}`
  const res = await fetch(url)
  const data = await res.json()

  // No drivable route between two valid points is an expected outcome for
  // some coordinate pairs (e.g. no road connection), not a failure — return
  // null rather than throwing, same as an unconfigured pair in the
  // precomputed table.
  if (data.status === 'ZERO_RESULTS' || data.status === 'NOT_FOUND') return null
  if (data.status !== 'OK' || !data.routes?.[0]) {
    throw new Error(`Directions request failed: ${data.status || 'unknown error'}`)
  }

  const seconds = data.routes[0].legs?.[0]?.duration?.value
  if (seconds == null) return null
  return Math.round(seconds / 60)
}
