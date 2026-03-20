/**
 * clearTestData.mjs
 *
 * Deletes test data from Firestore scoped to users whose fullname contains
 * "(test)" (case-insensitive). Real user data is never touched.
 *
 *   - Deletes: rides where driverId is a test user
 *   - Deletes: bookings where passengerId OR driver.id is a test user
 *   - Deletes: feedback where userId is a test user
 *   - Resets:  members.claimed / claimedBy for test user UIDs
 *   - Deletes: test user accounts (Firestore + Firebase Auth)
 *   - Preserves: everything belonging to real users
 *
 * Prerequisites:
 *   - scripts/serviceAccountKey.json (Firebase Admin service account)
 *
 * Usage:
 *   node scripts/clearTestData.mjs
 */

import { createRequire } from 'module'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

const require = createRequire(import.meta.url)
const serviceAccount = require('./serviceAccountKey.json')

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()
const auth = getAuth()

// ── Helpers ───────────────────────────────────────────────────────────────────

// Delete all docs matching a field value from a set of UIDs.
// Firestore 'in' supports up to 30 values — chunks automatically.
async function deleteByUidField(collectionName, field, uids) {
  let deleted = 0
  for (let i = 0; i < uids.length; i += 30) {
    const chunk = uids.slice(i, i + 30)
    const snapshot = await db.collection(collectionName).where(field, 'in', chunk).get()
    if (snapshot.empty) continue
    const batch = db.batch()
    snapshot.docs.forEach(doc => batch.delete(doc.ref))
    await batch.commit()
    deleted += snapshot.size
  }
  return deleted
}

async function findTestUsers() {
  const snapshot = await db.collection('users').get()
  return snapshot.docs.filter(doc => /\(test\)/i.test(doc.data().fullname || ''))
}

async function deleteTestRides(testUids) {
  const deleted = await deleteByUidField('rides', 'driverId', testUids)
  console.log(`  rides: deleted ${deleted}`)
}

async function deleteTestBookings(testUids) {
  // Bookings where the passenger is a test user
  const asPassenger = await deleteByUidField('bookings', 'passengerId', testUids)
  // Bookings where the driver is a test user (and passenger may be real)
  const asDriver = await deleteByUidField('bookings', 'driver.id', testUids)
  console.log(`  bookings: deleted ${asPassenger + asDriver} (${asPassenger} as passenger, ${asDriver} as driver)`)
}

async function deleteTestFeedback(testUids) {
  const deleted = await deleteByUidField('feedback', 'userId', testUids)
  console.log(`  feedback: deleted ${deleted}`)
}

async function deleteTestUsers(testUsers) {
  if (!testUsers.length) {
    console.log('  users: none found')
    return
  }

  const batch = db.batch()
  testUsers.forEach(doc => batch.delete(doc.ref))
  await batch.commit()

  const uids = testUsers.map(doc => doc.id)
  await auth.deleteUsers(uids)

  testUsers.forEach(doc => console.log(`    - ${doc.data().fullname} (${doc.data().email})`))
  console.log(`  users: deleted ${testUsers.length} from Firestore + Auth`)
}

async function resetClaimedMembers(testUids) {
  let reset = 0
  for (let i = 0; i < testUids.length; i += 30) {
    const chunk = testUids.slice(i, i + 30)
    const snapshot = await db.collection('members').where('claimedBy', 'in', chunk).get()
    if (snapshot.empty) continue
    const batch = db.batch()
    snapshot.docs.forEach(doc => batch.update(doc.ref, { claimed: false, claimedBy: null }))
    await batch.commit()
    reset += snapshot.size
  }
  console.log(`  members: reset ${reset} claimed record(s)`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== MHSPRide test data cleanup ===\n')

  console.log('Finding test users (fullname contains "(test)")...')
  const testUsers = await findTestUsers()

  if (!testUsers.length) {
    console.log('  No test users found — nothing to clean up.')
    return
  }

  console.log(`  Found ${testUsers.length} test user(s):`)
  testUsers.forEach(doc => console.log(`    - ${doc.data().fullname} (${doc.data().email})`))
  console.log()

  const testUids = testUsers.map(doc => doc.id)

  console.log('Deleting rides offered by test users...')
  await deleteTestRides(testUids)

  console.log('Deleting bookings involving test users...')
  await deleteTestBookings(testUids)

  console.log('Deleting feedback from test users...')
  await deleteTestFeedback(testUids)

  console.log('Deleting test user accounts...')
  await deleteTestUsers(testUsers)

  console.log('Resetting claimed member records...')
  await resetClaimedMembers(testUids)

  console.log('\nDone. Real user data preserved.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
