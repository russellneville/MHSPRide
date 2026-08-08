/**
 * Address validation for the mock Troopiter shift page (issue #199) —
 * app/api/validate-address requires an MHSP Ride sign-in via
 * verifyAuthRequest, but the shift demo page deliberately has none (it
 * simulates an external, not-yet-logged-into-MHSP-Ride site, same reasoning
 * as app/api/troopiter-demo/mint). This just wraps the same
 * lib/addressValidation.js call behind an IP rate limit instead of auth.
 */
import { NextResponse } from 'next/server'
import { resolveAddress } from '@/lib/addressValidation'
import { recordAttempt, getClientIp } from '@/lib/rateLimit'

const VALIDATE_IP_LIMIT = { limit: 40, windowMs: 60 * 60 * 1000 }

export async function POST(request) {
  const ip = getClientIp(request)
  const { blocked } = await recordAttempt({ key: `troopiter-demo-validate:ip:${ip}`, ...VALIDATE_IP_LIMIT })
  if (blocked) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
  }

  try {
    const { address } = await request.json()
    if (!address?.trim()) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    }

    const result = await resolveAddress(address.trim())
    return NextResponse.json(result)
  } catch (error) {
    console.error('[troopiter-demo/validate-address]', error)
    return NextResponse.json({ error: 'Could not validate that address right now. Please try again shortly.' }, { status: 500 })
  }
}
