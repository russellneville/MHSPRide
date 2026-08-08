/**
 * migrateUserToTroopiter.mjs
 *
 * One-time bootstrap for the Troopiter integration prototype (issue #199):
 * copies a single user's Firebase Auth account (including their existing
 * password hash, so they can keep logging in with the same password) and
 * Firestore users/{uid} profile from the test project (mhspride-test) into
 * the new mhspride-troopiter project, forcing role: 'super-admin' so they
 * can sign in and use the admin roster-upload tools right away.
 *
 * The password hash bytes stored on the mhspride-test account already trace
 * back to production (see migrateAuthUsers.mjs) and were themselves imported
 * using production's SCRYPT signer key/params — not a "test project" key —
 * so the same PROD_PASSWORD_HASH_* config in .env.local is reused here to
 * re-import into mhspride-troopiter.
 *
 * Only migrates emails passed explicitly on the command line.
 *
 * Prerequisites:
 *   - scripts/serviceAccountKey.json -> mhspride-test service account (source)
 *   - scripts/serviceAccountKey.troopiter.json -> mhspride-troopiter service account (destination)
 *   - .env.local: PROD_PASSWORD_HASH_KEY / _SALT_SEPARATOR / _ROUNDS / _MEM_COST
 *
 * Usage:
 *   node scripts/migrateUserToTroopiter.mjs someone@example.com
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { createRequire } from 'module'
import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
config({ path: resolve(__dirname, '../.env.local') })

const require = createRequire(import.meta.url)

const emails = process.argv.slice(2)
if (emails.length === 0) {
  console.error('Usage: node scripts/migrateUserToTroopiter.mjs <email> [email...]')
  process.exit(1)
}

const HASH_KEY = process.env.PROD_PASSWORD_HASH_KEY
const HASH_SALT_SEPARATOR = process.env.PROD_PASSWORD_HASH_SALT_SEPARATOR ?? ''
const HASH_ROUNDS = Number(process.env.PROD_PASSWORD_HASH_ROUNDS)
const HASH_MEM_COST = Number(process.env.PROD_PASSWORD_HASH_MEM_COST)

if (!HASH_KEY || !HASH_ROUNDS || !HASH_MEM_COST) {
  console.error('❌  PROD_PASSWORD_HASH_KEY / PROD_PASSWORD_HASH_ROUNDS / PROD_PASSWORD_HASH_MEM_COST must be set in .env.local.')
  process.exit(1)
}

const testServiceAccount = require('./serviceAccountKey.json')
const troopiterServiceAccount = require('./serviceAccountKey.troopiter.json')

if (testServiceAccount.project_id !== 'mhspride-test') {
  console.error(`❌  scripts/serviceAccountKey.json points at project "${testServiceAccount.project_id}", not "mhspride-test". Refusing to run.`)
  process.exit(1)
}
if (troopiterServiceAccount.project_id !== 'mhspride-troopiter') {
  console.error(`❌  scripts/serviceAccountKey.troopiter.json points at project "${troopiterServiceAccount.project_id}", not "mhspride-troopiter". Refusing to run.`)
  process.exit(1)
}

const testApp = initializeApp({ credential: cert(testServiceAccount) }, 'test')
const troopiterApp = initializeApp({ credential: cert(troopiterServiceAccount) }, 'troopiter')

const testAuth = getAuth(testApp)
const testDb = getFirestore(testApp)
const troopiterAuth = getAuth(troopiterApp)
const troopiterDb = getFirestore(troopiterApp)

async function findTestUserByEmail(email) {
  let pageToken
  do {
    const page = await testAuth.listUsers(1000, pageToken)
    const match = page.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (match) return match
    pageToken = page.pageToken
  } while (pageToken)
  return null
}

async function migrateOne(email) {
  const testUser = await findTestUserByEmail(email)
  if (!testUser) {
    console.error(`⏭️  ${email}: no such user in mhspride-test. Skipped.`)
    return
  }

  const profileSnap = await testDb.collection('users').doc(testUser.uid).get()
  if (!profileSnap.exists) {
    console.error(`⏭️  ${email}: no users/${testUser.uid} Firestore doc in mhspride-test. Skipped.`)
    return
  }

  const alreadyExists = await troopiterAuth.getUser(testUser.uid).catch(() => null)
  if (!alreadyExists) {
    if (!testUser.passwordHash) {
      console.error(`⏭️  ${email}: mhspride-test account has no password hash (e.g. SSO-only). Skipped.`)
      return
    }
    const result = await troopiterAuth.importUsers([{
      uid: testUser.uid,
      email: testUser.email,
      emailVerified: testUser.emailVerified,
      passwordHash: Buffer.from(testUser.passwordHash, 'base64'),
      passwordSalt: testUser.passwordSalt ? Buffer.from(testUser.passwordSalt, 'base64') : undefined,
      displayName: testUser.displayName,
      disabled: false,
    }], {
      hash: {
        algorithm: 'SCRYPT',
        key: Buffer.from(HASH_KEY, 'base64'),
        saltSeparator: Buffer.from(HASH_SALT_SEPARATOR, 'base64'),
        rounds: HASH_ROUNDS,
        memoryCost: HASH_MEM_COST,
      },
    })
    if (result.failureCount > 0) {
      console.error(`❌  ${email}: Auth import failed — ${result.errors[0]?.error?.message ?? 'unknown error'}`)
      return
    }
    console.log(`✅  ${email}: Auth account created in mhspride-troopiter with uid ${testUser.uid} (password preserved).`)
  } else {
    console.log(`ℹ️  ${email}: Auth account already exists in mhspride-troopiter. Leaving as-is.`)
  }

  const profile = { ...profileSnap.data(), role: 'super-admin' }
  await troopiterDb.collection('users').doc(testUser.uid).set(profile)
  console.log(`✅  ${email}: Firestore profile written to mhspride-troopiter (role: super-admin).`)
}

async function main() {
  for (const email of emails) {
    await migrateOne(email)
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err)
  process.exit(1)
})
