'use client'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from './firebaseClient'

const MAX_SAVED_LOCATIONS = 8

// Per-user MRU list of validated addresses used in a Troopiter Offer/Request
// Ride dialog (issue #199) — stands in for canned Locations, which don't
// make sense once carpooling spans many geographically unrelated patrols.
// Deduped by formatted address, most-recent-first, capped at 8. Read-then-write
// rather than a transaction — acceptable for a personal MRU list with no
// concurrent-writer risk in practice (a user isn't offering two rides at once).
export async function saveRecentLocation(uid, { address, lat, lng }) {
  if (!uid || !address || lat == null || lng == null) return
  try {
    const userRef = doc(db, 'users', uid)
    const snap = await getDoc(userRef)
    const existing = Array.isArray(snap.data()?.savedLocations) ? snap.data().savedLocations : []
    const deduped = existing.filter(l => l.address !== address)
    const next = [{ address, lat, lng }, ...deduped].slice(0, MAX_SAVED_LOCATIONS)
    await updateDoc(userRef, { savedLocations: next })
  } catch (err) {
    console.error('[saveRecentLocation]', err)
  }
}
