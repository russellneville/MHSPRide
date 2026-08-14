/**
 * Public "existing future shifts" listing for the mock Troopiter shift page
 * (issue #252, app/troopiter-shift-demo) — lets the demo simulate a real
 * Troopiter SSO into a shift that's already been launched at least once
 * (i.e. already has a shifts/ doc from app/api/launch's upsertShift),
 * instead of always minting a brand-new synthetic shift id. Unauthenticated
 * by design, same as ./roster — this page mimics an external site MHSP Ride
 * users haven't logged into yet, and only title/date/time/location (no
 * roster/PII) is returned.
 */
import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { TROOPITER_ORG_ID } from '@/lib/skin'

export async function GET() {
  const snap = await getAdminDb().collection('shifts').where('orgId', '==', TROOPITER_ORG_ID).get()
  const today = new Date().toISOString().slice(0, 10)

  const shifts = snap.docs
    .map(d => d.data())
    .filter(s => s.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(s => ({
      shiftId: s.shiftId,
      title: s.title || '',
      date: s.date || '',
      time: s.time || '',
      location: s.location || null,
    }))

  return NextResponse.json({ shifts })
}
