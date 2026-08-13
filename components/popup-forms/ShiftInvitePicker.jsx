import { useEffect, useRef, useState } from "react"
import { setOptions, importLibrary } from "@googlemaps/js-api-loader"
import { auth } from "@/lib/firebaseClient"
import { Checkbox } from "../ui/checkbox"
import { Label } from "../ui/label"
import { Loader2, Star } from "lucide-react"

const GOLD_STAR_ICON = {
  url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#eab308" stroke="#a16207" stroke-width="1"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>'
  ),
  scaledSize: { width: 30, height: 30 },
}

// setOptions() is global/idempotent-ish (warns on a second call with
// different options) — guard so re-mounting this popup across multiple
// Offer/Request Ride opens doesn't reconfigure or re-fetch the script.
let mapsLibrariesPromise = null
function loadMapLibraries(apiKey) {
  if (!mapsLibrariesPromise) {
    setOptions({ key: apiKey, v: 'weekly' })
    mapsLibrariesPromise = Promise.all([importLibrary('maps'), importLibrary('marker')])
  }
  return mapsLibrariesPromise
}

// Shift-member map picker (issue #225): lets an offering driver pick riders
// to invite, or a requesting rider pick drivers to ask, from the shift's own
// roster. Pins come from /api/shift-roster-pins, which prefers a member's own
// confirmed users/{uid} address over whatever Troopiter's launch payload last
// sent for them (see that route's comment). Entirely optional — posting
// without selecting anyone behaves exactly as it did before this feature.
export function ShiftInvitePicker({ shiftDocId, excludeEmail, favoriteIds, value, onChange }) {
  const [roster, setRoster] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [mapError, setMapError] = useState(false)
  const mapContainerRef = useRef(null)
  const markersRef = useRef(new Map())

  useEffect(() => {
    let cancelled = false
    setRoster(null)
    setLoadError(false)
    ;(async () => {
      try {
        const token = await auth.currentUser?.getIdToken()
        const res = await fetch('/api/shift-roster-pins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ shiftDocId }),
        })
        if (!res.ok) throw new Error('failed to load roster')
        const data = await res.json()
        if (!cancelled) setRoster((data.roster || []).filter(m => m.email !== excludeEmail))
      } catch {
        if (!cancelled) setLoadError(true)
      }
    })()
    return () => { cancelled = true }
  }, [shiftDocId, excludeEmail])

  const selected = new Set(value)
  const toggle = (email) => {
    onChange(selected.has(email) ? value.filter(e => e !== email) : [...value, email])
  }

  // Builds the map once the roster's loaded — separate effect so a later
  // toggle (which only changes `value`) doesn't rebuild markers from scratch,
  // just updates their opacity below.
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey || !roster || !mapContainerRef.current) return
    const plottable = roster.filter(m => m.hasPlottableLocation)
    if (plottable.length === 0) return

    let cancelled = false
    loadMapLibraries(apiKey).then(([{ Map: GoogleMap }, { Marker }]) => {
      if (cancelled || !mapContainerRef.current) return
      const map = new GoogleMap(mapContainerRef.current, {
        streetViewControl: false,
        fullscreenControl: false,
      })
      const bounds = new window.google.maps.LatLngBounds()
      markersRef.current = new globalThis.Map()
      plottable.forEach(member => {
        const position = { lat: member.latitude, lng: member.longitude }
        const isFavorite = member.uid && favoriteIds?.has(member.uid)
        const marker = new Marker({
          map,
          position,
          title: member.name,
          icon: isFavorite ? GOLD_STAR_ICON : undefined,
          opacity: selected.has(member.email) ? 1 : 0.6,
        })
        marker.addListener('click', () => toggle(member.email))
        markersRef.current.set(member.email, marker)
        bounds.extend(position)
      })
      map.fitBounds(bounds)
      window.google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
        if (map.getZoom() > 15) map.setZoom(15)
      })
    }).catch(() => { if (!cancelled) setMapError(true) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster])

  // Keeps marker opacity in sync with selection without rebuilding markers.
  useEffect(() => {
    markersRef.current.forEach?.((marker, email) => {
      marker.setOpacity(selected.has(email) ? 1 : 0.6)
    })
  }, [value])

  if (loadError || (roster && roster.length === 0)) return null

  return (
    <div className="space-y-2 border-t border-border pt-4">
      <Label>Invite people from this shift (optional)</Label>
      {!roster ? (
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          <Loader2 className="size-3.5 animate-spin" /> Loading shift roster…
        </p>
      ) : (
        <>
          {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && !mapError && roster.some(m => m.hasPlottableLocation) && (
            <div ref={mapContainerRef} className="h-56 w-full rounded-md border border-border" />
          )}
          <div className="max-h-40 overflow-y-auto space-y-1 rounded-md border border-border p-2">
            {roster.map(member => (
              <label key={member.email} className="flex items-center gap-2 text-sm cursor-pointer select-none py-0.5">
                <Checkbox checked={selected.has(member.email)} onCheckedChange={() => toggle(member.email)} />
                <span className="flex-1">{member.name || member.email}</span>
                {member.uid && favoriteIds?.has(member.uid) && (
                  <Star className="size-3.5 fill-yellow-500 text-yellow-500" />
                )}
                {!member.hasPlottableLocation && (
                  <span className="text-xs text-muted-foreground">no location on file</span>
                )}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
