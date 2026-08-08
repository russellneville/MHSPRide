import { useEffect, useState } from "react"
import { getDriveMinutes, addMinutesToTime } from "@/lib/drive-times"
import { auth } from "@/lib/firebaseClient"

const RETRY_DELAY_MS = 3000
const MAX_RETRIES = 5

// Shared by OfferRidePopup, EditRidePopup, and RequestRidePopup: fetches the
// drive time between an origin/destination pair and derives arrival time
// from a given departure time. `origin`/`destination` are each
// { locationId, coords } — a predefined location carries both (coords via
// LocationsContext.getLocationCoords), a free-text address carries coords
// only, and only once explicitly confirmed (see LocationPicker).
//
// Predefined-to-predefined pairs use the precomputed driveTimes Firestore
// lookup (fast, free, unchanged from before). Any pair involving a
// free-text side has no precomputed entry, so it falls to a live Directions
// API estimate via /api/estimate-drive-time instead. A transient failure on
// either path (e.g. a network blip) used to leave arrival_time stuck with
// no visible error and no way to recover short of the caller re-picking a
// location (issue #149) — this retries a bounded number of times. A
// legitimate "no route" result is not an error and is not retried; it just
// leaves driveMinutes unset, same as an unconfigured precomputed pair.
//
// driveMinutes is fetched independent of departureTime (issue #199 needs it
// even before a departure time exists, to back-calculate one from a fixed
// target arrival — see OfferRidePopup's shift-scoped flow) — only
// arrivalTime itself requires departureTime to be present. bufferMinutes
// (default 0, so MHSP's existing behavior is unchanged) adds a fixed
// cushion on top of the raw drive time, e.g. Troopiter's 5-minute
// gear-loading buffer.
export function useEstimatedArrival(departureTime, origin, destination, bufferMinutes = 0) {
  const [driveMinutes, setDriveMinutes] = useState(null)
  const [estimating, setEstimating] = useState(false)
  const [retryTick, setRetryTick] = useState(0)

  // Stable primitive keys for the effect dependency array — origin/destination
  // are fresh object literals on every render in the caller, so depending on
  // the objects themselves would re-run this effect on every keystroke.
  const originKey = origin?.locationId || (origin?.coords ? `${origin.coords.lat},${origin.coords.lng}` : '')
  const destKey = destination?.locationId || (destination?.coords ? `${destination.coords.lat},${destination.coords.lng}` : '')

  useEffect(() => {
    if (!originKey || !destKey) {
      setDriveMinutes(null)
      return
    }
    let cancelled = false

    const run = async () => {
      try {
        if (origin.locationId && destination.locationId) {
          const minutes = await getDriveMinutes(origin.locationId, destination.locationId)
          if (!cancelled) setDriveMinutes(minutes)
          return
        }
        if (origin.coords && destination.coords) {
          setEstimating(true)
          const token = await auth.currentUser?.getIdToken()
          const res = await fetch('/api/estimate-drive-time', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ origin: origin.coords, destination: destination.coords }),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(data.error || 'drive time estimate request failed')
          if (!cancelled) setDriveMinutes(data.minutes)
          return
        }
        // Mixed pair missing coords on one side (e.g. a predefined location
        // doc without lat/lon) — nothing to estimate from.
        if (!cancelled) setDriveMinutes(null)
      } catch (err) {
        if (cancelled) return
        console.error('[useEstimatedArrival] failed to estimate drive time', err)
        if (retryTick < MAX_RETRIES) {
          setTimeout(() => { if (!cancelled) setRetryTick(t => t + 1) }, RETRY_DELAY_MS)
        }
      } finally {
        if (!cancelled) setEstimating(false)
      }
    }
    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originKey, destKey, retryTick])

  const arrivalTime = (departureTime && driveMinutes != null)
    ? addMinutesToTime(departureTime, driveMinutes + bufferMinutes)
    : null

  return { arrivalTime, driveMinutes, estimating }
}
