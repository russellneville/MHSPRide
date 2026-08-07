/**
 * Verifies a Troopiter launch token (issue #199, integration-proposal.md
 * "Sequence" steps 6-7) and signs the user into their existing MHSP Ride
 * account. RS256-only: Troopiter's backend holds the private key, this
 * route only ever holds the public key, so a compromised MHSP Ride never
 * lets an attacker forge a launch.
 *
 * Not yet implemented: the "not found or not yet claimed -> shortcut
 * registration" branch from the proposal. This route currently just tells
 * the client to send that user through the normal /register flow instead —
 * building the skip-OTP shortcut is a separate, larger change.
 */
import { NextResponse } from 'next/server'
import { jwtVerify, importSPKI } from 'jose'
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'

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
