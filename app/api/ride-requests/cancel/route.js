import { NextResponse } from 'next/server'
import { verifyAuthRequest, isAdminUser } from '@/lib/adminAuth'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { sendRideRequestCanceledEmail } from '@/lib/email'

// Every ride_requests status transition goes through an API route (see
// firestore.rules — client writes to that collection are create-only), so
// even the requester's own cancel comes through here rather than a direct
// updateDoc. Only emails the requester when someone else (an admin) canceled
// on their behalf — a self-cancel doesn't need an email telling you what you
// just did.
export async function POST(request) {
  const auth = await verifyAuthRequest(request)
  if (auth.error) return auth.error

  try {
    const { requestId, reason } = await request.json()
    if (!requestId) {
      return NextResponse.json({ error: 'requestId is required' }, { status: 400 })
    }

    const db = getAdminDb()
    const reqSnap = await db.collection('ride_requests').doc(requestId).get()
    if (!reqSnap.exists) return NextResponse.json({ ok: true })
    const reqData = reqSnap.data()

    const isSelf = reqData.requesterId === auth.uid
    const isAdmin = await isAdminUser(auth.uid)
    if (!isSelf && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (reqData.status !== 'open') {
      return NextResponse.json({ error: 'This request is no longer open' }, { status: 409 })
    }

    await db.collection('ride_requests').doc(requestId).update({
      status: 'canceled',
      cancellation_reason: reason || '',
    })

    if (!isSelf && reqData.requester?.email) {
      await sendRideRequestCanceledEmail({ requester: reqData.requester, request: reqData })
        .catch(err => console.error('[ride-requests/cancel] email failed:', err))
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[ride-requests/cancel]', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
