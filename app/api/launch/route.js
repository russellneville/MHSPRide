/**
 * Verifies a Troopiter launch token (issue #199, integration-proposal.md
 * "Sequence" steps 6-7) and signs the user into their MHSP Ride account —
 * creating one on the spot if this is their first launch. RS256-only:
 * Troopiter's backend holds the private key, this route only ever holds the
 * public key, so a compromised MHSP Ride never lets an attacker forge a
 * launch.
 *
 * No password is set on a shortcut-created account. Troopiter's signature is
 * already the proof of identity a password would otherwise stand in for, and
 * Firebase custom-token sessions persist normally — a standing password
 * would only buy a way to sign in without going through Troopiter first,
 * which isn't a requirement here. (A user can still add one later from
 * account settings if they want that.)
 */
import { NextResponse } from 'next/server'
import { jwtVerify, importSPKI } from 'jose'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'
import { normalizeEmail } from '@/lib/rateLimit'
import { awardBadge } from '@/lib/badges/award'

// See scripts/mintTestLaunchToken.mjs for why this isn't a plain JSON.parse —
// dotenv unescapes/unquotes local .env values before we see them, but a
// Vercel-stored env var (set the same JSON.stringify()'d way) arrives still
// JSON-encoded.
function readPemEnv(name) {
  const raw = process.env[name]
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

export async function POST(request) {
  try {
    const { token } = await request.json()
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Missing token.' }, { status: 400 })
    }

    const publicKeyPem = readPemEnv('TROOPITER_LAUNCH_PUBLIC_KEY')
    if (!publicKeyPem) {
      console.error('[launch] TROOPITER_LAUNCH_PUBLIC_KEY is not set')
      return NextResponse.json({ ok: false, error: 'Launch is not configured on this environment.' }, { status: 500 })
    }

    let payload
    try {
      const publicKey = await importSPKI(publicKeyPem, 'RS256')
      const verified = await jwtVerify(token, publicKey, { algorithms: ['RS256'] })
      payload = verified.payload
    } catch (err) {
      return NextResponse.json({ ok: false, error: 'Invalid or expired launch token.' }, { status: 401 })
    }

    const { user, jti } = payload
    if (!user?.email || !jti) {
      return NextResponse.json({ ok: false, error: 'Malformed launch token.' }, { status: 400 })
    }

    const db = getAdminDb()

    // Single-use jti — same "Admin SDK only" collection shape as
    // password_resets/registration_verifications (firestore.rules).
    // Firestore's create-if-absent transaction is what actually enforces
    // single-use, not this existence check alone (avoids a check-then-act
    // race between two requests replaying the same token concurrently).
    const consumedRef = db.collection('launch_tokens_consumed').doc(jti)
    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(consumedRef)
        if (snap.exists) throw new Error('REPLAYED')
        tx.set(consumedRef, {
          consumedAt: new Date(),
          expiresAt: new Date(payload.exp * 1000),
          email: user.email,
        })
      })
    } catch (err) {
      if (err.message === 'REPLAYED') {
        return NextResponse.json({ ok: false, error: 'This launch link has already been used.' }, { status: 401 })
      }
      throw err
    }

    const userQuery = await db.collection('users').where('email', '==', user.email).limit(1).get()
    if (userQuery.empty) {
      const shortcutUid = await createAccountFromRoster(db, user)
      if (shortcutUid) {
        const customToken = await getAdminAuth().createCustomToken(shortcutUid)
        return NextResponse.json({ ok: true, customToken })
      }

      // No unclaimed roster match for this email — fall back to the normal
      // self-service flow, which cross-checks last name + email by hand.
      return NextResponse.json({
        ok: true,
        needsRegistration: true,
        prefill: { email: user.email, fullname: user.name || '' },
      })
    }

    const uid = userQuery.docs[0].id
    const customToken = await getAdminAuth().createCustomToken(uid)
    return NextResponse.json({ ok: true, customToken })
  } catch (err) {
    console.error('[launch]', err)
    return NextResponse.json({ ok: false, error: 'Launch failed.' }, { status: 500 })
  }
}

// Creates an account for a first-time Troopiter arrival without the
// self-service /register wizard — Troopiter's signature already proved this
// is `user.email`, so there's nothing left for that wizard's MHSP#/last-name
// cross-check or email-OTP step to establish. Still requires an actual,
// unclaimed roster match (same "only real roster members" guarantee
// app/api/troopiter-demo/mint uses) — this is what stands in for that
// cross-check. Returns the new uid, or null if there's no roster match to
// build an account from (caller falls back to the normal /register flow).
async function createAccountFromRoster(db, launchUser) {
  const maintenanceSnap = await db.collection('config').doc('maintenance').get()
  if (maintenanceSnap.exists && maintenanceSnap.data().enabled) return null

  const normalizedEmail = normalizeEmail(launchUser.email)

  // Mirrors app/api/register/verify-membership's lookup: orgs without MHSP-
  // style patrol IDs (Armadillo Mountain) key the member doc by normalized
  // email directly; others carry email as a plain field instead.
  let memberSnap = await db.collection('members').doc(normalizedEmail).get()
  if (!memberSnap.exists) {
    const query = await db.collection('members').where('email', '==', normalizedEmail).limit(1).get()
    memberSnap = query.empty ? null : query.docs[0]
  }
  if (!memberSnap || !memberSnap.exists || memberSnap.data().claimed) return null

  const memberData = memberSnap.data()
  const memberRef = memberSnap.ref
  const fullname = launchUser.name?.trim() || `${memberData.firstName} ${memberData.lastName}`.trim()

  let authUser
  try {
    authUser = await getAdminAuth().createUser({ email: launchUser.email, displayName: fullname })
  } catch (err) {
    // auth/email-already-exists here means a Firebase Auth user exists with
    // no matching users/ doc (an inconsistent prior state, not something
    // this launch caused) — safest is to fall back to /register rather than
    // silently taking over an existing auth account.
    if (err.code === 'auth/email-already-exists') return null
    throw err
  }

  const uid = authUser.uid
  await db.collection('users').doc(uid).set({
    email: launchUser.email,
    fullname,
    phone: '',
    address: memberData.address || '',
    bio: '',
    role: 'member',
    mhspNumber: memberData.mhspNumber || '',
    memberId: memberRef.id,
    classifications: memberData.classifications || [],
    latitude: memberData.latitude || null,
    longitude: memberData.longitude || null,
    created_at: FieldValue.serverTimestamp(),
  })

  await memberRef.update({ claimed: true, claimedBy: uid })

  await db.collection('activity_log').add({
    type: 'user.registered',
    message: `New user registered via Troopiter launch: ${fullname}`,
    userId: uid,
    userName: fullname,
    metadata: { email: launchUser.email, via: 'troopiter-launch' },
    timestamp: FieldValue.serverTimestamp(),
  })

  awardBadge(db, uid, 'registered').catch(err => console.error('[launch] badge award failed', err))

  return uid
}
