/**
 * promoteSuperAdmin.mjs
 *
 * Sets a user's role to 'super-admin' by email. Useful for bootstrapping the
 * first super-admin (issue #107) — there's no in-app way to grant that role
 * since it's the role that's allowed to grant it.
 *
 * Prerequisites:
 *   - Place your Firebase service account key at scripts/serviceAccountKey.json
 *
 * Usage:
 *   node scripts/promoteSuperAdmin.mjs someone@example.com
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const serviceAccount = require('./serviceAccountKey.json')

const email = process.argv[2]
if (!email) {
  console.error('Usage: node scripts/promoteSuperAdmin.mjs <email>')
  process.exit(1)
}

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

async function main() {
  const snapshot = await db.collection('users').where('email', '==', email).limit(1).get()

  if (snapshot.empty) {
    console.log(`No user found with email ${email}.`)
    return
  }

  const docSnap = snapshot.docs[0]
  await docSnap.ref.update({ role: 'super-admin' })
  console.log(`Done. ${email} (${docSnap.id}) is now role === "super-admin".`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
