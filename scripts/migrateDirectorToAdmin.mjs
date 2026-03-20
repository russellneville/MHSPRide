/**
 * migrateDirectorToAdmin.mjs
 *
 * Reads all Firestore users with role === 'director' and updates them to role === 'admin'.
 *
 * Prerequisites:
 *   - Place your Firebase service account key at scripts/serviceAccountKey.json
 *
 * Usage:
 *   node scripts/migrateDirectorToAdmin.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const serviceAccount = require('./serviceAccountKey.json')

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

async function main() {
  const usersRef = db.collection('users')
  const snapshot = await usersRef.where('role', '==', 'director').get()

  if (snapshot.empty) {
    console.log('No users with role === "director" found.')
    return
  }

  console.log(`Found ${snapshot.size} director user(s). Migrating to admin...`)

  const batch = db.batch()
  snapshot.docs.forEach(docSnap => {
    batch.update(docSnap.ref, { role: 'admin' })
  })

  await batch.commit()
  console.log(`Done. ${snapshot.size} user(s) updated to role === "admin".`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
