import { getAdminDb } from '@/lib/firebaseAdmin'
import { Timestamp } from 'firebase-admin/firestore'

function bucket(key, windowMs, now = Date.now()) {
  const index = Math.floor(now / windowMs)
  return { docId: `${key}__${index}`, index }
}

// Read-only peek — never writes. Use before an attempt to decide whether to
// even try (e.g. before calling Firebase Auth from the client).
//
// Uses the same "blocked once count > limit" threshold as recordAttempt below
// (not count >= limit) so the two stay in sync: an attempt that would become
// the (limit+1)th recorded failure is the one that both gets blocked *and*
// triggers crossedThreshold. If this peek blocked one attempt earlier (>=),
// that (limit+1)th attempt would never happen — recordAttempt would never see
// it, and the one-time security-event log below would never fire.
export async function checkRateLimit({ key, limit, windowMs }) {
  const { docId, index } = bucket(key, windowMs)
  const snap = await getAdminDb().collection('rate_limits').doc(docId).get()
  const count = snap.exists ? snap.data().count : 0
  const resetAt = (index + 1) * windowMs
  return { blocked: count > limit, count, limit, retryAfterMs: Math.max(0, resetAt - Date.now()) }
}

// Transactional increment. crossedThreshold is true only on the exact call
// where count first exceeds limit, so callers can log a security event once
// per window instead of on every subsequent blocked attempt.
export async function recordAttempt({ key, limit, windowMs }) {
  const db = getAdminDb()
  const { docId, index } = bucket(key, windowMs)
  const ref = db.collection('rate_limits').doc(docId)

  const count = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const next = (snap.exists ? snap.data().count : 0) + 1
    tx.set(ref, {
      count: next,
      key,
      windowStart: Timestamp.fromMillis(index * windowMs),
      expiresAt: Timestamp.fromMillis((index + 2) * windowMs),
    })
    return next
  })

  return { blocked: count > limit, crossedThreshold: count === limit + 1, count, limit }
}

// Vercel sets x-forwarded-for; take the first (client) hop. Falls back to
// 'unknown' where the header is absent (e.g. local dev).
export function getClientIp(request) {
  const fwd = request.headers.get('x-forwarded-for')
  return fwd ? fwd.split(',')[0].trim() : 'unknown'
}

export function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

export function isValidEmailInput(email) {
  return typeof email === 'string' && email.trim().length > 0 && email.length <= 320
}
