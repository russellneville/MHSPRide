import { db } from '@/lib/firebaseClient'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

export async function logEvent({ type, message, userId, userName, mhspNumber, metadata = {} }) {
  const mhspHex = mhspNumber
    ? parseInt(String(mhspNumber).trim(), 10).toString(16).toUpperCase().padStart(4, '0')
    : null
  try {
    await addDoc(collection(db, 'activity_log'), {
      type,
      message,
      userId: userId || null,
      userName: userName || null,
      userMhspHex: mhspHex,
      metadata,
      timestamp: serverTimestamp(),
    })
  } catch (e) {
    console.error('[logEvent]', e)
  }
}
