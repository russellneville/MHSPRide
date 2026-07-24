import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { sendSupportEmail } from '@/lib/email'
import { FieldValue } from 'firebase-admin/firestore'
import { recordAttempt, getClientIp } from '@/lib/rateLimit'

const CONTACT_IP_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 }

export async function POST(request) {
  try {
    const { name, email, type, message } = await request.json()

    if (!name?.trim() || !email?.trim() || !message?.trim() || !type) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 })
    }

    const db = getAdminDb()

    const ip = getClientIp(request)
    const rateResult = await recordAttempt({ key: `contact:ip:${ip}`, ...CONTACT_IP_LIMIT })
    if (rateResult.blocked) {
      if (rateResult.crossedThreshold) {
        await db.collection('activity_log').add({
          type: 'security.rate_limit_exceeded',
          message: `Contact form rate limit exceeded for IP ${ip}`,
          userId: null,
          userName: null,
          userMhspHex: null,
          metadata: { ip, scope: 'contact_ip' },
          timestamp: FieldValue.serverTimestamp(),
        })
      }
      return NextResponse.json({ ok: false, error: 'Too many requests, please try again later' }, { status: 429 })
    }

    await db.collection('feedback').add({
      name: name.trim(),
      email: email.trim(),
      type,
      message: message.trim(),
      source: 'contact_form',
      userId: null,
      submittedAt: FieldValue.serverTimestamp(),
    })

    await db.collection('activity_log').add({
      type: 'feedback.submitted',
      message: `${type} submitted via contact form by ${name.trim()} (${email.trim()}): "${message.trim().slice(0, 120)}"`,
      userId: null,
      userName: name.trim(),
      userMhspHex: null,
      metadata: { type, source: 'contact_form', email: email.trim() },
      timestamp: FieldValue.serverTimestamp(),
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
