/**
 * generateTroopiterTestKeypair.mjs
 *
 * One-time setup for the Troopiter launch-token rehearsal (issue #199,
 * "Testing before carpool.troopiter.com is configured"). Generates a
 * throwaway RS256 keypair standing in for the real key Troopiter's backend
 * will eventually hold — the private half signs test launch tokens locally
 * (scripts/mintTestLaunchToken.mjs), the public half is what
 * app/api/launch/route.js verifies against in the deployed app.
 *
 * Refuses to overwrite existing keys — re-run only after deliberately
 * removing them from .env.local (any tokens signed with the old key would
 * stop verifying otherwise).
 *
 * Usage:
 *   node scripts/generateTroopiterTestKeypair.mjs
 */

import { generateKeyPairSync } from 'crypto'
import { readFileSync, appendFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const envPath = resolve(__dirname, '../.env.local')

const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''
if (existing.includes('TROOPITER_TEST_PRIVATE_KEY=') || existing.includes('TROOPITER_LAUNCH_PUBLIC_KEY=')) {
  console.error('❌  TROOPITER_TEST_PRIVATE_KEY or TROOPITER_LAUNCH_PUBLIC_KEY already set in .env.local. Refusing to overwrite — remove them first if you really want a new keypair.')
  process.exit(1)
}

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

const block = [
  '',
  '# Troopiter launch-token rehearsal (issue #199) — throwaway RS256 test keypair.',
  '# Private key: used only by scripts/mintTestLaunchToken.mjs, never deployed.',
  '# Public key: also set as a Vercel branch env var for app/api/launch to verify against.',
  `TROOPITER_TEST_PRIVATE_KEY=${JSON.stringify(privateKey)}`,
  `TROOPITER_LAUNCH_PUBLIC_KEY=${JSON.stringify(publicKey)}`,
  '',
].join('\n')

appendFileSync(envPath, block)
console.log('✅  Keypair generated and appended to .env.local.')
console.log('    Next: set TROOPITER_LAUNCH_PUBLIC_KEY as a Vercel env var for the branch (same value).')
