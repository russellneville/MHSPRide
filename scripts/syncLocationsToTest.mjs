/**
 * syncLocationsToTest.mjs
 *
 * Copies the live `locations` and `driveTimes` Firestore collections from
 * production (mhspride) into the test project (mhspride-test), plus
 * `config/site` (the support-form recipient address). These are
 * admin-UI-managed reference data (app/api/admin/locations/*, lib/drive-times.js)
 * that the original one-time migrateLocationsToFirestore.mjs snapshot (issue
 * #66) has long since drifted from — locations get added/renamed/re-roled
 * through the admin Locations page in prod, and none of that carries over to
 * mhspride-test automatically (issue #191). Safe to re-run any time prod's
 * locations change and test needs to catch back up — every write is a full
 * overwrite (.set(), not .update()) so test always ends up an exact mirror.
 *
 * Does NOT touch config/maintenance — its absence in test is already a safe
 * default (maintenance mode off), and prod's current doc is leftover test
 * data from when that feature was verified, not real prod config worth mirroring.
 *
 * Prerequisites:
 *   - scripts/serviceAccountKey.json -> mhspride-test service account (destination)
 *   - .env.local: PROD_FIREBASE_SERVICE_ACCOUNT_KEY (full mhspride service
 *     account JSON as a string, read-only use here — same convention as
 *     scripts/migrateAuthUsers.mjs)
 *
 * Usage:
 *   node scripts/syncLocationsToTest.mjs
 *   node scripts/syncLocationsToTest.mjs --dry-run
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { createRequire } from 'module'
import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { assertTestProject } from './lib/assertTestProject.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
config({ path: resolve(__dirname, '../.env.local') })

const require = createRequire(import.meta.url)
const DRY_RUN = process.argv.includes('--dry-run')

if (!process.env.PROD_FIREBASE_SERVICE_ACCOUNT_KEY) {
  console.error('❌  PROD_FIREBASE_SERVICE_ACCOUNT_KEY is not set in .env.local. Copy the full mhspride service account JSON in as a string.')
  process.exit(1)
}
let prodServiceAccount, testServiceAccount
try {
  prodServiceAccount = JSON.parse(process.env.PROD_FIREBASE_SERVICE_ACCOUNT_KEY)
} catch {
  console.error('❌  PROD_FIREBASE_SERVICE_ACCOUNT_KEY in .env.local is not valid JSON.')
  process.exit(1)
}
try {
  testServiceAccount = require('./serviceAccountKey.json')
} catch {
  console.error('❌  scripts/serviceAccountKey.json not found (should be the mhspride-test service account).')
  process.exit(1)
}

if (prodServiceAccount.project_id !== 'mhspride') {
  console.error(`❌  PROD_FIREBASE_SERVICE_ACCOUNT_KEY points at project "${prodServiceAccount.project_id}", not "mhspride". Refusing to run.`)
  process.exit(1)
}
assertTestProject(testServiceAccount)

const prodApp = initializeApp({ credential: cert(prodServiceAccount) }, 'prod')
const testApp = initializeApp({ credential: cert(testServiceAccount) }, 'test')

const prodDb = getFirestore(prodApp)
const testDb = getFirestore(testApp)

async function syncCollection(name) {
  const snap = await prodDb.collection(name).get()
  console.log(`${name}: ${snap.size} docs in prod`)

  if (DRY_RUN) {
    snap.docs.forEach(d => console.log(`  [dry] ${name}/${d.id}`))
    return
  }

  const batch = testDb.batch()
  snap.docs.forEach(d => batch.set(testDb.collection(name).doc(d.id), d.data()))
  await batch.commit()
  console.log(`  synced ${snap.size} docs to mhspride-test`)
}

async function syncSiteConfig() {
  const snap = await prodDb.collection('config').doc('site').get()
  if (!snap.exists) {
    console.log('config/site: no doc in prod, skipping')
    return
  }
  console.log('config/site: 1 doc in prod')
  if (DRY_RUN) {
    console.log('  [dry] config/site')
    return
  }
  await testDb.collection('config').doc('site').set(snap.data())
  console.log('  synced config/site to mhspride-test')
}

async function main() {
  console.log(`=== Syncing locations/driveTimes/config.site: mhspride → mhspride-test${DRY_RUN ? ' (DRY RUN)' : ''} ===\n`)
  await syncCollection('locations')
  await syncCollection('driveTimes')
  await syncSiteConfig()
  console.log(DRY_RUN ? '\n✓ Dry run complete.' : '\n✓ Sync complete.')
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err)
  process.exit(1)
})
