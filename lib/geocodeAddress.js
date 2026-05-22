/**
 * Server-side geocoding via Google Geocoding API.
 * Requires GOOGLE_MAPS_API_KEY env var (never expose to client).
 */
export async function geocodeAddress(address) {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) throw new Error('GOOGLE_MAPS_API_KEY is not set')

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`
  const res = await fetch(url)
  const data = await res.json()

  if (data.status !== 'OK' || !data.results?.[0]) {
    throw new Error(`Geocoding failed for "${address}": ${data.status}`)
  }

  const { lat, lng } = data.results[0].geometry.location
  return { latitude: lat, longitude: lng }
}
