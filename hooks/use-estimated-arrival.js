import { useEffect, useState } from "react"
import { estimateArrival, addMinutesToTime } from "@/lib/drive-times"
import { auth } from "@/lib/firebaseClient"

const RETRY_DELAY_MS = 3000
const MAX_RETRIES = 5

// Shared by OfferRidePopup and EditRidePopup: recomputes arrival time from
// departure time + origin/destination. `origin`/`destination` are each
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
// leaves arrival_time unset, same as an unconfigured precomputed pair.
export function useEstimatedArrival(departureTime, origin, destination) {
  const [arrivalTime, setArrivalTime] = useState(null)
  const [estimating, setEstimating] = useState(false)
  const [retryTick, setRetryTick] = useState(0)

  // Stable primitive keys for the effect dependency array — origin/destination
  // are fresh object literals on every render in the caller, so depending on
  // the objects themselves would re-run this effect on every keystroke.
  const originKey = origin?.locationId || (origin?.coords ? `${origin.coords.lat},${origin.coords.lng}` : '')
  const destKey = destination?.locationId || (destination?.coords ? `${destination.coords.lat},${destination.coords.lng}` : '')

  useEffect(() => {
    if (!departureTime || !originKey || !destKey) {
      setArrivalTime(null)
      return
    }
    let cancelled = false

    const run = async () => {
      try {
        if (origin.locationId && destination.locationId) {
          const est = await estimateArrival(departureTime, origin.locationId, destination.locationId)
          if (!cancelled) setArrivalTime(est)
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
          if (!cancelled) setArrivalTime(addMinutesToTime(departureTime, data.minutes))
          return
        }
        // Mixed pair missing coords on one side (e.g. a predefined location
        // doc without lat/lon) — nothing to estimate from.
        if (!cancelled) setArrivalTime(null)
      } catch (err) {
        if (cancelled) return
        console.error('[useEstimatedArrival] failed to estimate arrival time', err)
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
  }, [departureTime, originKey, destKey, retryTick])

  return { arrivalTime, estimating }
}
