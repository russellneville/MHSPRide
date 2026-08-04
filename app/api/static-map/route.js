import { NextResponse } from 'next/server'
import { verifyAuthRequest } from '@/lib/adminAuth'

const MIN_SIZE = 64
const MAX_SIZE = 640

function parseCoord(value, min, max) {
  if (value == null) return null
  const n = Number(value)
  if (!Number.isFinite(n) || n < min || n > max) return null
  return n
}

function clampSize(value, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(n)))
}

// Proxies Google's Static Maps API so GOOGLE_MAPS_API_KEY never appears in
// client-rendered markup (an <img src="...&key=..."> would leak a paid,
// billable key to anyone viewing page source or the network tab). Requires
// auth like every other ride-data-adjacent route — the client fetches this
// with an Authorization header and renders the returned bytes via an object
// URL rather than using this route directly as an <img src>, since <img>
// requests can't carry custom headers.
export async function GET(request) {
  const auth = await verifyAuthRequest(request)
  if (auth.error) return auth.error

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GOOGLE_MAPS_API_KEY is not set' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const originLat = parseCoord(searchParams.get('originLat'), -90, 90)
  const originLng = parseCoord(searchParams.get('originLng'), -180, 180)
  const width = clampSize(searchParams.get('width'), 320)
  const height = clampSize(searchParams.get('height'), 160)

  if (originLat == null || originLng == null) {
    return NextResponse.json({ error: 'originLat/originLng are required' }, { status: 400 })
  }

  // Origin pin only — the thumbnail never shows a route or second marker,
  // regardless of viewer role (see lib/mapLinks.js). A single marker gives
  // Google nothing to auto-fit a bounding box to, so center/zoom are explicit.
  const params = new URLSearchParams({
    size: `${width}x${height}`,
    scale: '2', // sharp on high-DPI phone screens
    center: `${originLat},${originLng}`,
    zoom: '14',
    key: apiKey,
  })
  params.append('markers', `color:0x16a34a|${originLat},${originLng}`)

  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`)
    if (!res.ok) {
      console.error('[static-map] Google Static Maps API error', res.status, await res.text().catch(() => ''))
      return NextResponse.json({ error: 'Could not load map image' }, { status: 502 })
    }
    const imageBuffer = await res.arrayBuffer()
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': res.headers.get('content-type') || 'image/png',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.error('[static-map]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
