import { NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/adminAuth'
import { geocodeAddress } from '@/lib/geocodeAddress'

export async function POST(request) {
  const auth = await verifyAdminRequest(request)
  if (auth.error) return auth.error

  try {
    const { address } = await request.json()
    if (!address?.trim()) {
      return NextResponse.json({ error: 'address is required' }, { status: 400 })
    }

    const coords = await geocodeAddress(address)
    return NextResponse.json(coords)
  } catch (error) {
    console.error('[admin/geocode]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
