/**
 * Firebase Admin SDK singleton for server-side API routes.
 * Requires FIREBASE_SERVICE_ACCOUNT_KEY env var — the full service account
 * JSON encoded as a string (copy the JSON, paste as the env value).
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0]

  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (!key) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not set')

  return initializeApp({ credential: cert(JSON.parse(key)) })
}

export function getAdminDb() {
  return getFirestore(getAdminApp())
}
