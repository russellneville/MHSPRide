'use client'
import { useEffect, useState } from "react"
import { auth } from "@/lib/firebaseClient"
import { mapsPinUrl, mapsDirectionsUrl, staticMapPreviewUrl } from "@/lib/mapLinks"
import { MapPin } from "lucide-react"

// Renders a small static map image — origin pin only, always — that
// deep-links out to Google Maps. The thumbnail itself doesn't change by
// role ("We show just the origin pin, which I think we should"); only the
// click-through link does: riders and admins get a single-pin search link
// (mapsPinUrl) since they're checking a location, not navigating. Drivers
// get full origin->destination turn-by-turn directions (mapsDirectionsUrl)
// instead, so tapping it starts real navigation. See
// resources/address-validation-implementation.md, "Deferred to phase 2",
// for why these need two different link shapes.
//
// Renders nothing when origin coords are unavailable — rides saved before
// this feature shipped, or a free-text location that was never
// re-confirmed, have no lat/lng to show a map for (same graceful
// degradation as calendarLocation in the ride detail page).
export default function RideMapPreview({ origin, destination, isDriver, width = 320, height = 160, className = '' }) {
  const [imgSrc, setImgSrc] = useState(null)
  const [failed, setFailed] = useState(false)

  const hasOrigin = origin?.lat != null && origin?.lng != null
  const previewUrl = hasOrigin ? staticMapPreviewUrl({ origin, width, height }) : null

  useEffect(() => {
    if (!previewUrl) return
    let objectUrl
    let cancelled = false
    setFailed(false)
    setImgSrc(null)
    ;(async () => {
      try {
        const token = await auth.currentUser?.getIdToken()
        const res = await fetch(previewUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        if (!res.ok) throw new Error('map image request failed')
        const blob = await res.blob()
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setImgSrc(objectUrl)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [previewUrl])

  if (!hasOrigin || failed) return null

  const hasDestination = destination?.lat != null && destination?.lng != null
  const mapsUrl = isDriver && hasDestination ? mapsDirectionsUrl(origin, destination) : mapsPinUrl(origin)
  const openMaps = (e) => {
    // Not a real <a> — this renders inside NetworkRideCard, itself wrapped
    // in a Next.js <Link>, and nested anchors are invalid HTML (React
    // throws a hydration error for it). window.open() gets the same
    // new-tab behavior without nesting.
    e.stopPropagation()
    e.preventDefault()
    window.open(mapsUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={openMaps}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openMaps(e) }}
      title={isDriver && hasDestination ? "Open directions in Google Maps" : "Open in Google Maps"}
      className={`block rounded-md overflow-hidden border border-border bg-muted shrink-0 cursor-pointer ${className}`}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {imgSrc ? (
        <img src={imgSrc} alt="Map preview" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          <MapPin className="size-5 animate-pulse" />
        </div>
      )}
    </div>
  )
}
