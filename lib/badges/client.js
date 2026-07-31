import { collection, getDocs, query, where } from "firebase/firestore"
import { auth, db } from "@/lib/firebaseClient"

// Client-side helpers for the badges API routes, following the same
// getIdToken-then-fetch pattern used throughout context/NetworksContext.jsx
// (e.g. notify-ride-update) rather than introducing a new auth shape.
async function authedPost(path, body) {
  const token = await auth.currentUser?.getIdToken().catch(() => null)
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify(body || {}),
  })
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`)
  return res.json()
}

// theme is passed through explicitly because next-themes never persists to
// Firestore (see lib/badges/evaluate.js's evaluateThemeBadges) — the server
// has no other way to know it.
export async function evaluateBadges({ theme } = {}) {
  const data = await authedPost("/api/badges/evaluate", { theme })
  return data.newlyEarned || []
}

export async function acknowledgeBadge(badgeId) {
  return authedPost("/api/badges/acknowledge", { badgeId })
}

// Every award (lazy-evaluated or event-based, see award-event/route.js) is
// written with seenAt: null and only gets a timestamp once the celebration
// dialog acknowledges it — so this is the single source of truth for "has
// this member not yet seen this badge", regardless of how or when it was
// earned or how many sessions have passed since.
export async function fetchUnseenBadges(uid) {
  const snap = await getDocs(query(collection(db, "users", uid, "badges"), where("seenAt", "==", null)))
  return snap.docs.map((d) => d.data().badgeId).filter(Boolean)
}

// Fire-and-forget from a client write that has no server route of its own
// (network favoriting, driver favoriting, photo upload — see
// app/api/badges/award-event/route.js for why). Callers should not await
// this on the critical path; the underlying action already succeeded by the
// time this is called, and the server re-validates every claim anyway.
export function fireBadgeEvent(event, payload) {
  authedPost("/api/badges/award-event", { event, ...payload }).catch((error) =>
    console.error(`[badges] award-event "${event}" failed:`, error)
  )
}
