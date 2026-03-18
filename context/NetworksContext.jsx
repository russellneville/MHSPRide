'use client'
import { auth, db } from "@/lib/firebaseClient";
import { arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { toast } from "sonner";
import { createContext, useContext, useEffect, useState } from 'react'
const NetworkContext = createContext()

export const NetworkProvider = ({children})=>{
    const [isLoading, setIsLoading] = useState(true);
    const generateInviteCode = ()=>{
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    }
    // Create New network 
  const createNetwork = async (data)=>{
    try {
      setIsLoading(true)
      const inviteCode = generateInviteCode()

      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userDoc.data();


      if (userData?.role == 'director'){
        await setDoc(doc(db , 'networks' , `network-${inviteCode}`) , 
            {
                ...data , 
                directorId : auth.currentUser.uid,
                director : userData,
                passengers : [] , 
                drivers : [],
                passengersIds : [],
                driversIds : [],
                created_at : new Date()
            })
        toast.success('Network created successfully')
      }
      else {
        throw new Error('You do not have permission to create network')
      }
      
    } 
    catch (error){
        console.log(error)
        toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
    
  } 

  // Join netwrok func
  const joinNetwork = async (id) => {
  setIsLoading(true);
  try {
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    const userData = userDoc.data();
    if (!userData) throw new Error("User data not found");

    if (!id) {
      throw new Error('Invite code cannot be null')
    }

    const docRef = doc(db, 'networks', id);
    const networkSnap = await getDoc(docRef);

    if (!networkSnap.exists()) throw new Error("Network not found");

    const networkData = networkSnap.data();
    const uid = auth.currentUser.uid;

   
    const alreadyPassenger = networkData.passengersIds?.includes(uid);
    const alreadyDriver = networkData.driversIds?.includes(uid);
    if (alreadyPassenger || alreadyDriver) {
      toast.error("You have already joined this network");
      return;
    }

    await updateDoc(docRef, {
      passengersIds: arrayUnion(uid),
      passengers: arrayUnion({
        role: 'member',
        id: uid,
        fullname: userData.fullname,
        email: userData.email,
        phone: userData.phone,
        joined_at: new Date(),
      }),
    });

    toast.success("Network joined successfully");
  } catch (error) {
    console.error(error);
    toast.error(error.message);
  } finally {
    setIsLoading(false);
  }
};


  // Get single network 
  const getNetwork = async (id)=>{
    setIsLoading(true)
    try {
        const userId = auth.currentUser.uid;
        const currNetwork = doc(db , 'networks' , id)
        const snapshot = await getDoc(currNetwork)
        const data = snapshot.data()
        if (snapshot.exists()) {
          const isAuthorized =
            data.directorId === userId ||
            data.passengersIds?.includes(userId) ||
            data.driversIds?.includes(userId);
          return isAuthorized ? data : null;
        }
        return null
    }
    catch (error){
        toast.error(error.message)
    }
    finally {
      setIsLoading(false)
    }
    
  }

  const offerRide = async (rideData , networkId)=>{
    try {
      setIsLoading(true)
      const inviteCode = generateInviteCode()

      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userDoc.data();

      const networkRef = doc(db, "networks", networkId);
      const snapshot = await getDoc(networkRef);

      const data = snapshot.data();
      const member = data.drivers.find(p => p.id === auth.currentUser.uid) ||
                     data.passengers.find(p => p.id === auth.currentUser.uid);

      if (!member){
        throw new Error('You must join this network before offering a ride')
      }

      {
        await setDoc(doc(db , 'rides' , `ride-${inviteCode}`) ,
          {
              ...rideData ,
              started_at : '',
              finished_at : '' ,
              available_seats : rideData.total_seats,
              driver : {...userData , id : auth.currentUser.uid},
              driverId : auth.currentUser.uid,
              network_id : networkId,
              passengers : [],
              ride_status : 'not started',
              created_at: new Date()
          })
        toast.success('Ride created successfully')
      }
      
    } 
    catch (error){
        console.log(error)
        toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const getRidesByNetworkId = async (networkId)=>{
    try {
      setIsLoading(true)
      const rideRef = collection(db, 'rides');
      const q = query(rideRef, where('network_id', '==', networkId));
      const snapshot = await getDocs(q);
      const rides = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
      }));
      return rides

    }
    catch {
      toast.error(error.message)
      return []
    }
    finally{
      setIsLoading(false)
    }
  }


  const findRide = async ({departure , arrival , departure_date} , networkId)=>{
    try {
      setIsLoading(true)
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userDoc.data();

      const ridesRef = collection(db , 'rides')

      const networkRef = doc(db, "networks", networkId);
      const snapshot = await getDoc(networkRef);

      const data = snapshot.data();
      const member = data.passengers.find(p => p.id === auth.currentUser.uid) ||
                     data.drivers.find(p => p.id === auth.currentUser.uid);

      if (!member){
        throw new Error('You must join this network before finding a ride')
      }

      const q = query(ridesRef, where("departure", "==", departure.toLowerCase()) ,
                                where("arrival", "==", arrival.toLowerCase()),
                                where("departure_date", "==", departure_date) ,
                                where("network_id", "==", networkId) ,
                                where ('ride_status' , "==" , "not started") ,
                                );
      const ridesSnapshot = await getDocs(q);
      return ridesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                
    }
    catch (error){
      toast.error(error.message)
      return [] 
    }
    finally{
      setIsLoading(false)
    }
  }

  const changeUserStatus = async (id , newStatus , networkId , role)=>{
    try {
      setIsLoading(true)

      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userDoc.data();
      const docRef = doc(db , 'networks' , networkId)
      const snapshot = await getDoc(docRef)
      const data = snapshot.data();

      if (userData?.role == 'director'){
        let updateUsers
        if (role === 'passenger'){
          updateUsers = data.passengers.map(p => p.id === id ? {...p , status : newStatus} : p)
          console.log(updateUsers)
        }
        else if (role === 'driver'){
          updateUsers = data.drivers.map(p => p.id === id ? {...p , status : newStatus} : p)
        }
        
        await updateDoc(docRef , {[`${role}s`] : updateUsers})
        toast.success('User status changed successfully')
      }
      else {
        throw new Error('You do not have permission to change status')
      }
    }
    catch (error){
      console.log(error)
      toast.error(error.message)
    }
    finally{
      setIsLoading(false)
    }
  }

  const getRide = async (id , networkId)=>{
    try {
        setIsLoading(true)
        const userId = auth.currentUser.uid;
        const network = doc(db , 'networks' , networkId)
        const networkSnapshot = await getDoc(network)
        const networkData = networkSnapshot.data()

        const ride = doc(db , 'rides' , id)
        const rideSnapshot = await getDoc(ride)
        const rideData = rideSnapshot.data()
        if (networkSnapshot.exists() && rideSnapshot.exists()) {
          const isAuthorized =
            networkData.directorId === userId ||
            networkData.passengersIds?.includes(userId) ||
            networkData.driversIds?.includes(userId);
            console.log(isAuthorized)
          return isAuthorized ? rideData : null;
        }
        return null
    }
    catch (error){
        toast.error(error.message)
    }
    finally{
      setIsLoading(false)
    }
  }

  const bookRide = async ({driver , rideId ,
    departure , departure_date , departure_time ,
    arrival , arrival_date , arrival_time , available_seats} , booked_seats , networkId)=>{
    try {
      setIsLoading(true)
      const inviteCode = generateInviteCode()

      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = {id : auth.currentUser.uid , ...userDoc.data()};

      const networkRef = doc(db, "networks", networkId);
      const networkSnapshot = await getDoc(networkRef);

      const networkData = networkSnapshot.data();
      const networkmember = networkData.passengers.find(p => p.id === auth.currentUser.uid) ||
                            networkData.drivers.find(p => p.id === auth.currentUser.uid);


      const rideRef = doc(db, "rides", rideId);
      const rideSnapshot = await getDoc(rideRef);

      const rideData = rideSnapshot.data();
      const ridepassenger = rideData.passengers.find(p => p.id === auth.currentUser.uid);

      if (!networkmember){
        throw new Error('You must join this network before booking a ride')
      }

      const booked = ridepassenger !== undefined ? true : false

      const bookId = `book-${inviteCode}`

      {
          if (!booked) {
            console.log(userData)
            await setDoc(doc(db , 'bookings' , bookId) , 
            {
                passenger : {
                  id : userData.id , phone : userData.phone ,
                  email : userData.email  , fullname : userData.fullname 
                } , 
                passengerId : userData.id , 
                driver : {
                  id : driver.id , phone : driver.phone ,
                  email : driver.email , fullname : driver.fullname
                },
                ride_id : rideId,
                departure ,
                departure_date , 
                departure_time ,
                arrival ,
                arrival_date ,
                arrival_time ,
                booking_status : "booked" ,
                booked_seats ,
                networkId ,
                booked_at : new Date()
            })
            
            await updateDoc(doc(db , 'rides' , rideId) , {available_seats : available_seats - booked_seats , 
              passengers : arrayUnion({
                id : auth.currentUser.uid ,
                email : userData.email , 
                phone : userData.phone , 
                booked_seats : booked_seats , 
                booked_at : new Date() ,
                booking_id : bookId,
                status : 'booked'
              })})
            toast.success('Ride Booked successfully')
          }
          else {
            throw new Error('ride already booked')
          }
        }


    }
    catch (error){
      toast.error(error.message)
    }
    finally{
      setIsLoading(false)
    }
  }

  const getBookings = async () => {
  setIsLoading(true);
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("You must be logged in");

    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.data();
    if (!userData) throw new Error("User data not found");


    const bookingsRef = collection(db, 'bookings');
    const q = query(bookingsRef, where('passengerId', '==', user.uid));
    const snapshot = await getDocs(q);

    const bookings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()

      
    }));


    return bookings;
  } catch (error) {
    toast.error(error.message);
    return [];
  } finally {
    setIsLoading(false);
  }
};

