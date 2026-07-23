/**
 * repairSupersededMemberClaims.mjs
 *
 * One-time repair for member docs orphaned by a Troopiter MHSP# reassignment (e.g.
 * an Apprentice -> full-status promotion) before the roster-import rename matching
 * learned to search inactive docs as candidates (see lib/rosterDiff.js).
 *
 * Finds pairs of member docs sharing the same email where the inactive (superseded)
 * doc still has claimed:true and the active (current) doc has claimed:true with the
 * SAME claimedBy — i.e. the rename already correctly migrated the account, but the
 * old doc's claim was never cleared. Clears claimed/claimedBy on the old doc only.
 *
 * Anything that doesn't match that exact pattern is left untouched and printed for
 * manual review — this script never guesses.
 *
 * Prerequisites:
 *   - Place your Firebase service account key at scripts/serviceAccountKey.json
 *
 * Usage:
 *   node scripts/repairSupersededMemberClaims.mjs           # dry run, report only
 *   node scripts/repairSupersededMemberClaims.mjs --commit  # apply the safe fixes
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const serviceAccount = require('./serviceAccountKey.json')

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const COMMIT = process.argv.includes('--commit')

function norm(s) {
  return (s || '').trim().toLowerCase()
}

async function main() {
  const snap = await db.collection('members').get()
  const members = snap.docs.map(d => ({ id: d.id, ...d.data() }))

  const byEmail = {}
  for (const m of members) {
    const email = norm(m.email)
    if (!email) continue
    ;(byEmail[email] ||= []).push(m)
  }

  const groups = Object.entries(byEmail).filter(([, v]) => v.length > 1)
  console.log(`Found ${groups.length} email-duplicate group(s) across ${members.length} member docs.\n`)

  const safeToFix = []
  const needsReview = []

  for (const [email, group] of groups) {
    const active = group.filter(m => m.active !== false)
    const inactive = group.filter(m => m.active === false)

    const staleClaims = inactive.filter(m => m.claimed)
    if (staleClaims.length === 0) continue // nothing stale in this group, skip silently

    for (const oldDoc of staleClaims) {
      const currentClaim = active.find(m => m.claimed && m.claimedBy === oldDoc.claimedBy)
      if (active.length === 1 && currentClaim) {
        safeToFix.push({ email, oldDoc, newDoc: currentClaim })
      } else {
        needsReview.push({ email, oldDoc, activeCandidates: active })
      }
    }
  }

  console.log(`Safe to fix (old claim already migrated to a single current doc): ${safeToFix.length}`)
  for (const { email, oldDoc, newDoc } of safeToFix) {
    console.log(`  #${oldDoc.id} ${oldDoc.firstName} ${oldDoc.lastName} (${email}) -> already correctly claimed on #${newDoc.id}, claimedBy=${oldDoc.claimedBy}`)
  }

  if (needsReview.length > 0) {
    console.log(`\nNeeds manual review (does not match the safe pattern): ${needsReview.length}`)
    for (const { email, oldDoc, activeCandidates } of needsReview) {
      console.log(`  #${oldDoc.id} ${oldDoc.firstName} ${oldDoc.lastName} (${email}) claimedBy=${oldDoc.claimedBy} — active candidates: ${activeCandidates.map(m => `#${m.id}(claimed=${m.claimed},claimedBy=${m.claimedBy})`).join(', ') || 'none'}`)
    }
  }

  if (safeToFix.length === 0) {
    console.log('\nNothing to commit.')
    return
  }

  if (!COMMIT) {
    console.log(`\nDry run only — re-run with --commit to clear claimed/claimedBy on the ${safeToFix.length} safe doc(s) above.`)
    return
  }

  const batch = db.batch()
  for (const { oldDoc } of safeToFix) {
    batch.update(db.collection('members').doc(oldDoc.id), { claimed: false, claimedBy: null })
  }
  await batch.commit()
  console.log(`\nDone. Cleared claimed/claimedBy on ${safeToFix.length} superseded doc(s).`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
