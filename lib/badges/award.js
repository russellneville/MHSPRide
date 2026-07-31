import { FieldValue } from 'firebase-admin/firestore'
import { badgeById } from '@/lib/badges/catalog'

// Shared award-write helper for event-based badges (resources/badging.md).
// Admin SDK only — users/{uid}/badges write access is blocked for the client
// SDK entirely (firestore.rules), so every caller here is a server route.
// Idempotent: a badge already on file is left untouched, so callers can
// call this on every relevant action without checking "have they already
// got this?" themselves first.
export async function awardBadge(db, uid, badgeId, { reason = 'event' } = {}) {
  const badge = badgeById(badgeId)
  if (!badge) return false

  const ref = db.collection('users').doc(uid).collection('badges').doc(badgeId)
  const snap = await ref.get()
  if (snap.exists) return false

  await ref.set({
    badgeId,
    earnedAt: FieldValue.serverTimestamp(),
    definitionVersion: badge.version,
    reason,
    seenAt: null,
  })
  return true
}
