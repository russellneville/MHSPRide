/**
 * Mints a signed Troopiter launch token from the mock shift page
 * (app/troopiter-shift-demo) — the browser-based equivalent of running
 * scripts/mintTestLaunchToken.mjs by hand. Unauthenticated by design (that
 * page mimics an external, not-yet-logged-into-MHSP-Ride site), which makes
 * this the one genuinely sensitive piece: app/api/launch trusts any
 * validly-signed token to sign someone in via a Firebase custom token, so an
 * unrestricted mint endpoint would be a public "sign in as anyone with an
 * MHSP Ride account" backdoor for as long as it's live. The mitigation is
 * that it only ever signs for an email that's actually on the org's roster
 * (members collection) — same as how the real Troopiter integration would
 * only ever mint for an actual patrol member — plus a light IP rate limit.
 */
import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { signTestLaunchToken, readPemEnv } from '@/lib/troopiterTestSigning'
import { recordAttempt, getClientIp, normalizeEmail, isValidEmailInput } from '@/lib/rateLimit'
import { TROOPITER_ORG_ID } from '@/lib/skin'

const MINT_IP_LIMIT = { limit: 20, windowMs: 60 * 60 * 1000 }

export async function POST(request) {
  const privateKeyPem = readPemEnv(process.env.TROOPITER_TEST_PRIVATE_KEY)
  if (!privateKeyPem) {
    return NextResponse.json({ error: 'Demo mint is not configured on this environment.' }, { status: 500 })
  }

  const ip = getClientIp(request)
  const { blocked } = await recordAttempt({ key: `troopiter-demo-mint:ip:${ip}`, ...MINT_IP_LIMIT })
  if (blocked) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
  }

  const { email, name, shiftDate, shiftTime, shiftLocation, roster } = await request.json()
  if (!isValidEmailInput(email)) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
  }

  const db = getAdminDb()
  const normalizedEmail = normalizeEmail(email)

  // Every email in the request — the "who am I" user and every checked
  // companion — must actually be on the roster. Anything that doesn't match
  // is silently dropped rather than erroring the whole request, so a stale
  // client-side list doesn't block the demo.
  const membersSnap = await db.collection('members').where('active', '==', true).get()
  const rosterByEmail = new Map(
    membersSnap.docs
      .map(d => d.data())
      .filter(m => m.email)
      .map(m => [normalizeEmail(m.email), m])
  )

  const member = rosterByEmail.get(normalizedEmail)
  if (!member) {
    return NextResponse.json({ error: 'That email is not on the Armadillo Mountain roster.' }, { status: 403 })
  }

  const companions = Array.isArray(roster)
    ? roster
        .filter(r => r?.email && rosterByEmail.has(normalizeEmail(r.email)) && normalizeEmail(r.email) !== normalizedEmail)
        .map(r => {
          const m = rosterByEmail.get(normalizeEmail(r.email))
          return { name: `${m.firstName} ${m.lastName}`.trim(), email: m.email }
        })
    : []

  const orgSnap = await db.collection('organizations').doc(TROOPITER_ORG_ID).get()
  const orgName = orgSnap.exists ? orgSnap.data().displayName : TROOPITER_ORG_ID

  const fullname = name?.trim() || `${member.firstName} ${member.lastName}`.trim()
  const payload = {
    org: { id: TROOPITER_ORG_ID, name: orgName },
    // Standing in for Troopiter's real profile photo — a real integration
    // would send Troopiter's own stored photo URL here instead.
    user: { name: fullname, email: member.email, photoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullname)}&background=126D41&color=fff&size=256` },
    shift: {
      date: shiftDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      time: shiftTime || '08:00',
      location: shiftLocation || 'Armadillo',
    },
    roster: companions,
  }

  const token = await signTestLaunchToken(privateKeyPem, payload)
  return NextResponse.json({ ok: true, token })
}
