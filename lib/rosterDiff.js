/**
 * Pure roster diff logic — no Firestore dependencies.
 *
 * csvRows:          array of objects from parseCsvRows()
 * firestoreMembers: array of { id, firstName, lastName, email, status,
 *                              classifications, address, latitude, longitude,
 *                              active, claimed, claimedBy }
 *                    Must include BOTH active and inactive docs — inactive docs are
 *                    searched as rename candidates (see computeDiff), since Troopiter
 *                    can reassign a member's MHSP# (e.g. on an Apprentice → full-status
 *                    promotion) in a way that doesn't land in the same import as the
 *                    old number's disappearance.
 */

function norm(s) {
  return (s || '').trim().toLowerCase()
}

function classKey(arr) {
  return (arr || []).slice().sort().join('|')
}

// MHSP# is not a stable identity across a classification change — Troopiter can
// issue a brand-new number on promotion. Last name + email is the stable pair we
// match on instead. Returns null when email is blank: no signal to match on.
// (Older/retired docs often carry a synthetic placeholder email derived from their
// own MHSP#, e.g. "1234@mthoodskipatrol.org" — that naturally never collides with a
// different number's row, since it's literally derived from the old number, so no
// special-casing is needed for it.)
function identityKey(email, lastName) {
  const e = norm(email)
  if (!e) return null
  return `${e}|${norm(lastName)}`
}

const TRACKED_FIELDS = ['firstName', 'lastName', 'email', 'status', 'address']

function detectFieldChanges(fsDoc, csvRow) {
  const changes = {}

  for (const field of TRACKED_FIELDS) {
    const oldVal = norm(fsDoc[field])
    const newVal = norm(csvRow[field])
    if (oldVal !== newVal) changes[field] = { old: fsDoc[field] || '', new: csvRow[field] || '' }
  }

  if (classKey(fsDoc.classifications) !== classKey(csvRow.classifications)) {
    changes.classifications = {
      old: fsDoc.classifications || [],
      new: csvRow.classifications || [],
    }
  }

  return changes
}

export function computeDiff(csvRows, firestoreMembers) {
  const csvById = Object.fromEntries(csvRows.map(r => [r.mhspNumber, r]))

  // Active-only view drives "same ID, unchanged/updated" vs "ID missing from CSV"
  // exactly as before — zero behavior change for the ~97% of members whose MHSP#
  // doesn't change between imports.
  const activeMembers = firestoreMembers.filter(m => m.active !== false)
  const fsById = Object.fromEntries(activeMembers.map(m => [m.id, m]))

  const csvIds = new Set(Object.keys(csvById))
  const fsIds  = new Set(Object.keys(fsById))

  const addedIds   = [...csvIds].filter(id => !fsIds.has(id))
  const removedIds = [...fsIds].filter(id => !csvIds.has(id))
  const commonIds  = [...csvIds].filter(id => fsIds.has(id))

  // Rename candidate pool = this run's removed docs (still active:true right now,
  // about to be deactivated below) plus every already-inactive doc in Firestore —
  // the latter is what lets a promotion get linked up even if the old number's
  // disappearance and the new number's appearance landed in different imports.
  // Exclude anything whose ID is still present in the CSV (already handled via its
  // own direct MHSP# match above) so a transitional "dual-listed" row can never be
  // treated as both an unchanged record and a rename source.
  const candidatePool = [
    ...removedIds.map(id => fsById[id]),
    ...firestoreMembers.filter(m => m.active === false && !csvIds.has(m.id)),
  ]

  const identityIndex = {}
  for (const doc of candidatePool) {
    const key = identityKey(doc.email, doc.lastName)
    if (!key) continue
    if (!identityIndex[key]) identityIndex[key] = []
    identityIndex[key].push(doc)
  }

  const renames      = []
  const ambiguous    = []
  const matchedOldIds = new Set()
  const matchedNewIds = new Set()

  for (const newId of addedIds) {
    const row = csvById[newId]
    const key = identityKey(row.email, row.lastName)
    if (!key) continue

    const candidates = (identityIndex[key] || []).filter(doc => !matchedOldIds.has(doc.id))
    if (candidates.length === 0) continue // no (remaining) candidate — falls through to "new member"

    if (candidates.length === 1) {
      const doc = candidates[0]
      matchedOldIds.add(doc.id)
      matchedNewIds.add(newId)
      renames.push({
        oldId: doc.id,
        newId,
        name: `${doc.firstName} ${doc.lastName}`,
        emailChanged: norm(doc.email) !== norm(row.email),
        addressChanged: norm(doc.address) !== norm(row.address),
        hasClaim: !!(doc.claimed && doc.claimedBy),
        claimedBy: doc.claimedBy || null,
        oldData: doc,
        newData: row,
      })
    } else {
      // Multiple existing records share this identity (last name + email) — can't
      // confidently pick one. Surfaced to the admin as needing manual resolution,
      // same as today's blocked-commit ambiguous case.
      ambiguous.push({
        oldId: newId,
        name: `${row.firstName} ${row.lastName}`,
        candidates: candidates.map(doc => ({ id: doc.id, email: doc.email })),
        hasClaim: candidates.some(doc => !!(doc.claimed && doc.claimedBy)),
      })
    }
  }

  // Firestore members removed from the CSV that weren't claimed by a rename above
  const deactivated = removedIds
    .filter(id => !matchedOldIds.has(id))
    .map(id => {
      const doc = fsById[id]
      return {
        id,
        name: `${doc.firstName} ${doc.lastName}`,
        hasClaim: !!(doc.claimed && doc.claimedBy),
        claimedBy: doc.claimedBy || null,
        data: doc,
      }
    })

  // Truly new members (added IDs not claimed by a rename)
  const newMembers = addedIds
    .filter(id => !matchedNewIds.has(id))
    .map(id => ({ id, data: csvById[id] }))

  // Field-level updates for members present in both datasets
  const updated = []
  for (const id of commonIds) {
    const changes = detectFieldChanges(fsById[id], csvById[id])
    if (Object.keys(changes).length > 0) {
      updated.push({
        id,
        name: `${fsById[id].firstName} ${fsById[id].lastName}`,
        addressChanged: 'address' in changes,
        changes,
        newData: csvById[id],
        oldData: fsById[id],
      })
    }
  }

  return { renames, newMembers, updated, deactivated, ambiguous }
}

/**
 * Parse raw CSV rows (from csv-parse) into normalized member objects.
 * Rows with a blank MHSP Number are skipped.
 */
export function parseCsvRows(rawRows) {
  return rawRows
    .map(row => {
      const mhspNumber = row['MHSP Number']?.trim()
      if (!mhspNumber) return null

      const classifications = row['Classifications']
        ? row['Classifications'].split(',').map(c => c.trim()).filter(Boolean)
        : []

      return {
        mhspNumber,
        firstName: row['First Name']?.trim() || '',
        lastName: row['Last Name']?.trim() || '',
        email: row['Email']?.trim() || '',
        status: row['Status']?.trim() || '',
        classifications,
        address: row['Addresses']?.trim() || '',
      }
    })
    .filter(Boolean)
}
