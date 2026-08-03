/**
 * migrateAuthUsers.mjs
 *
 * One-time, explicitly-consented migration of specific users' Firebase Auth
 * accounts — including their existing password hash, so they can keep
 * logging in with the same password — from production (mhspride) into the
 * test project (mhspride-test). Their `users/{uid}` Firestore profile was
 * already copied into mhspride-test by an earlier roster sync; this script
 * only creates the missing Auth account, using the *same* uid as that
 * existing Firestore doc so the two stay linked. If the source Auth uid and
 * the existing test Firestore doc id don't match for a given email, that
 * user is skipped with an explicit error rather than silently creating a
 * mismatched account (see issue #188).
 *
 * Only migrates emails passed explicitly on the command line — never a
 * wildcard or "everyone" mode.
 *
 * Prerequisites:
 *   - scripts/serviceAccountKey.json -> mhspride-test service account (destination)
 *   - .env.local:
 *       PROD_FIREBASE_SERVICE_ACCOUNT_KEY  (full mhspride service account JSON
 *                                            as a string, read-only use here —
 *                                            same convention as FIREBASE_SERVICE_ACCOUNT_KEY
 *                                            in lib/firebaseAdmin.js)
 *       PROD_PASSWORD_HASH_KEY             (base64 signer key)
 *       PROD_PASSWORD_HASH_SALT_SEPARATOR  (base64, may be empty)
 *       PROD_PASSWORD_HASH_ROUNDS
 *       PROD_PASSWORD_HASH_MEM_COST
 *     — the hash params come from Firebase Console -> mhspride project ->
 *       Authentication -> Users -> "Password hash parameters" (⋮ menu).
 *       Required so Firebase can verify these imported passwords against
 *       future login attempts.
 *
 * Usage:
 *   node scripts/migrateAuthUsers.mjs someone@example.com another@example.com
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { createRequire } from 'module'
import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { assertTestProject } from './lib/assertTestProject.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
config({ path: resolve(__dirname, '../.env.local') })

const require = createRequire(import.meta.url)

const emails = process.argv.slice(2)
if (emails.length === 0) {
  console.error('Usage: node scripts/migrateAuthUsers.mjs <email> [email...]')
  process.exit(1)
}

const HASH_KEY = process.env.PROD_PASSWORD_HASH_KEY
const HASH_SALT_SEPARATOR = process.env.PROD_PASSWORD_HASH_SALT_SEPARATOR ?? ''
const HASH_ROUNDS = Number(process.env.PROD_PASSWORD_HASH_ROUNDS)
const HASH_MEM_COST = Number(process.env.PROD_PASSWORD_HASH_MEM_COST)

if (!HASH_KEY || !HASH_ROUNDS || !HASH_MEM_COST) {
  console.error('❌  PROD_PASSWORD_HASH_KEY / PROD_PASSWORD_HASH_ROUNDS / PROD_PASSWORD_HASH_MEM_COST must be set in .env.local.')
  console.error('    Get these from Firebase Console → mhspride → Authentication → Users → "Password hash parameters".')
  process.exit(1)
}

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

const prodAuth = getAuth(prodApp)
const testAuth = getAuth(testApp)
const testDb = getFirestore(testApp)

// listUsers() is Firebase's bulk "export" call — unlike getUser/getUserByEmail,
// its records include passwordHash/passwordSalt, which is what makes a
// same-password migration possible at all.
async function findProdUserByEmail(email) {
  let pageToken
  do {
    const page = await prodAuth.listUsers(1000, pageToken)
    const match = page.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (match) return match
    pageToken = page.pageToken
  } while (pageToken)
  return null
}

async function migrateOne(email) {
  const prodUser = await findProdUserByEmail(email)
  if (!prodUser) {
    console.error(`⏭️  ${email}: no such user in production. Skipped.`)
    return
  }
  if (!prodUser.passwordHash) {
    console.error(`⏭️  ${email}: production account has no password hash (e.g. SSO-only). Skipped.`)
    return
  }

  const existingTestDoc = await testDb.collection('users').where('email', '==', email).limit(1).get()
  if (existingTestDoc.empty) {
    console.error(`⏭️  ${email}: no matching users/{uid} doc found in mhspride-test Firestore. Run the roster sync first. Skipped.`)
    return
  }
  const testDocId = existingTestDoc.docs[0].id
  if (testDocId !== prodUser.uid) {
    console.error(`⏭️  ${email}: production uid (${prodUser.uid}) doesn't match the existing test Firestore doc id (${testDocId}). Skipped — reconcile manually before retrying.`)
    return
  }

  const alreadyExists = await testAuth.getUser(prodUser.uid).catch(() => null)
  if (alreadyExists) {
    console.log(`✅  ${email}: already has a mhspride-test Auth account. Nothing to do.`)
    return
  }

  const result = await testAuth.importUsers([{
    uid: prodUser.uid,
    email: prodUser.email,
    emailVerified: prodUser.emailVerified,
    passwordHash: Buffer.from(prodUser.passwordHash, 'base64'),
    passwordSalt: prodUser.passwordSalt ? Buffer.from(prodUser.passwordSalt, 'base64') : undefined,
    displayName: prodUser.displayName,
    disabled: prodUser.disabled,
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
    console.error(`❌  ${email}: import failed — ${result.errors[0]?.error?.message ?? 'unknown error'}`)
    return
  }
  console.log(`✅  ${email}: migrated to mhspride-test with uid ${prodUser.uid} (password preserved).`)
}

async function main() {
  for (const email of emails) {
    await migrateOne(email)
  }
}

main().then(() => process.exit(0))
