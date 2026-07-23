import { NextResponse } from 'next/server'
import { parse } from 'csv-parse/sync'
import { randomUUID } from 'crypto'
import { verifyAdminRequest } from '@/lib/adminAuth'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { computeDiff, parseCsvRows } from '@/lib/rosterDiff'

export async function POST(request) {
  const auth = await verifyAdminRequest(request)
  if (auth.error) return auth.error

  let text
  try {
    const formData = await request.formData()
    const file = formData.get('csv')
    if (!file) return NextResponse.json({ error: 'csv file is required' }, { status: 400 })
    text = await file.text()
  } catch {
    return NextResponse.json({ error: 'Failed to read uploaded file' }, { status: 400 })
  }

  let rawRows
  try {
    rawRows = parse(text, { columns: true, skip_empty_lines: true, trim: true })
  } catch {
    return NextResponse.json({ error: 'Invalid CSV format' }, { status: 400 })
  }

  const csvRows = parseCsvRows(rawRows)
  if (csvRows.length === 0) {
    return NextResponse.json({ error: 'No valid MHSP Number rows found in CSV' }, { status: 400 })
  }

  // Fetch every member, including inactive ones — computeDiff searches inactive docs
  // as rename candidates, since Troopiter can reassign a member's MHSP# (e.g. on an
  // Apprentice -> full-status promotion) in a way that doesn't land in the same
  // import as the old number's disappearance. Without inactive docs in the pool,
  // that kind of promotion silently creates an orphaned duplicate instead of a match.
  const db = getAdminDb()
  const membersSnap = await db.collection('members').get()
  const firestoreMembers = membersSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }))

  const diff = computeDiff(csvRows, firestoreMembers)

  // Persist session for the commit step
  const sessionId = randomUUID()
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours

  await db.collection('import_sessions').doc(sessionId).set({
    diff,
    status: 'pending',
    createdBy: auth.uid,
    createdAt: new Date(),
    expiresAt,
  })

  const preview = {
    renames:     diff.renames.map(r => ({
      oldId: r.oldId, newId: r.newId, name: r.name,
      emailChanged: r.emailChanged, addressChanged: r.addressChanged,
      hasClaim: r.hasClaim,
    })),
    newMembers:  diff.newMembers.map(m => ({
      id: m.id, name: `${m.data.firstName} ${m.data.lastName}`,
      classifications: m.data.classifications, address: m.data.address,
    })),
    updated:     diff.updated.map(u => ({
      id: u.id, name: u.name, addressChanged: u.addressChanged,
      changes: Object.keys(u.changes),
    })),
    deactivated: diff.deactivated.map(d => ({
      id: d.id, name: d.name, hasClaim: d.hasClaim,
    })),
    ambiguous:   diff.ambiguous.map(a => ({
      oldId: a.oldId, name: a.name, candidates: a.candidates, hasClaim: a.hasClaim,
    })),
  }

  return NextResponse.json({ sessionId, preview })
}
