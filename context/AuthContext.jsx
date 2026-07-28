'use client';
import { auth, db, storage } from '@/lib/firebaseClient';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { logEvent } from '@/lib/activityLog';

import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react'
import { toast } from 'sonner';

const AuthContext = createContext();

const SUSPENDED_MESSAGE = 'Your account has been suspended. Please contact an MHSPRide admin.'

// super-admin is a strict superset of admin — maintenance mode never signs
// either of them out or blocks their login (issue #108).
const ADMIN_ROLES = ['admin', 'super-admin']
const MAINTENANCE_MESSAGE = (message) =>
  `MHSP Ride is in maintenance mode. Please check back shortly.${message ? ` SYSTEM MESSAGE: ${message}` : ''}`

// Firebase's raw error.message (e.g. "Firebase: Error (auth/invalid-credential).")
// isn't something we want surfaced to users — map known auth error codes to
// site-defined copy instead.
const getLoginErrorMessage = (code) => {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Incorrect email or password. Please try again.'
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact an MHSPRide admin.'
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a moment and try again.'
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.'
    default:
      return 'Unable to log in. Please try again.'
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [suspendedMessage, setSuspendedMessage] = useState(null);
  const [maintenanceMode, setMaintenanceMode] = useState({ enabled: false, message: '' });
  const [maintenanceMessage, setMaintenanceMessage] = useState(null);
  const router = useRouter();

  // Publicly readable (config/maintenance) so this works for signed-out
  // visitors too — independent of the auth-state effect below.
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'config', 'maintenance'),
      snap => {
        const data = snap.data()
        setMaintenanceMode({ enabled: !!data?.enabled, message: data?.message || '' })
      },
      err => console.error('[maintenanceMode]', err)
    )
    return unsubscribe
  }, []);

  // Forces a standard member's session to end the moment maintenance mode
  // turns on (not just on their next user-doc change or page load) — mirrors
  // the suspended-account precedent below but keyed off maintenanceMode
  // instead of the user doc, since toggling maintenance on doesn't touch any
  // signed-in user's own document.
  useEffect(() => {
    if (maintenanceMode.enabled && user && !ADMIN_ROLES.includes(user.role)) {
      signOut(auth)
      setMaintenanceMessage(MAINTENANCE_MESSAGE(maintenanceMode.message))
    }
  }, [maintenanceMode.enabled, user]);

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


  // Step 1 of registration: server-side match on MHSP#/last name/Troopiter email.
  // On success a code is emailed and a short-lived verification token is returned.
  const verifyMembership = async ({ mhspNumber, lastName, troopiterEmail }) => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/register/verify-membership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mhspNumber, lastName, troopiterEmail }),
      })
      const data = await res.json()
      if (!data.ok) {
        toast.error(data.error || 'Could not verify membership.')
        return { ok: false, error: data.error }
      }
      return { ok: true, token: data.token }
    } catch (error) {
      console.error('[verifyMembership]', error)
      toast.error('Something went wrong. Please try again.')
      return { ok: false }
    } finally {
      setIsLoading(false)
    }
  }

  // Step 2: check the emailed code against the verification token from step 1.
  const verifyRegistrationCode = async ({ token, code }) => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/register/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code }),
      })
      const data = await res.json()
      if (!data.ok) {
        toast.error(data.error || 'Incorrect code.')
        return { ok: false, expired: !!data.expired, locked: !!data.locked, error: data.error }
      }
      return { ok: true }
    } catch (error) {
      console.error('[verifyRegistrationCode]', error)
      toast.error('Something went wrong. Please try again.')
      return { ok: false }
    } finally {
      setIsLoading(false)
    }
  }

  // Step 3/4: create the account server-side (Admin SDK), then sign in on the
  // client to establish the session and continue into vehicle/network onboarding.
  const completeRegistration = async ({ token, email, password, fullname, phone }) => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/register/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password, fullname, phone }),
      })
      const data = await res.json()
      if (!data.ok) {
        toast.error(data.error || 'Could not create account.')
        return { ok: false, expired: !!data.expired, error: data.error }
      }

      toast.success('Account created successfully')
      const { user: fbUser } = await signInWithEmailAndPassword(auth, email, password)
      const docSnap = await getDoc(doc(db, 'users', fbUser.uid))
      setUser({ uid: fbUser.uid, ...docSnap.data() })
      router.push('/dashboard/onboarding')
      return { ok: true }
    } catch (error) {
      console.error('[completeRegistration]', error)
      toast.error('Account was created but signing in failed. Please log in.')
      router.push('/login')
      return { ok: false }
    } finally {
      setIsLoading(false)
    }
  }

  const loginUser = async ({email , password})=>{
    try {
      setIsLoading(true)
      setSuspendedMessage(null)
      setMaintenanceMessage(null)

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

      // Standard members are locked out during maintenance mode; admins and
      // super-admins bypass this entirely (issue #108).
      if (maintenanceMode.enabled && !ADMIN_ROLES.includes(userData?.role)) {
        await signOut(auth)
        setMaintenanceMessage(MAINTENANCE_MESSAGE(maintenanceMode.message))
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
      toast.error(getLoginErrorMessage(error.code))
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

  // Both the email and password change routes mutate Firebase Auth via the Admin SDK
  // server-side (never the client updateEmail/updatePassword calls) — Firebase's
  // client-side email change can require verifyBeforeUpdateEmail depending on project
  // settings, which sends a verification email through Firebase's own mailer instead of
  // Resend. The client reauthenticates for immediate UX feedback, but the server route
  // independently re-verifies currentPassword before mutating anything — a stolen/valid
  // ID token alone isn't accepted as proof of current-password knowledge.
  const changeEmail = async (currentPassword, newEmail) => {
    setIsLoading(true)
    try {
      // Reauth against `user.email` (this context's own state), not auth.currentUser.email —
      // the Admin SDK email change below never touches the client SDK's cached user object,
      // so auth.currentUser.email goes stale the moment an email change succeeds and would
      // break reauth on any subsequent change within the same session.
      const credential = EmailAuthProvider.credential(user?.email, currentPassword)
      await reauthenticateWithCredential(auth.currentUser, credential)

      const token = await auth.currentUser.getIdToken()
      const res = await fetch('/api/account/update-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newEmail, currentPassword }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Could not update email')

      setUser(prev => ({ ...prev, email: newEmail }))
      toast.success('Email updated successfully')
      logEvent({
        type: 'user.email_updated',
        message: `Email updated: ${user?.fullname || auth.currentUser.uid}`,
        userId: auth.currentUser.uid,
        userName: user?.fullname,
        mhspNumber: user?.mhspNumber,
      }).catch(() => {})
      return { ok: true }
    } catch (error) {
      const wrongPassword = ['auth/wrong-password', 'auth/invalid-credential'].includes(error.code)
      toast.error(wrongPassword ? 'Current password is incorrect.' : (error.message || 'Could not update email'))
      return { ok: false }
    } finally {
      setIsLoading(false)
    }
  }

  const changePassword = async (currentPassword, newPassword) => {
    setIsLoading(true)
    try {
      const credential = EmailAuthProvider.credential(user?.email, currentPassword)
      await reauthenticateWithCredential(auth.currentUser, credential)

      const token = await auth.currentUser.getIdToken()
      const res = await fetch('/api/account/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword, currentPassword }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Could not update password')

      toast.success('Password updated successfully')
      logEvent({
        type: 'user.password_updated',
        message: `Password updated: ${user?.fullname || auth.currentUser.uid}`,
        userId: auth.currentUser.uid,
        userName: user?.fullname,
        mhspNumber: user?.mhspNumber,
      }).catch(() => {})
      return { ok: true }
    } catch (error) {
      const wrongPassword = ['auth/wrong-password', 'auth/invalid-credential'].includes(error.code)
      toast.error(wrongPassword ? 'Current password is incorrect.' : (error.message || 'Could not update password'))
      return { ok: false }
    } finally {
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
    <AuthContext.Provider value={{ isLoading, user, verifyMembership, verifyRegistrationCode, completeRegistration, loginUser , updateProfile , logOut, uploadPhoto, resetPassword, changeEmail, changePassword, suspendedMessage, maintenanceMode, maintenanceMessage }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
