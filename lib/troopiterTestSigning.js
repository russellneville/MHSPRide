/**
 * Shared RS256 signing helper for the Troopiter launch-token rehearsal
 * (issue #199) — used by both scripts/mintTestLaunchToken.mjs (CLI) and
 * app/api/troopiter-demo/mint/route.js (the mock shift page's "Get a Ride"
 * button), so the two entry points can never drift on payload/signing shape.
 */
import { SignJWT, importPKCS8 } from 'jose'
import { randomUUID } from 'crypto'

// dotenv unescapes \n and strips the surrounding quotes from a
// double-quoted .env value, so a local .env.local value is already raw PEM
// by the time we see it — but the same JSON.stringify()'d value stored
// verbatim as a Vercel env var is not dotenv-processed, so it arrives still
// JSON-encoded. Handle both.
export function readPemEnv(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

// Both troopiter-demo routes read from the `members` collection as a
// stand-in "Armadillo Mountain" roster (multi-tenancy isn't built — see
// resources/troopiter/architecture.md), but that collection is really MHSP's
// own real patrol data. The demo page is unauthenticated by design, so
// without this filter it hands any visitor a browsable list of ~3000 real
// patrollers' names and emails. Only the maintainer's own real account and
// synthetic @example.com seed members (scripts/seedTroopiterDemoMembers.mjs)
// are eligible to appear or be launched as here.
const DEMO_ALLOWED_REAL_EMAIL = 'russellneville@gmail.com'

export function isDemoAllowedEmail(email) {
  const normalized = (email || '').trim().toLowerCase()
  return normalized === DEMO_ALLOWED_REAL_EMAIL || normalized.endsWith('@example.com')
}

export async function signTestLaunchToken(privateKeyPem, { org, user, shift, roster }) {
  const privateKey = await importPKCS8(privateKeyPem, 'RS256')
  return await new SignJWT({ org, user, shift, roster })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setExpirationTime('2m')
    .setJti(randomUUID())
    .sign(privateKey)
}
