/**
 * Pure, framework-agnostic Google Maps link/URL builders shared by the ride
 * card, ride detail page, and admin ride popup — and portable as-is to a
 * future React Native client, which needs the exact same URL shapes to open
 * the native Google Maps app via a deep link.
 *
 * A "point" is { lat, lng, address }: lat/lng are preferred when present
 * (validated/predefined ride locations), falling back to the free-text
 * address string for rides saved before coordinates were captured — same
 * graceful-degradation precedent as calendarLocation in the ride detail page.
 */

function pointQuery({ lat, lng, address } = {}) {
  if (lat != null && lng != null) return `${lat},${lng}`
  return address || null
}

// Single-pin link — used for the rider and admin views, who are checking a
// location, not navigating to it. Precedent: googleMapsUrl() in
// app/dashboard/admin/locations/page.jsx (lat/lon args only); this
// generalizes it to also accept an address-string fallback.
export function mapsPinUrl(point) {
  const query = pointQuery(point)
  if (!query) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

// Origin+destination turn-by-turn directions link — used for the driver
// view. A genuinely different URL shape from mapsPinUrl, not an extension of
// it (see resources/address-validation-implementation.md, "Deferred to
// phase 2").
export function mapsDirectionsUrl(origin, destination) {
  const originQuery = pointQuery(origin)
  const destQuery = pointQuery(destination)
  if (!originQuery || !destQuery) return null
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originQuery)}&destination=${encodeURIComponent(destQuery)}&travelmode=driving`
}

// Builds the relative URL for our own /api/static-map proxy (never Google's
// Static Maps URL directly — that would put GOOGLE_MAPS_API_KEY in
// client-visible markup). Origin pin only, always — the thumbnail itself
// doesn't vary by viewer role, only the click-through link does (mapsPinUrl
// vs mapsDirectionsUrl above). Per the explicit design decision: "We show
// just the origin pin, which I think we should."
export function staticMapPreviewUrl({ origin, width = 320, height = 160 } = {}) {
  if (origin?.lat == null || origin?.lng == null) return null

  const params = new URLSearchParams()
  params.set('originLat', origin.lat)
  params.set('originLng', origin.lng)
  params.set('width', width)
  params.set('height', height)
  return `/api/static-map?${params.toString()}`
}
