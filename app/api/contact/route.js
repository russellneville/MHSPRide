import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { sendSupportEmail } from '@/lib/email'
import { FieldValue } from 'firebase-admin/firestore'

export async function POST(request) {
  try {
    const { name, email, type, message } = await request.json()

    if (!name?.trim() || !email?.trim() || !message?.trim() || !type) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 })
    }

    const db = getAdminDb()

    await db.collection('feedback').add({
      name: name.trim(),
      email: email.trim(),
      type,
      message: message.trim(),
      source: 'contact_form',
      userId: null,
      submittedAt: FieldValue.serverTimestamp(),
    })

    if (type === 'support') {
      const configSnap = await db.collection('config').doc('site').get()
      const supportEmail = configSnap.exists ? configSnap.data()?.support_email : null
      if (supportEmail) {
        await sendSupportEmail({ name: name.trim(), email: email.trim(), message: message.trim(), to: supportEmail })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[contact]', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
