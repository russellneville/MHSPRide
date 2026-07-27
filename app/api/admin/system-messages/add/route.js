import { NextResponse } from 'next/server'
import { verifySuperAdminRequest } from '@/lib/adminAuth'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { SEVERITIES, findOverlapping } from '@/lib/systemMessages'

const MAX_MESSAGE_LENGTH = 300

export async function POST(request) {
  const auth = await verifySuperAdminRequest(request)
  if (auth.error) return auth.error

  const { message, severity, start_at, end_at, show_on_login } = await request.json()

  const trimmedMessage = String(message || '').trim()
  const startDate = new Date(start_at)
  const endDate = new Date(end_at)

  if (!trimmedMessage) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }
  if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer` }, { status: 400 })
  }
  if (!SEVERITIES.includes(severity)) {
    return NextResponse.json({ error: `Severity must be one of: ${SEVERITIES.join(', ')}` }, { status: 400 })
  }
  if (isNaN(startDate) || isNaN(endDate)) {
    return NextResponse.json({ error: 'Valid start and end dates are required' }, { status: 400 })
  }
  if (endDate <= startDate) {
    return NextResponse.json({ error: 'End date must be after the start date' }, { status: 400 })
  }

  try {
    const db = getAdminDb()

    // Every message always shows on the dashboard, so any two overlapping
    // windows would mean two banners competing for the same slot — checked
    // here (not just in the UI) since this is the source of truth.
    const existingSnap = await db.collection('system_messages').get()
    const existing = existingSnap.docs.map(d => ({
      id: d.id,
      start_at: d.data().start_at.toDate(),
      end_at: d.data().end_at.toDate(),
    }))
    const conflict = findOverlapping(existing, startDate, endDate)
    if (conflict) {
      return NextResponse.json({
        error: `Overlaps with a message scheduled ${conflict.start_at.toLocaleString()} – ${conflict.end_at.toLocaleString()}`,
      }, { status: 409 })
    }

    const ref = await db.collection('system_messages').add({
      message: trimmedMessage,
      severity,
      start_at: Timestamp.fromDate(startDate),
      end_at: Timestamp.fromDate(endDate),
      show_on_login: !!show_on_login,
      createdBy: auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ ok: true, id: ref.id })
  } catch (err) {
    console.error('[admin/system-messages/add]', err)
    return NextResponse.json({ error: err.message || 'Could not add message' }, { status: 500 })
  }
}
