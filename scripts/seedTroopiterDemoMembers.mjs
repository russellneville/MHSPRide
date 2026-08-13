/**
 * seedTroopiterDemoMembers.mjs
 *
 * Seeds synthetic @example.com members into Firestore's `members` collection
 * for use by the /troopiter-shift-demo page. That page is unauthenticated by
 * design (it mimics an external site visitors haven't logged into yet), and
 * its roster/mint routes draw from `members` — which is really MHSP's own
 * live patrol data, not a dedicated Armadillo Mountain roster (multi-tenancy
 * isn't built yet). Both routes now filter to the maintainer's real account
 * plus @example.com addresses (see lib/troopiterTestSigning.js's
 * isDemoAllowedEmail), so without this seed the demo has no companions to
 * pick from at all.
 *
 * Addresses/coordinates are hand-picked Portland-metro-area points, spread
 * out enough to be visually distinct on the shift-member map picker
 * (issue #225) — not geocoded, just plausible.
 *
 * Prerequisites:
 *   - .env.local: FIREBASE_SERVICE_ACCOUNT_KEY (mhspride-test service account)
 *
 * Usage:
 *   node scripts/seedTroopiterDemoMembers.mjs
 *   node scripts/seedTroopiterDemoMembers.mjs --dry-run
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { assertTestProject } from './lib/assertTestProject.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
config({ path: resolve(__dirname, '../.env.local') })

const DRY_RUN = process.argv.includes('--dry-run')

if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  console.error('❌  FIREBASE_SERVICE_ACCOUNT_KEY is not set in .env.local')
  process.exit(1)
}
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
assertTestProject(serviceAccount)

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const SYNTHETIC_MEMBERS = [
  { firstName: 'Alex',    lastName: 'Rivera',   email: 'alex.rivera@example.com',   address: '1151 SW Vermont St, Portland, OR 97219',   latitude: 45.4805, longitude: -122.6957 },
  { firstName: 'Jordan',  lastName: 'Kim',      email: 'jordan.kim@example.com',    address: '2025 N Expo Rd, Portland, OR 97217',        latitude: 45.5849, longitude: -122.6989 },
  { firstName: 'Sam',     lastName: 'Patel',    email: 'sam.patel@example.com',     address: '1000 SE Tacoma St, Portland, OR 97202',     latitude: 45.4712, longitude: -122.6534 },
  { firstName: 'Taylor',  lastName: 'Nguyen',   email: 'taylor.nguyen@example.com', address: '5000 NE 33rd Ave, Portland, OR 97211',      latitude: 45.5613, longitude: -122.6280 },
  { firstName: 'Morgan',  lastName: 'Brooks',   email: 'morgan.brooks@example.com', address: '3181 SW Sam Jackson Park Rd, Portland, OR 97239', latitude: 45.4989, longitude: -122.6858 },
  { firstName: 'Casey',   lastName: 'Ortiz',    email: 'casey.ortiz@example.com',   address: '600 NE Grand Ave, Portland, OR 97232',      latitude: 45.5286, longitude: -122.6551 },
  // No coordinates — exercises the "no location on file" fallback in the
  // shift-member map picker (issue #225).
  { firstName: 'Riley',   lastName: 'Chen',     email: 'riley.chen@example.com',    address: '', latitude: null, longitude: null },
]

async function main() {
  console.log(`=== Seeding ${SYNTHETIC_MEMBERS.length} synthetic @example.com members${DRY_RUN ? ' (DRY RUN)' : ''} ===\n`)

  const batch = db.batch()
  for (const m of SYNTHETIC_MEMBERS) {
    const doc = {
      firstName: m.firstName,
      lastName: m.lastName,
      email: m.email,
      status: 'Active',
      classifications: [],
      address: m.address,
      latitude: m.latitude,
      longitude: m.longitude,
      active: true,
      claimed: false,
    }
    console.log(`  ${DRY_RUN ? '[dry] ' : ''}${m.email} (${m.firstName} ${m.lastName})`)
    if (!DRY_RUN) batch.set(db.collection('members').doc(m.email), doc, { merge: true })
  }

  if (!DRY_RUN) {
    await batch.commit()
    console.log(`\n✓ Seeded ${SYNTHETIC_MEMBERS.length} synthetic members.`)
  } else {
    console.log('\n✓ Dry run complete.')
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err)
  process.exit(1)
})
