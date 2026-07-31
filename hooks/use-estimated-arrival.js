import { useEffect, useState } from "react"
import { estimateArrival } from "@/lib/drive-times"

const RETRY_DELAY_MS = 3000
const MAX_RETRIES = 5

// Shared by OfferRidePopup and EditRidePopup: recomputes arrival time from
// departure time + origin/destination ids. A transient getDoc() failure (e.g.
// a network blip) used to leave arrival_time stuck with no visible error and
// no way to recover short of the caller re-picking a location (issue #149) —
// this retries a bounded number of times instead of failing silently forever.
export function useEstimatedArrival(departureTime, fromId, toId) {
  const [arrivalTime, setArrivalTime] = useState(null)
  const [retryTick, setRetryTick] = useState(0)

  useEffect(() => {
    if (!departureTime || !fromId || !toId) return
    let cancelled = false
    estimateArrival(departureTime, fromId, toId)
      .then(est => { if (!cancelled) setArrivalTime(est) })
      .catch(err => {
        if (cancelled) return
        console.error('[useEstimatedArrival] failed to estimate arrival time', err)
        if (retryTick < MAX_RETRIES) {
          setTimeout(() => { if (!cancelled) setRetryTick(t => t + 1) }, RETRY_DELAY_MS)
        }
      })
    return () => { cancelled = true }
  }, [departureTime, fromId, toId, retryTick])

  return arrivalTime
}
