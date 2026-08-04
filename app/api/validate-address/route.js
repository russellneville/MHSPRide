import { NextResponse } from 'next/server'
import { verifyAuthRequest } from '@/lib/adminAuth'
import { validateAddress } from '@/lib/addressValidation'

export async function POST(request) {
  const auth = await verifyAuthRequest(request)
  if (auth.error) return auth.error

  try {
    const { address } = await request.json()
    if (!address?.trim()) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    }

    const result = await validateAddress(address.trim())
    return NextResponse.json(result)
  } catch (error) {
    // Full detail (Google's raw error, which can include our Cloud project
    // id and an "enable this API" console URL) is logged here for
    // debugging, not sent to the client — that's internal infra detail, not
    // something a rider/driver should see.
    console.error('[validate-address]', error)
    return NextResponse.json({ error: 'Could not validate that address right now. Please try again shortly.' }, { status: 500 })
  }
}
