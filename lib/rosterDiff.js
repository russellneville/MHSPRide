/**
 * Pure roster diff logic — no Firestore dependencies.
 *
 * csvRows:          array of objects from parseCsvRows()
 * firestoreMembers: array of { id, firstName, lastName, email, status,
 *                              classifications, address, latitude, longitude,
 *                              active, claimed, claimedBy }
 */

function norm(s) {
  return (s || '').trim().toLowerCase()
}

function classKey(arr) {
  return (arr || []).slice().sort().join('|')
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
  const fsById  = Object.fromEntries(firestoreMembers.map(m => [m.id, m]))

  const csvIds = new Set(Object.keys(csvById))
  const fsIds  = new Set(Object.keys(fsById))

  const addedIds   = [...csvIds].filter(id => !fsIds.has(id))
  const removedIds = [...fsIds].filter(id => !csvIds.has(id))
  const commonIds  = [...csvIds].filter(id => fsIds.has(id))

  // Build name → [newId] index over added IDs for rename detection
  const addedByName = {}
  for (const id of addedIds) {
    const row = csvById[id]
    const key = `${norm(row.firstName)}|${norm(row.lastName)}`
    if (!addedByName[key]) addedByName[key] = []
    addedByName[key].push(id)
  }

  const renames    = []
  const ambiguous  = []
  const deactivated = []
  const matchedNewIds = new Set()

  for (const oldId of removedIds) {
    const doc = fsById[oldId]
    const key = `${norm(doc.firstName)}|${norm(doc.lastName)}`
    const matches = addedByName[key] || []

    if (matches.length === 1) {
      const newId = matches[0]
      matchedNewIds.add(newId)
      const newRow = csvById[newId]
      renames.push({
        oldId,
        newId,
        name: `${doc.firstName} ${doc.lastName}`,
        emailChanged: norm(doc.email) !== norm(newRow.email),
        addressChanged: norm(doc.address) !== norm(newRow.address),
        hasClaim: !!(doc.claimed && doc.claimedBy),
        claimedBy: doc.claimedBy || null,
        oldData: doc,
        newData: newRow,
      })
    } else if (matches.length > 1) {
      ambiguous.push({
        oldId,
        name: `${doc.firstName} ${doc.lastName}`,
        candidates: matches.map(id => ({ id, email: csvById[id].email })),
        hasClaim: !!(doc.claimed && doc.claimedBy),
      })
    } else {
      deactivated.push({
        id: oldId,
        name: `${doc.firstName} ${doc.lastName}`,
        hasClaim: !!(doc.claimed && doc.claimedBy),
        claimedBy: doc.claimedBy || null,
        data: doc,
      })
    }
  }

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
