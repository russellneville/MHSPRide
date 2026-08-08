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

/**
 * Places API (New) Text Search — resolves free-form queries the Address
 * Validation API can't handle. That API expects a structured mailing
 * address and marks anything else (a business name, "Safeway, Sandy OR")
 * unconfirmed/incomplete, i.e. 'invalid'. Text Search is built for exactly
 * this kind of query instead. Same GOOGLE_MAPS_API_KEY, different Cloud
 * product — Places API (New) needs its own enablement, same gotcha as
 * Address Validation.
 */
export async function searchPlaceText(query) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY is not set')

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.formattedAddress,places.location',
    },
    body: JSON.stringify({ textQuery: query, regionCode: 'US' }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error?.message || 'Place search request failed')
  }

  const place = data?.places?.[0]
  if (!place?.location) return null

  return {
    // A Places match is a located point, not a verified mailing address —
    // always surfaced as "Did you mean…" for the user to confirm, same as
    // validateAddress()'s own needs-confirmation branch.
    status: 'needs-confirmation',
    formattedAddress: place.formattedAddress || query,
    latitude: place.location.latitude,
    longitude: place.location.longitude,
  }
}

/**
 * What every caller actually wants: try Address Validation first — it's the
 * stronger signal, since an exact structured-address match auto-confirms
 * with no "Did you mean" step — and only fall back to Places Text Search
 * when that comes back invalid, since that's the case it's structurally
 * unable to handle (place names, unstructured queries) rather than a
 * genuinely bad address.
 */
export async function resolveAddress(addressText) {
  const validated = await validateAddress(addressText)
  if (validated.status !== 'invalid') return validated
  // Falls back to the original 'invalid' verdict rather than throwing —
  // Places API (New) needs its own separate enablement/key-restriction on
  // top of Address Validation's, so a not-yet-enabled project shouldn't
  // break address entry entirely, just miss out on the extra fallback.
  try {
    const placeResult = await searchPlaceText(addressText)
    return placeResult || validated
  } catch (error) {
    console.error('[resolveAddress] Places Text Search fallback failed', error)
    return validated
  }
}
