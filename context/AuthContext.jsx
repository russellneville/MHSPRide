'use client';
import { auth, db } from '@/lib/firebaseClient';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, updateEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react'
import { toast } from 'sonner';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

    useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          const docSnap = await getDoc(doc(db, "users", firebaseUser.uid));
          setUser({ uid: firebaseUser.uid, ...docSnap.data() });
        } else {
          setUser(null);
        }
        setIsLoading(false)
      });

  return () => unsubscribe();
}, []);


  const registerUser = async ({ email, password, fullname, lastName, mhspNumber, birthdate, roleform, phone }) => {
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
        role: roleform.role,
        roleform,
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

      const docSnap = await getDoc(doc(db, 'users', user.uid))
      setUser({ uid: user.uid, ...docSnap.data() })
      router.push('/login')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const loginUser = async ({email , password})=>{
    try {
      setIsLoading(true)
      await signInWithEmailAndPassword(auth , email , password)
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
      toast.success('User updated successfully')
    }
    catch (error){
      toast.error(error.message)
    }
    finally{
      setIsLoading(false)
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
    <AuthContext.Provider value={{ isLoading, user, registerUser , loginUser , updateProfile , logOut}}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
