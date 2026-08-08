'use client'
import { useEffect, useState } from "react"
import { auth } from "@/lib/firebaseClient"
import { MapPin } from "lucide-react"

// Small static map thumbnail shown alongside a "Did you mean…" address
// confirmation, so the user can visually check the pin lands where they
// expect before accepting it. requiresAuth picks the proxy route — the
// shift demo page validates addresses with no MHSP Ride login (see
// /api/troopiter-demo/static-map), same reasoning as its own
// validate-address route; everywhere else uses the authenticated
// /api/static-map (mirrors RideMapPreview's fetch-as-blob pattern, since
// <img src> can't carry the Authorization header the proxy requires).
export function AddressConfirmMap({ lat, lng, requiresAuth = true, width = 280, height = 120 }) {
  const [imgSrc, setImgSrc] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (lat == null || lng == null) return
    let objectUrl
    let cancelled = false
    setFailed(false)
    setImgSrc(null)
    ;(async () => {
      try {
        const params = new URLSearchParams({ originLat: lat, originLng: lng, width, height })
        const url = `${requiresAuth ? '/api/static-map' : '/api/troopiter-demo/static-map'}?${params.toString()}`
        const headers = {}
        if (requiresAuth) {
          const token = await auth.currentUser?.getIdToken()
          if (token) headers.Authorization = `Bearer ${token}`
        }
        const res = await fetch(url, { headers })
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
  }, [lat, lng, requiresAuth, width, height])

  if (lat == null || lng == null || failed) return null

  return (
    <div
      className="rounded overflow-hidden border border-amber-300 dark:border-amber-800 bg-muted"
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {imgSrc ? (
        <img src={imgSrc} alt="Map preview of suggested address" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          <MapPin className="size-4 animate-pulse" />
        </div>
      )}
    </div>
  )
}
