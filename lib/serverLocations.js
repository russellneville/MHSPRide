/**
 * Server-side (Admin SDK) location name lookups — for code that runs outside
 * a React tree (email templates, etc.) and can't use context/LocationsContext's
 * useLocations() hook. Cached per warm serverless instance, same pattern as
 * lib/firebaseAdmin.js's app singleton.
 */
import { getAdminDb } from './firebaseAdmin'

let cache = null

async function loadLocationNames() {
  if (cache) return cache
  const snap = await getAdminDb().collection('locations').get()
  cache = new Map(snap.docs.map(d => [d.id, d.data().name]))
  return cache
}

function prettify(id) {
  return id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export async function resolveLocationServer(id) {
  if (!id) return id
  const names = await loadLocationNames()
  return names.get(id) || prettify(id)
}
