/**
 * mintTestLaunchToken.mjs
 *
 * Simulates Troopiter's signing step (issue #199, "Testing before
 * carpool.troopiter.com is configured") — builds the same launch payload
 * shape described in integration-proposal.md's "Sequence" section, signs it
 * with the throwaway RS256 test key (scripts/generateTroopiterTestKeypair.mjs),
 * and prints the troopiter.mhspride.com/launch#token=... URL to open by hand.
 * This exercises the real verify -> identity-match -> custom-token sign-in
 * pipeline without depending on Troopiter's team, and doubles as the
 * reference payload to hand them once real integration starts.
 *
 * Signing itself lives in lib/troopiterTestSigning.js, shared with
 * app/api/troopiter-demo/mint/route.js (the mock shift page's "Get a Ride"
 * button) so the two entry points can't drift on payload/signing shape.
 *
 * Prerequisites:
 *   - .env.local: TROOPITER_TEST_PRIVATE_KEY (scripts/generateTroopiterTestKeypair.mjs)
 *
 * Usage:
 *   node scripts/mintTestLaunchToken.mjs [email] [fullname]
 *   node scripts/mintTestLaunchToken.mjs someone@example.com "Someone Person"
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { signTestLaunchToken, readPemEnv } from '../lib/troopiterTestSigning.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
config({ path: resolve(__dirname, '../.env.local') })

const LAUNCH_HOST = process.env.TROOPITER_LAUNCH_HOST || 'troopiter.mhspride.com'

const email = process.argv[2] || 'russellneville@gmail.com'
const fullname = process.argv[3] || 'Russell Neville (admin)'

if (!process.env.TROOPITER_TEST_PRIVATE_KEY) {
  console.error('❌  TROOPITER_TEST_PRIVATE_KEY is not set in .env.local. Run scripts/generateTroopiterTestKeypair.mjs first.')
  process.exit(1)
}

async function main() {
  // A shift starting tomorrow at 8am, matching the seeded Armadillo locations
  // (scripts/seedTroopiterLocations.mjs) — chevron-govt-camp is a real
  // origin stop, "Armadillo" is the renamed Timberline-equivalent destination.
  const shiftDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const payload = {
    org: { id: 'armadillo-mountain', name: 'Armadillo Mountain Ski Patrol' },
    user: { name: fullname, email, photoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullname)}&background=126D41&color=fff&size=256` },
    shift: { date: shiftDate, time: '08:00', location: 'Armadillo' },
    // Shift companions (proposal's "Shift companions" section) — empty by
    // default here; use the Troopiter Shift Demo page (admin nav) to build
    // a token with a populated roster instead.
    roster: [],
  }

  const jwt = await signTestLaunchToken(readPemEnv(process.env.TROOPITER_TEST_PRIVATE_KEY), payload)

  const url = `https://${LAUNCH_HOST}/launch#token=${jwt}`
  console.log(`\nLaunch payload:\n${JSON.stringify(payload, null, 2)}\n`)
  console.log(`Open this URL (token expires in 2 minutes):\n${url}\n`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
