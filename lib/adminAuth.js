import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'
import { NextResponse } from 'next/server'

/**
 * Verifies the Bearer token in the request and confirms the caller is an admin.
 * Returns the decoded token on success, or a NextResponse error to return immediately.
 */
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
