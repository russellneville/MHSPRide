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
 * Prerequisites:
 *   - .env.local: TROOPITER_TEST_PRIVATE_KEY (scripts/generateTroopiterTestKeypair.mjs)
 *
 * Usage:
 *   node scripts/mintTestLaunchToken.mjs [email] [fullname]
 *   node scripts/mintTestLaunchToken.mjs someone@example.com "Someone Person"
 */

import { SignJWT, importPKCS8 } from 'jose'
import { randomUUID } from 'crypto'
import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
config({ path: resolve(__dirname, '../.env.local') })

const LAUNCH_HOST = process.env.TROOPITER_LAUNCH_HOST || 'troopiter.mhspride.com'

const email = process.argv[2] || 'russellneville@gmail.com'
const fullname = process.argv[3] || 'Russell Neville (admin)'

if (!process.env.TROOPITER_TEST_PRIVATE_KEY) {
  console.error('❌  TROOPITER_TEST_PRIVATE_KEY is not set in .env.local. Run scripts/generateTroopiterTestKeypair.mjs first.')
  process.exit(1)
}

// dotenv unescapes \n and strips the surrounding quotes from a
// double-quoted .env value, so locally this is already raw PEM by the time
// we see it — but the same JSON.stringify()'d value stored verbatim as a
// Vercel env var (app/api/launch/route.js's deployed counterpart) is not
// dotenv-processed, so it arrives still JSON-encoded. Handle both.
function readPemEnv(name) {
  const raw = process.env[name]
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

async function main() {
  const privateKey = await importPKCS8(readPemEnv('TROOPITER_TEST_PRIVATE_KEY'), 'RS256')

  // A shift starting tomorrow at 8am, matching the seeded Armadillo locations
  // (scripts/seedTroopiterLocations.mjs) — chevron-govt-camp is a real
  // origin stop, "Armadillo" is the renamed Timberline-equivalent destination.
  const shiftDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const payload = {
    org: { id: 'armadillo-mountain', name: 'Armadillo Mountain Ski Patrol' },
    user: { name: fullname, email },
    shift: { date: shiftDate, time: '08:00', location: 'Armadillo' },
    // Shift companions (proposal's "Shift companions" section) — left empty
    // in this rehearsal since the roster hasn't been uploaded yet; the
    // launch/auth pipeline this script exercises doesn't depend on it.
    roster: [],
  }

  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setExpirationTime('2m')
    .setJti(randomUUID())
    .sign(privateKey)

  const url = `https://${LAUNCH_HOST}/launch#token=${jwt}`
  console.log(`\nLaunch payload:\n${JSON.stringify(payload, null, 2)}\n`)
  console.log(`Open this URL (token expires in 2 minutes):\n${url}\n`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
