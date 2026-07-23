'use client';
import { auth, db, storage } from '@/lib/firebaseClient';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, updateEmail } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { logEvent } from '@/lib/activityLog';

import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react'
import { toast } from 'sonner';

const AuthContext = createContext();

const SUSPENDED_MESSAGE = 'Your account has been suspended. Please contact an MHSPRide admin.'

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [suspendedMessage, setSuspendedMessage] = useState(null);
  const router = useRouter();

    useEffect(() => {
      let unsubDoc = null;

      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (unsubDoc) { unsubDoc(); unsubDoc = null }

        if (firebaseUser) {
          unsubDoc = onSnapshot(doc(db, "users", firebaseUser.uid), (docSnap) => {
            const data = docSnap.data()
            if (data?.suspended) {
              signOut(auth)
              setSuspendedMessage(SUSPENDED_MESSAGE)
            } else {
              setUser({ uid: firebaseUser.uid, ...data });
            }
            setIsLoading(false)
          });
        } else {
          setUser(null);
          setIsLoading(false)
        }
      });

  return () => { unsubscribe(); if (unsubDoc) unsubDoc() }
}, []);


  const registerUser = async ({ email, password, fullname, lastName, mhspNumber, birthdate, phone }) => {
    try {
      setIsLoading(true)

      // Guard against account-creation spam / membership-check enumeration before
      // touching Firestore or Firebase Auth at all. Fails open on network error.
      const guard = await fetch('/api/register-guard', { method: 'POST' })
        .then(r => r.json())
        .catch(() => ({ ok: true, blocked: false }))
      if (guard.blocked) {
        throw new Error('Too many registration attempts from this network. Please try again later.')
      }

      // Step 1: Verify MHSP membership
      const memberRef = doc(db, 'members', String(mhspNumber).trim())
      const memberSnap = await getDoc(memberRef)

      if (!memberSnap.exists()) {
        throw new Error('MHSP member number not found.')
      }

      const memberData = memberSnap.data()

      if (memberData.lastName.toLowerCase().trim() !== lastName.toLowerCase().trim()) {
        throw new Error('Last name does not match our records.')
      }

      if (memberData.claimed) {
        throw new Error('This membership has already been registered.')
      }

      // Step 2: Create Firebase Auth account
      const { user } = await createUserWithEmailAndPassword(auth, email, password)

      // Step 3: Create user document with member data copied over
      await setDoc(doc(db, 'users', user.uid), {
        email,
        fullname,
        phone,
        birthdate,
        bio: '',
        role: 'member',
        mhspNumber: String(mhspNumber).trim(),
        classifications: memberData.classifications || [],
        latitude: memberData.latitude || null,
        longitude: memberData.longitude || null,
        created_at: new Date(),
      })

      // Step 4: Claim the member record
      await updateDoc(memberRef, {
        claimed: true,
        claimedBy: user.uid,
      })

      toast.success('Account created successfully')

      // Log registration event (fire-and-forget)
      logEvent({
        type: 'user.registered',
        message: `New user registered: ${fullname}`,
        userId: user.uid,
        userName: fullname,
        mhspNumber: String(mhspNumber).trim(),
        metadata: { email },
      }).catch(() => {})

      // Send welcome email (fire-and-forget)
      user.getIdToken().then(token => {
        fetch('/api/notify-registration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ email, fullname }),
        }).catch(err => console.error('[notify-registration]', err))
      }).catch(() => {})

      const docSnap = await getDoc(doc(db, 'users', user.uid))
      setUser({ uid: user.uid, ...docSnap.data() })
      router.push('/login')
    } catch (error) {
      console.error('[registerUser]', error.code, error.message, error)
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const loginUser = async ({email , password})=>{
    try {
      setIsLoading(true)
      setSuspendedMessage(null)

      // Ask before attempting — blocks in the UI without ever calling Firebase
      // if this email/IP is in cooldown from recent failures. Fails open.
      const guard = await fetch('/api/login-guard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }).then(r => r.json()).catch(() => ({ ok: true, blocked: false }))

      if (guard.blocked) {
        const mins = guard.retryAfterMs ? Math.ceil(guard.retryAfterMs / 60000) : null
        toast.error(mins ? `Too many login attempts. Try again in ${mins} min.` : 'Too many login attempts. Please wait and try again.')
        return
      }

      const { user: fbUser } = await signInWithEmailAndPassword(auth , email , password)

      const docSnap = await getDoc(doc(db, 'users', fbUser.uid))
      const userData = docSnap.data()
      if (userData?.suspended) {
        // Suspended accounts can't write to activity_log themselves (same rule that
        // blocks all their other writes), so log via the admin-backed API route
        // while the session token is still valid, before signing out.
        const token = await fbUser.getIdToken().catch(() => null)
        fetch('/api/log-auth-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
          body: JSON.stringify({ email, reason: 'suspended' }),
        }).catch(() => {})
        await signOut(auth)
        setSuspendedMessage(SUSPENDED_MESSAGE)
        return
      }

      toast.success('User login successfully')
      logEvent({
        type: 'user.login',
        message: `User logged in: ${userData?.fullname || email}`,
        userId: fbUser.uid,
        userName: userData?.fullname,
        mhspNumber: userData?.mhspNumber,
        metadata: { email },
      }).catch(() => {})
      router.push('/dashboard')
    }
    catch(error){
      toast.error(error.message)
      // No authenticated session exists at this point, so this can't go through
      // the client Firestore SDK (activity_log requires auth) — use the API route.
      fetch('/api/log-auth-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, reason: error.code || 'unknown' }),
      }).catch(() => {})
    }
    finally {
      setIsLoading(false)
    }
  }

  const updateProfile = async (data)=>{
    setIsLoading(true)
    try {
      const userRef = doc(db , 'users' , auth.currentUser.uid)
      await updateDoc (userRef , data)
      setUser(prev => ({ ...prev, ...data }))
      toast.success('User updated successfully')
      logEvent({
        type: 'user.profile_updated',
        message: `Profile updated: ${user?.fullname || auth.currentUser.uid}`,
        userId: auth.currentUser.uid,
        userName: user?.fullname,
        mhspNumber: user?.mhspNumber,
        metadata: { fields: Object.keys(data) },
      }).catch(() => {})
    }
    catch (error){
      toast.error(error.message)
    }
    finally{
      setIsLoading(false)
    }
  }

  const uploadPhoto = async (file) => {
    if (!file.type.startsWith('image/')) {
      toast.error('File must be an image.')
      return null
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be 5 MB or smaller.')
      return null
    }
    try {
      const uid = auth.currentUser.uid
      const storageRef = ref(storage, `profile-photos/${uid}`)
      await uploadBytes(storageRef, file)
      const downloadURL = await getDownloadURL(storageRef)
      await updateDoc(doc(db, 'users', uid), { photoURL: downloadURL })
      setUser(prev => ({ ...prev, photoURL: downloadURL }))
      toast.success('Photo updated.')
      return downloadURL
    } catch (error) {
      console.error('[uploadPhoto]', error)
      toast.error(error.message)
      return null
    }
  }

  const resetPassword = async (email) => {
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.status === 429) {
        toast.error('Too many reset requests for this email. Please wait and try again later.')
        return
      }
      if (!res.ok) throw new Error('Could not send reset email')
      toast.success('Password reset email sent. Check your inbox.')
      logEvent({
        type: 'user.password_reset_requested',
        message: `Self-service password reset requested: ${email}`,
        metadata: { email },
      }).catch(() => {})
    } catch (error) {
      toast.error(error.message)
    }
  }

    const logOut = async ()=>{
        try {
          // Log while the session is still valid — activity_log writes require
          // an authenticated request, so this must happen before signOut clears it.
          if (user) {
            await logEvent({
              type: 'user.logout',
              message: `User logged out: ${user.fullname || user.uid}`,
              userId: user.uid,
              userName: user.fullname,
              mhspNumber: user.mhspNumber,
            }).catch(() => {})
          }
          await signOut(auth)
        }
        catch(error){
          toast.error(error.message)
        }
    }


  return (
    <AuthContext.Provider value={{ isLoading, user, registerUser , loginUser , updateProfile , logOut, uploadPhoto, resetPassword, suspendedMessage }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
