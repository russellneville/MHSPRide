import { NextResponse } from 'next/server'
import { recordAttempt, getClientIp } from '@/lib/rateLimit'

const MIN_SIZE = 64
const MAX_SIZE = 640
const STATIC_MAP_IP_LIMIT = { limit: 60, windowMs: 60 * 60 * 1000 }

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

// Unauthenticated twin of app/api/static-map — the shift demo page
// deliberately has no MHSP Ride login (same reasoning as
// troopiter-demo/mint and troopiter-demo/validate-address), so this gates
// on an IP rate limit instead of verifyAuthRequest.
export async function GET(request) {
  const ip = getClientIp(request)
  const { blocked } = await recordAttempt({ key: `troopiter-demo-static-map:ip:${ip}`, ...STATIC_MAP_IP_LIMIT })
  if (blocked) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
  }

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

  const params = new URLSearchParams({
    size: `${width}x${height}`,
    scale: '2',
    center: `${originLat},${originLng}`,
    zoom: '14',
    key: apiKey,
  })
  params.append('markers', `color:0x16a34a|${originLat},${originLng}`)

  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`)
    if (!res.ok) {
      console.error('[troopiter-demo/static-map] Google Static Maps API error', res.status, await res.text().catch(() => ''))
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
    console.error('[troopiter-demo/static-map]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