const getBooking = async (id)=>{
  try {
        setIsLoading(true)
        const userId = auth.currentUser.uid;
        const currBooking = doc(db , 'bookings' , id)
        const snapshot = await getDoc(currBooking)
        const data = snapshot.data()
        if (snapshot.exists()) {
          const isAuthorized = data.passenger.id === userId || data.driver.id === userId
          
          const rideData = await getRide(data.ride_id , data.networkId)
          const rideStatus = rideData.ride_status
          return isAuthorized ? {...data , id , status : rideStatus} : null;
        }
        return null
    }
    catch (error){
        toast.error(error.message)
    }
}


const getRides = async () => {
  setIsLoading(true);
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("You must be logged in");

    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.data();
    if (!userData) throw new Error("User data not found");


    const rideRef = collection(db, 'rides');
    const q = query(rideRef, where('driverId', '==', user.uid));
    const snapshot = await getDocs(q);

    const bookings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()

      
    }));


    return bookings;
  } catch (error) {
    toast.error(error.message);
    return [];
  } finally {
    setIsLoading(false);
  }
};

const getNetworkList = async ()=>{
            const user = auth.currentUser
            try {
                setIsLoading(true)
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                const userData = userDoc.data();
                const networksRef = collection(db , 'networks')
                let results = [];

                if (userData?.role === 'director'){
                  const q = query(networksRef, where("directorId", "==", user.uid));
                  const snapshot = await getDocs(q);
                  results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                } else {
                  // members can appear in either driversIds or passengersIds
                  const [driversSnap, passengersSnap] = await Promise.all([
                    getDocs(query(networksRef, where("driversIds", "array-contains", user.uid))),
                    getDocs(query(networksRef, where("passengersIds", "array-contains", user.uid))),
                  ]);
                  const seen = new Set();
                  for (const d of [...driversSnap.docs, ...passengersSnap.docs]) {
                    if (!seen.has(d.id)) {
                      seen.add(d.id);
                      results.push({ id: d.id, ...d.data() });
                    }
                  }
                }

                return results.length === 0 ? [] : results
            }
            catch (err){
                toast.error(err.message)
            }
            finally{
                setIsLoading(false)
            }
}
  

