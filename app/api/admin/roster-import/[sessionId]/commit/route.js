import { NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/adminAuth'
import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'
import { geocodeAddress } from '@/lib/geocodeAddress'

export async function POST(request, { params }) {
  const auth = await verifyAdminRequest(request)
  if (auth.error) return auth.error

  const { sessionId } = await params
  const db = getAdminDb()

  // Load and validate session
  const sessionRef = db.collection('import_sessions').doc(sessionId)
  const sessionSnap = await sessionRef.get()

  if (!sessionSnap.exists) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const session = sessionSnap.data()

  if (session.status === 'committed') {
    return NextResponse.json({ error: 'Already committed' }, { status: 409 })
  }

  const now = new Date()
  const expiresAt = session.expiresAt?.toDate ? session.expiresAt.toDate() : new Date(session.expiresAt)
  if (now > expiresAt) {
    return NextResponse.json({ error: 'Session expired — please re-upload the CSV' }, { status: 410 })
  }

  const { diff } = session
  const summary = { renames: 0, newMembers: 0, updated: 0, deactivated: 0, accountsDisabled: 0, geocoded: 0 }

  // Geocode only when the member is Active and has an address.
  // Inactive/past members are stored with null coords — they can't register anyway.
  async function resolveCoords(address, status, existingLatitude, existingLongitude) {
    if (address && status === 'Active') {
      try {
        const coords = await geocodeAddress(address)
        summary.geocoded++
        return coords
      } catch (err) {
        console.warn(`[roster-import] geocode failed for "${address}":`, err.message)
      }
    }
    return { latitude: existingLatitude ?? null, longitude: existingLongitude ?? null }
  }

  // Helper: find user UID by mhspNumber
  async function findUserByMhspNumber(mhspNumber) {
    const snap = await db.collection('users').where('mhspNumber', '==', mhspNumber).limit(1).get()
    return snap.empty ? null : { uid: snap.docs[0].id, ...snap.docs[0].data() }
  }

  // 1. Renames
  for (const rename of diff.renames) {
    const { oldId, newId, addressChanged, hasClaim, claimedBy, oldData, newData } = rename

    const coords = addressChanged
      ? await resolveCoords(newData.address, newData.status, null, null)
      : { latitude: oldData.latitude ?? null, longitude: oldData.longitude ?? null }

    const newDoc = {
      mhspNumber:      newId,
      firstName:       newData.firstName,
      lastName:        newData.lastName,
      email:           newData.email,
      status:          newData.status,
      classifications: newData.classifications,
      address:         newData.address,
      latitude:        coords.latitude,
      longitude:       coords.longitude,
      active:          true,
      claimed:         oldData.claimed ?? false,
      claimedBy:       oldData.claimedBy ?? null,
    }

    const batch = db.batch()
    batch.set(db.collection('members').doc(newId), newDoc)
    // Clear claimed/claimedBy on the superseded doc — the claim (if any) is being
    // migrated to newId below. Leaving it set would let this doc's now-stale
    // claimed:true resurface (e.g. in the admin roster page, or wrongly block a
    // future member from registering if this MHSP# is ever reissued).
    batch.update(db.collection('members').doc(oldId), { active: false, claimed: false, claimedBy: null })
    await batch.commit()

    // Migrate the user account if claimed
    if (hasClaim && claimedBy) {
      const userUpdate = {
        mhspNumber: newId,
        classifications: newData.classifications,
        latitude: coords.latitude,
        longitude: coords.longitude,
      }
      // Store new roster email separately — do not overwrite login email
      if (rename.emailChanged) userUpdate.rosterEmail = newData.email
      await db.collection('users').doc(claimedBy).update(userUpdate)
    }

    await db.collection('activity_log').add({
      type:        'member.id_changed',
      message:     `Member ID changed: ${newData.firstName} ${newData.lastName} #${oldId} → #${newId}`,
      userId:      auth.uid,
      userName:    'Admin',
      userMhspHex: null,
      metadata:    { oldId, newId, hadAccount: hasClaim },
      timestamp:   new Date(),
    })

    summary.renames++
  }

  // 2. New members — geocode Active members in parallel (10 at a time), then batch-write to Firestore
  const GEOCODE_CONCURRENCY = 10
  const FIRESTORE_BATCH_SIZE = 500

  async function geocodeInParallel(members) {
    const results = []
    for (let i = 0; i < members.length; i += GEOCODE_CONCURRENCY) {
      const chunk = members.slice(i, i + GEOCODE_CONCURRENCY)
      const coords = await Promise.all(
        chunk.map(({ id, data }) => resolveCoords(data.address, data.status, null, null))
      )
      results.push(...chunk.map((m, j) => ({ ...m, coords: coords[j] })))
    }
    return results
  }

  const geocodedNew = await geocodeInParallel(diff.newMembers)

  for (let i = 0; i < geocodedNew.length; i += FIRESTORE_BATCH_SIZE) {
    const chunk = geocodedNew.slice(i, i + FIRESTORE_BATCH_SIZE)
    const batch = db.batch()
    for (const { id, data, coords } of chunk) {
      batch.set(db.collection('members').doc(id), {
        mhspNumber:      id,
        firstName:       data.firstName,
        lastName:        data.lastName,
        email:           data.email,
        status:          data.status,
        classifications: data.classifications,
        address:         data.address,
        latitude:        coords.latitude,
        longitude:       coords.longitude,
        active:          true,
        claimed:         false,
        claimedBy:       null,
      })
    }
    await batch.commit()
    summary.newMembers += chunk.length
  }

  // 3. Field updates
  for (const update of diff.updated) {
    const { id, addressChanged, newData, oldData } = update

    const coords = addressChanged
      ? await resolveCoords(newData.address, newData.status, null, null)
      : { latitude: oldData.latitude ?? null, longitude: oldData.longitude ?? null }

    const updatePayload = {
      firstName:       newData.firstName,
      lastName:        newData.lastName,
      email:           newData.email,
      status:          newData.status,
      classifications: newData.classifications,
      address:         newData.address,
      latitude:        coords.latitude,
      longitude:       coords.longitude,
    }

    await db.collection('members').doc(id).update(updatePayload)
    summary.updated++
  }

  // 4. Deactivations
  for (const deact of diff.deactivated) {
    const { id, hasClaim, claimedBy } = deact

    await db.collection('members').doc(id).update({ active: false })

    if (hasClaim && claimedBy) {
      try {
        await getAdminAuth().updateUser(claimedBy, { disabled: true })
        summary.accountsDisabled++
      } catch (err) {
        console.error(`[roster-import] failed to disable auth account ${claimedBy}:`, err.message)
      }
    }

    await db.collection('activity_log').add({
      type:        'member.deactivated',
      message:     `Member deactivated: ${deact.name} #${id}`,
      userId:      auth.uid,
      userName:    'Admin',
      userMhspHex: null,
      metadata:    { memberId: id, accountDisabled: hasClaim && !!claimedBy },
      timestamp:   new Date(),
    })

    summary.deactivated++
  }

  // Mark session committed
  await sessionRef.update({ status: 'committed', committedAt: new Date(), summary })

  return NextResponse.json({ ok: true, ...summary })
}
