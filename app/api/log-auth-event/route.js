import { NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'

// Logs failed-login attempts. These can't go through the client Firestore SDK:
// unknown-credential failures happen with no authenticated session at all, and
// suspended-account failures are blocked by the same !isSuspended() write rule
// that stops suspended users from writing anywhere else. Admin SDK bypasses both.
export async function POST(request) {
  try {
    const { email, reason } = await request.json()
    if (!email) return NextResponse.json({ ok: false, error: 'Email is required' }, { status: 400 })

    const token = request.headers.get('authorization')?.replace('Bearer ', '').trim()
    let uid = null
    let userData = {}
    if (token) {
      try {
        const decoded = await getAdminAuth().verifyIdToken(token)
        uid = decoded.uid
        const userSnap = await getAdminDb().collection('users').doc(uid).get()
        if (userSnap.exists) userData = userSnap.data()
      } catch {
        // token invalid/expired — log without identity
      }
    }

    const mhspHex = userData.mhspNumber
      ? parseInt(String(userData.mhspNumber).trim(), 10).toString(16).toUpperCase().padStart(4, '0')
      : null

    await getAdminDb().collection('activity_log').add({
      type: 'user.login_failed',
      message: `Login failed for ${email}: ${reason || 'unknown'}`,
      userId: uid,
      userName: userData.fullname || null,
      userMhspHex: mhspHex,
      metadata: { email, reason: reason || 'unknown' },
      timestamp: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[log-auth-event]', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
