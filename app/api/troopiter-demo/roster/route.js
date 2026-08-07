/**
 * Public roster listing for the mock Troopiter shift page (issue #199,
 * app/troopiter-shift-demo). Unauthenticated by design — that page mimics
 * an external site MHSP Ride users haven't logged into yet — so this only
 * returns the minimum needed to populate the "who am I" / shift-roster
 * pickers: name and email, never address/phone/classifications/etc.
 */
import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'

export async function GET() {
  const snap = await getAdminDb().collection('members').where('active', '==', true).get()
  const roster = snap.docs
    .map(d => ({ firstName: d.data().firstName || '', lastName: d.data().lastName || '', email: d.data().email || '' }))
    .filter(m => m.email)
    .sort((a, b) => a.lastName.localeCompare(b.lastName))

  return NextResponse.json({ roster })
}
