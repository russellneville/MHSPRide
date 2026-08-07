/**
 * seedTroopiterLocations.mjs
 *
 * Bootstraps the `locations`/`driveTimes` Firestore collections for the
 * Troopiter integration prototype (issue #199) by copying the live
 * production (mhspride) data into mhspride-troopiter — same approach as
 * syncLocationsToTest.mjs — with one rename: the "Timberline" destination
 * becomes "Armadillo", standing in for the fictional test resort used in
 * the Troopiter rehearsal roster. Every other location keeps its real
 * Portland-area address/coordinates and drive times unchanged, since the
 * Armadillo roster's addresses are themselves real Portland-area addresses
 * and stay consistent with these origins.
 *
 * Prerequisites:
 *   - scripts/serviceAccountKey.troopiter.json -> mhspride-troopiter service account (destination)
 *   - .env.local: PROD_FIREBASE_SERVICE_ACCOUNT_KEY (full mhspride service
 *     account JSON as a string, read-only use here)
 *
 * Usage:
 *   node scripts/seedTroopiterLocations.mjs
 *   node scripts/seedTroopiterLocations.mjs --dry-run
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { createRequire } from 'module'
import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
config({ path: resolve(__dirname, '../.env.local') })

const require = createRequire(import.meta.url)
const DRY_RUN = process.argv.includes('--dry-run')

const OLD_ID = 'timberline'
const NEW_ID = 'armadillo'
const NEW_NAME = 'Armadillo'

if (!process.env.PROD_FIREBASE_SERVICE_ACCOUNT_KEY) {
  console.error('❌  PROD_FIREBASE_SERVICE_ACCOUNT_KEY is not set in .env.local.')
  process.exit(1)
}
const prodServiceAccount = JSON.parse(process.env.PROD_FIREBASE_SERVICE_ACCOUNT_KEY)
const troopiterServiceAccount = require('./serviceAccountKey.troopiter.json')

if (prodServiceAccount.project_id !== 'mhspride') {
  console.error(`❌  PROD_FIREBASE_SERVICE_ACCOUNT_KEY points at project "${prodServiceAccount.project_id}", not "mhspride". Refusing to run.`)
  process.exit(1)
}
if (troopiterServiceAccount.project_id !== 'mhspride-troopiter') {
  console.error(`❌  scripts/serviceAccountKey.troopiter.json points at project "${troopiterServiceAccount.project_id}", not "mhspride-troopiter". Refusing to run.`)
  process.exit(1)
}

const prodApp = initializeApp({ credential: cert(prodServiceAccount) }, 'prod')
const troopiterApp = initializeApp({ credential: cert(troopiterServiceAccount) }, 'troopiter')

const prodDb = getFirestore(prodApp)
const troopiterDb = getFirestore(troopiterApp)

function renameId(id) {
  return id === OLD_ID ? NEW_ID : id
}

async function syncLocations() {
  const snap = await prodDb.collection('locations').get()
  console.log(`locations: ${snap.size} docs in prod`)

  const batch = troopiterDb.batch()
  snap.docs.forEach(d => {
    const data = d.data()
    const id = renameId(d.id)
    const renamed = id === NEW_ID ? { ...data, name: NEW_NAME } : data
    console.log(`  ${DRY_RUN ? '[dry] ' : ''}${d.id} -> ${id}${id !== d.id ? ` (renamed "${data.name}" -> "${NEW_NAME}")` : ''}`)
    if (!DRY_RUN) batch.set(troopiterDb.collection('locations').doc(id), renamed)
  })
  if (!DRY_RUN) {
    await batch.commit()
    console.log(`  synced ${snap.size} docs to mhspride-troopiter`)
  }
}

async function syncDriveTimes() {
  const snap = await prodDb.collection('driveTimes').get()
  console.log(`driveTimes: ${snap.size} docs in prod`)

  const batch = troopiterDb.batch()
  snap.docs.forEach(d => {
    const fromId = renameId(d.id)
    const times = d.data()
    const renamedTimes = Object.fromEntries(
      Object.entries(times).map(([toId, minutes]) => [renameId(toId), minutes])
    )
    console.log(`  ${DRY_RUN ? '[dry] ' : ''}${d.id} -> ${fromId}`)
    if (!DRY_RUN) batch.set(troopiterDb.collection('driveTimes').doc(fromId), renamedTimes)
  })
  if (!DRY_RUN) {
    await batch.commit()
    console.log(`  synced ${snap.size} docs to mhspride-troopiter`)
  }
}

async function syncSiteConfig() {
  const snap = await prodDb.collection('config').doc('site').get()
  if (!snap.exists) {
    console.log('config/site: no doc in prod, skipping')
    return
  }
  console.log('config/site: 1 doc in prod')
  if (!DRY_RUN) {
    await troopiterDb.collection('config').doc('site').set(snap.data())
    console.log('  synced config/site to mhspride-troopiter')
  }
}

async function main() {
  console.log(`=== Seeding locations/driveTimes/config.site: mhspride -> mhspride-troopiter (Timberline -> Armadillo)${DRY_RUN ? ' (DRY RUN)' : ''} ===\n`)
  await syncLocations()
  await syncDriveTimes()
  await syncSiteConfig()
  console.log(DRY_RUN ? '\n✓ Dry run complete.' : '\n✓ Seed complete.')
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err)
  process.exit(1)
})
