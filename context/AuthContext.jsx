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
      const { user: fbUser } = await signInWithEmailAndPassword(auth , email , password)

      const docSnap = await getDoc(doc(db, 'users', fbUser.uid))
      if (docSnap.data()?.suspended) {
        await signOut(auth)
        setSuspendedMessage(SUSPENDED_MESSAGE)
        return
      }

      toast.success('User login successfully')
      router.push('/dashboard')
    }
    catch(error){
      toast.error(error.message)
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
      if (!res.ok) throw new Error('Could not send reset email')
      toast.success('Password reset email sent. Check your inbox.')
    } catch (error) {
      toast.error(error.message)
    }
  }

    const logOut = async ()=>{
        try {
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