const deleteNetwork = async (id) => {
  try {
    await deleteDoc(doc(db, "networks", id));
    toast.success("Network deleted successfully");
  } catch (err) {
    toast.error(err.message);
  }
};

const updateRide = async (rideId, updates) => {
  try {
    setIsLoading(true)
    const rideRef = doc(db, 'rides', rideId)
    const rideSnap = await getDoc(rideRef)
    if (!rideSnap.exists()) throw new Error('Ride not found')

    const existing = rideSnap.data()

    // Recalculate available_seats if total_seats changed
    const bookedSeats = (existing.total_seats || 0) - (existing.available_seats || 0)
    const newAvailable = (updates.total_seats || existing.total_seats) - bookedSeats

    await updateDoc(rideRef, {
      ...updates,
      available_seats: newAvailable,
    })

    // Notify booked passengers if any
    const approvedPassengers = (existing.passengers || []).filter(p => p.status === 'approved' || p.status === 'pending')
    if (approvedPassengers.length > 0) {
      await fetch('/api/notify-ride-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passengers: approvedPassengers,
          ride: { ...existing, ...updates },
        }),
      })
    }

    toast.success('Ride updated successfully')
  } catch (error) {
    toast.error(error.message)
  } finally {
    setIsLoading(false)
  }
}

