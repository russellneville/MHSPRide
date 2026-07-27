import { NextResponse } from 'next/server'
import { verifySuperAdminRequest } from '@/lib/adminAuth'
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'

// Resetting a membership is meant to let someone re-register from scratch, but just
// unclaiming the members/{mhspNumber} doc left the old Firebase Auth account (and its
// users/{uid} doc) behind. Re-registering with the same email then failed with
// auth/email-already-exists, since that account still existed. Deleting the old
// account here is what actually frees the email up for reuse.
export async function POST(request) {
  const authResult = await verifySuperAdminRequest(request)
  if (authResult.error) return authResult.error

  try {
    const { uid, mhspNumber } = await request.json()
    if (!uid || !mhspNumber) {
      return NextResponse.json({ error: 'uid and mhspNumber are required' }, { status: 400 })
    }

    const db = getAdminDb()
    const memberId = String(mhspNumber).trim()
    const memberRef = db.collection('members').doc(memberId)
    const memberSnap = await memberRef.get()
    if (!memberSnap.exists) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    try {
      await getAdminAuth().deleteUser(uid)
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error
    }

    await db.collection('users').doc(uid).delete()
    await memberRef.update({ claimed: false, claimedBy: null })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[admin/reset-membership]', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
