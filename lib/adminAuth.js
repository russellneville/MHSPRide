import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'
import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

// Verifies any authenticated Firebase user. Returns { uid } or { error: NextResponse }.
export async function verifyAuthRequest(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  try {
    const decoded = await getAdminAuth().verifyIdToken(token)
    return { uid: decoded.uid }
  } catch {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
}

// Independently proves the caller knows the account's *current* password, server-side.
// A valid ID token alone only proves an active session — it says nothing about whether
// the client actually just reauthenticated, so routes that mutate email/password can't
// treat "has a bearer token" as "just proved their current password." This hits the same
// Identity Toolkit endpoint the client SDK's signInWithPassword uses, via the public web
// API key (safe server-side — it's already shipped in the client bundle).
export async function verifyCurrentPassword(email, password) {
  if (!password) return false
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: false }),
    }
  )
  return res.ok
}

// super-admin is a strict superset of admin — anything admin-gated stays
// accessible to super-admin too.
const ADMIN_ROLES = ['admin', 'super-admin']

// Lightweight admin check for routes that authorize on "owner OR admin"
// (e.g. a ride's driver, or any admin) rather than admin-only.
export async function isAdminUser(uid) {
  const snap = await getAdminDb().collection('users').doc(uid).get()
  return snap.exists && ADMIN_ROLES.includes(snap.data().role)
}

export async function isSuperAdminUser(uid) {
  const snap = await getAdminDb().collection('users').doc(uid).get()
  return snap.exists && snap.data().role === 'super-admin'
}

// Verifies the Bearer token and confirms the caller is an admin (or super-admin).
// Returns { uid } or { error: NextResponse }.
export async function verifyAdminRequest(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token)
    const userSnap = await getAdminDb().collection('users').doc(decoded.uid).get()
    if (!userSnap.exists || !ADMIN_ROLES.includes(userSnap.data().role)) {
      return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }
    return { uid: decoded.uid }
  } catch {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
}

// Verifies the Bearer token and confirms the caller is a super-admin.
// Returns { uid } or { error: NextResponse }.
export async function verifySuperAdminRequest(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token)
    const userSnap = await getAdminDb().collection('users').doc(decoded.uid).get()
    if (!userSnap.exists || userSnap.data().role !== 'super-admin') {
      return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }
    return { uid: decoded.uid }
  } catch {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
}

// Verifies a scheduled-job caller (the GitHub Actions workflow that expires
// ride requests) rather than a signed-in user — there's no Firebase ID
// token for a cron invocation, just a shared secret. Uses a constant-time
// comparison to avoid a timing side-channel on the secret. Returns { ok:
// true } or { error: NextResponse }.
export async function verifyCronRequest(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '').trim()
  const secret = process.env.CRON_SECRET
  if (!token || !secret) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const tokenBuf = Buffer.from(token)
  const secretBuf = Buffer.from(secret)
  const matches = tokenBuf.length === secretBuf.length && timingSafeEqual(tokenBuf, secretBuf)
  if (!matches) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { ok: true }
}