const cancelRide = async (rideId)=>{
  try {
    setIsLoading(true)

    const rideRef = doc(db , 'rides' , rideId)
    const rideSnap = await getDoc(rideRef)

    if(!rideSnap.exists()) return

    const rideData = rideSnap.data()
    const ridePassengers = rideData.passengers

    ridePassengers.forEach(async (p)=>{
      const bookingRef = doc(db , 'bookings' , p.booking_id)
      const bookingSnap = await getDoc(bookingRef)
      if (!bookingSnap.exists()) return 

      await updateDoc(bookingRef , {booking_status : 'canceled'})
    })

    await updateDoc(rideRef , {ride_status : 'canceled'})
    toast.success('Ride canceled successfully')
    
    
  }
  catch (error){
    toast.error(error.message)
  }
  finally{
    setIsLoading(false)
  }
}

const startRide = async (rideId)=>{
  try {
    setIsLoading(true)
    const rideRef = doc(db , 'rides' , rideId)
    const rideSnap = await getDoc(rideRef)

    if(!rideSnap.exists()) return

    const rideData = rideSnap.data()
    const ridePassengers = rideData.passengers

    ridePassengers.forEach(async (p)=>{
      const bookingRef = doc(db , 'bookings' , p.booking_id)
      const bookingSnap = await getDoc(bookingRef)
      if (!bookingSnap.exists()) return 

      await updateDoc(bookingRef , {booking_status : 'on progress'})
    })
    await updateDoc(rideRef , { ride_status : 'on progress' , started_at : new Date()})
    toast.success('Ride started')
  }
  catch (error){
    toast.error(error.message)
  }
  finally{
    setIsLoading(false)
  }
}

const finalizeRide = async (rideId) =>{
  try {
    setIsLoading(true)
    const rideRef = doc(db , 'rides' , rideId)
    const rideSnap = await getDoc(rideRef)

    if(!rideSnap.exists()) return

    const rideData = rideSnap.data()
    const ridePassengers = rideData.passengers

    ridePassengers.forEach(async (p)=>{
      const bookingRef = doc(db , 'bookings' , p.booking_id)
      const bookingSnap = await getDoc(bookingRef)
      if (!bookingSnap.exists()) return 

      await updateDoc(bookingRef , {booking_status : 'finished'})
    })
    await updateDoc(rideRef , { ride_status : 'finished' , finished_at : new Date()})
    toast.success('Ride finished , congratulations')
  }
  catch (error){
    toast.error(error.message)
  }
  finally{
    setIsLoading(false)
  }
}


const changeBookingStatus = async (passengerId  , rideId , bookingId , status)=>{
  
  try {
    console.log(bookingId)
    setIsLoading(true)
    const rideRef = doc(db , 'rides' , rideId)
    const rideSnap = await getDoc(rideRef)

    const bookingRef = doc(db , 'bookings' , bookingId)
    const bookingSnap = await getDoc(bookingRef)

    
    
    if (!rideSnap.exists() || !bookingSnap.exists()) return 
    const rideData = rideSnap.data() 
    const bookingData = bookingSnap.data()



    const updatedPassengers = rideData.passengers.map(p => {
      return p.id === passengerId ? {...p , status : status} : p}
    )
    await updateDoc(rideRef , { passengers : updatedPassengers})
    await updateDoc(bookingRef , { booking_status : status})
    if (status === 'declined' && rideData.available_seats > 0){
      const user = rideData.passengers.find(p => p.id === passengerId)
      await updateDoc(rideRef , {available_seats : rideData.available_seats + user.booked_seats})
    }
    toast.success(`Passenger ${status} successfully`)
  }
  catch(error){
    toast.error(error.message)
  }
  finally{
    setIsLoading(false)
  }
}

    
  

  const NETWORK_IDS = ['network-HILLPATROL', 'network-MOUNTAINHOSTS', 'network-NORDIC']

  const getAllNetworks = async () => {
    try {
      const snaps = await Promise.all(
        NETWORK_IDS.map(id => getDoc(doc(db, 'networks', id)))
      )
      return snaps
        .filter(s => s.exists())
        .map(s => ({ id: s.id, ...s.data() }))
    } catch (error) {
      console.error('[getAllNetworks]', error)
      return []
    }
  }

    return <NetworkContext.Provider value={{createNetwork , joinNetwork , getRidesByNetworkId , deleteNetwork , changeBookingStatus , getNetwork , offerRide ,findRide , changeUserStatus , getRide , bookRide , getBookings , getBooking, getRides , cancelRide , finalizeRide , startRide , isLoading , getNetworkList , getAllNetworks , updateRide}}>
        {children}
    </NetworkContext.Provider>
}

export const useNetwork = ()=> useContext(NetworkContext)