import { NextResponse } from 'next/server'
import { verifyAdminRequest, isSuperAdminUser } from '@/lib/adminAuth'
import { getAdminDb } from '@/lib/firebaseAdmin'

// Firestore rules only let a user write their own users/{uid} doc, and even
// then block the role/suspended fields for everyone — role and suspension
// changes on another user's doc have to go through the Admin SDK.
const ALLOWED_ROLES = ['member', 'admin', 'super-admin']

export async function POST(request) {
  const auth = await verifyAdminRequest(request)
  if (auth.error) return auth.error

  try {
    const { uid, role, suspended } = await request.json()
    if (!uid) return NextResponse.json({ error: 'uid is required' }, { status: 400 })

    const updates = {}
    if (role !== undefined) {
      // Per issue #107: only super-admins may change anyone's role, including
      // an admin (or admin+suspend combo) changing their own suspend target's role.
      if (!(await isSuperAdminUser(auth.uid))) {
        return NextResponse.json({ error: 'Only super-admins can change roles' }, { status: 403 })
      }
      if (!ALLOWED_ROLES.includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      updates.role = role
    }
    if (suspended !== undefined) {
      if (typeof suspended !== 'boolean') {
        return NextResponse.json({ error: 'suspended must be a boolean' }, { status: 400 })
      }
      updates.suspended = suspended
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const db = getAdminDb()
    const userRef = db.collection('users').doc(uid)
    const userSnap = await userRef.get()
    if (!userSnap.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    await userRef.update(updates)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[admin/update-user]', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
