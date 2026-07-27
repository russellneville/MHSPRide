import { ref, getDownloadURL } from 'firebase/storage'
import { storage } from '@/lib/firebaseClient'

// Snapshotted photoURLs on ride/booking docs go stale whenever the owner
// re-uploads a photo (Storage rotates the download token on overwrite).
// Storage rules allow any authenticated user to read profile-photos/{uid},
// so resolving it live here works regardless of who's viewing.
const cache = new Map()

export function resolveLivePhotoUrl(uid) {
  if (!uid) return Promise.resolve(null)
  if (cache.has(uid)) return cache.get(uid)

  const promise = getDownloadURL(ref(storage, `profile-photos/${uid}`))
    .catch(() => null)
  cache.set(uid, promise)
  return promise
}
