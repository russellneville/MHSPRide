import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'
import { NextResponse } from 'next/server'

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

// Lightweight admin check for routes that authorize on "owner OR admin"
// (e.g. a ride's driver, or any admin) rather than admin-only.
export async function isAdminUser(uid) {
  const snap = await getAdminDb().collection('users').doc(uid).get()
  return snap.exists && snap.data().role === 'admin'
}

// Verifies the Bearer token and confirms the caller is an admin.
// Returns { uid } or { error: NextResponse }.
export async function verifyAdminRequest(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token)
    const userSnap = await getAdminDb().collection('users').doc(decoded.uid).get()
    if (!userSnap.exists || userSnap.data().role !== 'admin') {
      return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }
    return { uid: decoded.uid }
  } catch {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
}
