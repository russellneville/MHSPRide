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

export async function signTestLaunchToken(privateKeyPem, { org, user, shift, roster }) {
  const privateKey = await importPKCS8(privateKeyPem, 'RS256')
  return await new SignJWT({ org, user, shift, roster })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setExpirationTime('2m')
    .setJti(randomUUID())
    .sign(privateKey)
}
