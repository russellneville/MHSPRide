import { NextResponse } from 'next/server'
import { verifyAuthRequest } from '@/lib/adminAuth'
import { estimateDriveMinutes } from '@/lib/driveTimeDirections'

export async function POST(request) {
  const auth = await verifyAuthRequest(request)
  if (auth.error) return auth.error

  try {
    const { origin, destination } = await request.json()
    if (origin?.lat == null || origin?.lng == null || destination?.lat == null || destination?.lng == null) {
      return NextResponse.json({ error: 'origin and destination coordinates are required' }, { status: 400 })
    }

    const minutes = await estimateDriveMinutes(origin, destination)
    return NextResponse.json({ minutes })
  } catch (error) {
    // Full detail logged server-side only — see app/api/validate-address/route.js
    // for why raw upstream error text shouldn't reach the client.
    console.error('[estimate-drive-time]', error)
    return NextResponse.json({ error: 'Could not estimate drive time right now.' }, { status: 500 })
  }
}
