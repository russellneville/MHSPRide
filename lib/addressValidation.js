/**
 * Server-side address validation via Google Address Validation API.
 * Requires GOOGLE_MAPS_API_KEY env var (never expose to client). This is a
 * separate Cloud product from Geocoding/Directions APIs (see lib/geocodeAddress.js)
 * and needs its own enablement per Google Cloud project.
 */
export async function validateAddress(addressText) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY is not set')

  const res = await fetch(
    `https://addressvalidation.googleapis.com/v1:validateAddress?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: { regionCode: 'US', addressLines: [addressText] },
      }),
    }
  )
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error?.message || 'Address validation request failed')
  }

  return normalizeValidationResult(data.result)
}

// Normalizes Google's raw verdict/address/geocode shape down to the flat
// {status, formattedAddress, latitude, longitude} shape every caller (this
// codebase's hook today, any future React Native client tomorrow) actually
// needs — keeps verdict-interpretation logic in one place instead of
// re-deriving it on every consumer.
export function normalizeValidationResult(result) {
  const verdict = result?.verdict || {}
  const wasModified = !!(verdict.hasReplacedComponents || verdict.hasInferredComponents)
  const isUsable = verdict.addressComplete && !verdict.hasUnconfirmedComponents

  let status
  if (!isUsable) status = 'invalid'
  else if (wasModified) status = 'needs-confirmation'
  else status = 'confirmed'

  return {
    status, // 'confirmed' | 'needs-confirmation' | 'invalid'
    formattedAddress: result?.address?.formattedAddress || null,
    latitude: result?.geocode?.location?.latitude ?? null,
    longitude: result?.geocode?.location?.longitude ?? null,
  }
}
