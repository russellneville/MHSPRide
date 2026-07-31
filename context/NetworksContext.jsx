'use client'
import { auth, db } from "@/lib/firebaseClient";
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { toast } from "sonner";
import { createContext, useContext, useState } from 'react'
import { logEvent } from '@/lib/activityLog'
import { canBookRide, isCanceledStatus } from '@/lib/rides'
import { networkName } from '@/lib/networks'
import { flattenVehicleForSnapshot } from '@/lib/vehicles'
import { fireBadgeEvent } from '@/lib/badges/client'
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

  // Persist the user's ordered favorite networks (users/{uid}.favorite_networks).
  // Quiet on success — favorites change from small toggles on the dashboard and
  // a toast per click would be noise.
  const saveFavorites = async (networkIds) => {
    try {
      const uid = auth.currentUser.uid
      await updateDoc(doc(db, 'users', uid), { favorite_networks: networkIds })
      const userDoc = await getDoc(doc(db, 'users', uid)).catch(() => null)
      const userData = userDoc?.data() || {}
      logEvent({
        type: 'network.favorites_updated',
        message: `${userData.fullname || uid} updated favorite networks: ${networkIds.map(networkName).join(', ')}`,
        userId: uid,
        userName: userData.fullname,
        mhspNumber: userData.mhspNumber,
        metadata: { favorite_networks: networkIds },
      }).catch(() => {})
      networkIds.forEach(id => fireBadgeEvent('network-favorited', { networkId: id }))
      return true
    } catch (error) {
      toast.error(error.message)
      return false
    }
  }

  // Toggle a driver in/out of the current user's favorites (users/{uid}.favorite_drivers).
  // Snapshots name/photo/vehicle/mhspNumber at favorite time — riders can't read another
  // user's live doc directly (see firestore.rules), so this mirrors how driver info is
  // already snapshotted onto rides/bookings rather than doing a live lookup.
  const toggleFavoriteDriver = async (driver) => {
    try {
      const uid = auth.currentUser.uid
      const userDoc = await getDoc(doc(db, 'users', uid))
      const userData = userDoc.data() || {}
      const existing = userData.favorite_drivers || []
      const isFavorited = existing.some(d => d.id === driver.id)
      const updated = isFavorited
        ? existing.filter(d => d.id !== driver.id)
        : [...existing, {
            id: driver.id,
            fullname: driver.fullname || '',
            photoURL: driver.photoURL || '',
            mhspNumber: driver.mhspNumber || '',
            vehicle_make: driver.vehicle_make || '',
            vehicle_model: driver.vehicle_model || '',
          }]
      await updateDoc(doc(db, 'users', uid), { favorite_drivers: updated })
      logEvent({
        type: isFavorited ? 'driver.unfavorited' : 'driver.favorited',
        message: `${userData.fullname || uid} ${isFavorited ? 'unfavorited' : 'favorited'} driver ${driver.fullname || driver.id}`,
        userId: uid,
        userName: userData.fullname,
        mhspNumber: userData.mhspNumber,
        metadata: { driverId: driver.id },
      }).catch(() => {})
      if (!isFavorited) fireBadgeEvent('driver-favorited', { driverId: driver.id })
      return !isFavorited
    } catch (error) {
      toast.error(error.message)
      return null
    }
  }

  const offerRide = async ({ vehicle, ...rideData } , networkId)=>{
    try {
      setIsLoading(true)
      const inviteCode = generateInviteCode()

      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userDoc.data();

      {
        await setDoc(doc(db , 'rides' , `ride-${inviteCode}`) ,
          {
              ...rideData ,
              started_at : '',
              finished_at : '' ,
              available_seats : rideData.total_seats,
              driver : {...userData , ...flattenVehicleForSnapshot(vehicle) , id : auth.currentUser.uid},
              driverId : auth.currentUser.uid,
              network_id : networkId,
              passengers : [],
              ride_status : 'not started',
              created_at: new Date()
          })
        toast.success('Ride created successfully')
        logEvent({
          type: 'ride.created',
          message: `Ride created: ${rideData.departure} → ${rideData.arrival} on ${rideData.departure_date}`,
          userId: auth.currentUser.uid,
          userName: userData.fullname,
          mhspNumber: userData.mhspNumber,
          metadata: { networkId, departure: rideData.departure, arrival: rideData.arrival, departure_date: rideData.departure_date },
        }).catch(() => {})
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


  const getRide = async (id)=>{
    try {
        setIsLoading(true)
        const ride = doc(db , 'rides' , id)
        const rideSnapshot = await getDoc(ride)
        return rideSnapshot.exists() ? rideSnapshot.data() : null
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
    arrival , arrival_date , arrival_time , return_departure_time, one_way, available_seats} , booked_seats , networkId)=>{
    try {
      setIsLoading(true)
      const inviteCode = generateInviteCode()

      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = {id : auth.currentUser.uid , ...userDoc.data()};

      const rideRef = doc(db, "rides", rideId);
      const rideSnapshot = await getDoc(rideRef);

      const rideData = rideSnapshot.data();
      const ridepassenger = rideData.passengers.find(p => p.id === auth.currentUser.uid);

      if (!canBookRide(rideData)) {
        throw new Error('Bookings close 6 hours before a ride departs')
      }

      const booked = ridepassenger !== undefined && !isCanceledStatus(ridepassenger.status)

      const bookId = `book-${inviteCode}`

      {
          if (!booked) {
            console.log(userData)
            await setDoc(doc(db , 'bookings' , bookId) ,
            {
                passenger : {
                  id : userData.id , phone : userData.phone ,
                  email : userData.email  , fullname : userData.fullname ,
                  photoURL : userData.photoURL || ''
                } ,
                passengerId : userData.id ,
                driver : {
                  id : driver.id , phone : driver.phone ,
                  email : driver.email , fullname : driver.fullname,
                  vehicle_make : driver.vehicle_make || '',
                  vehicle_model : driver.vehicle_model || '',
                  vehicle_year : driver.vehicle_year || '',
                  vehicle_color : driver.vehicle_color || '',
                  vehicle_plate : driver.vehicle_plate || '',
                  vehicle_seats : driver.vehicle_seats || '',
                },
                driverId : driver.id ,
                ride_id : rideId,
                departure ,
                // Carried over from the ride being booked, not recomputed here —
                // a booking has no location-picker of its own, so these can only
                // ever reflect what the driver chose (resources/badging.md).
                custom_departure : rideData.custom_departure || false,
                custom_arrival : rideData.custom_arrival || false,
                departure_date ,
                departure_time ,
                arrival ,
                arrival_date ,
                arrival_time ,
                return_departure_time : one_way ? '' : (return_departure_time || ''),
                booking_status : "booked" ,
                booked_seats ,
                networkId ,
                booked_at : new Date()
            })
            
            const newPassengerEntry = {
              id : auth.currentUser.uid ,
              email : userData.email ,
              phone : userData.phone ,
              fullname : userData.fullname ,
              photoURL : userData.photoURL || '' ,
              booked_seats : booked_seats ,
              booked_at : new Date() ,
              booking_id : bookId,
              status : 'booked'
            }
            // Replace a prior (e.g. canceled) entry for this passenger in place, rather than
            // appending a duplicate — otherwise lookups that find() the first match would keep
            // resolving to the stale entry after a rebook.
            const updatedPassengers = ridepassenger
              ? rideData.passengers.map(p => p.id === auth.currentUser.uid ? newPassengerEntry : p)
              : [...rideData.passengers, newPassengerEntry]

            await updateDoc(doc(db , 'rides' , rideId) , {
              available_seats : available_seats - booked_seats ,
              passengers : updatedPassengers
            })
            toast.success('Ride Booked successfully')

            logEvent({
              type: 'booking.created',
              message: `Booking created: ${departure} → ${arrival} on ${departure_date}`,
              userId: auth.currentUser.uid,
              userName: userData.fullname,
              mhspNumber: userData.mhspNumber,
              metadata: { bookingId: bookId, rideId, departure, arrival, departure_date, booked_seats },
            }).catch(() => {})

            // Send booking emails (fire-and-forget)
            auth.currentUser?.getIdToken().then(token => {
              fetch('/api/notify-booking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ bookingId: bookId }),
              }).catch(err => console.error('[notify-booking]', err))
            }).catch(() => {})
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

          const rideData = await getRide(data.ride_id)
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

    // Use booking_ids already stored on each passenger entry — avoids a collection query
    // that would be blocked by Firestore rules for cross-user reads
    const activePassengers = (existing.passengers || []).filter(p =>
      p.status !== 'canceled' && p.status !== 'cancled' && p.booking_id
    )

    const bookingFields = {
      departure:             updates.departure             ?? existing.departure,
      arrival:               updates.arrival               ?? existing.arrival,
      departure_date:        updates.departure_date        ?? existing.departure_date,
      arrival_date:          updates.arrival_date          ?? existing.arrival_date,
      departure_time:        updates.departure_time        ?? existing.departure_time,
      arrival_time:          updates.arrival_time          ?? existing.arrival_time,
      return_departure_time: updates.return_departure_time ?? existing.return_departure_time,
      ride_updated:          true,
      update_seen:           false,
      updated_ride_snapshot: { ...existing, ...updates },
    }

    await Promise.all(
      activePassengers.map(p => updateDoc(doc(db, 'bookings', p.booking_id), bookingFields))
    )

    // Email booked passengers
    const emailList = activePassengers
      .map(p => ({ email: p.email, fullname: p.fullname }))
      .filter(p => p.email)

    if (emailList.length > 0) {
      const token = await auth.currentUser?.getIdToken().catch(() => null)
      await fetch('/api/notify-ride-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({ rideId }),
      })
    }

    toast.success('Ride updated successfully')
    const updaterDoc = await getDoc(doc(db, 'users', auth.currentUser.uid)).catch(() => null)
    const updaterData = updaterDoc?.data() || {}
    logEvent({
      type: 'ride.updated',
      message: `Ride updated: ${rideId}`,
      userId: auth.currentUser.uid,
      userName: updaterData.fullname,
      mhspNumber: updaterData.mhspNumber,
      metadata: { rideId, updates },
    }).catch(() => {})
  } catch (error) {
    toast.error(error.message)
  } finally {
    setIsLoading(false)
  }
}

const dismissRideUpdate = async (bookingId) => {
  try {
    await updateDoc(doc(db, 'bookings', bookingId), { ride_updated: false, update_seen: true })
  } catch (error) {
    console.error('[dismissRideUpdate]', error)
  }
}

const cancelRide = async (rideId, reason = '')=>{
  try {
    setIsLoading(true)

    const rideRef = doc(db , 'rides' , rideId)
    const rideSnap = await getDoc(rideRef)

    if(!rideSnap.exists()) return

    const rideData = rideSnap.data()
    const ridePassengers = rideData.passengers

    await Promise.all(ridePassengers.map(async (p) => {
      const bookingRef = doc(db, 'bookings', p.booking_id)
      const bookingSnap = await getDoc(bookingRef)
      if (!bookingSnap.exists()) return
      await updateDoc(bookingRef, { booking_status: 'canceled', cancellation_reason: reason })
    }))

    await updateDoc(rideRef , {ride_status : 'canceled', cancellation_reason: reason})
    toast.success('Ride canceled successfully')

    const cancelerDoc = await getDoc(doc(db, 'users', auth.currentUser.uid)).catch(() => null)
    const cancelerData = cancelerDoc?.data() || {}
    logEvent({
      type: 'ride.canceled',
      message: `Ride canceled: ${rideData.departure} → ${rideData.arrival} on ${rideData.departure_date}${reason ? ` — Reason: ${reason}` : ''}`,
      userId: auth.currentUser.uid,
      userName: cancelerData.fullname,
      mhspNumber: cancelerData.mhspNumber,
      metadata: { rideId, departure: rideData.departure, arrival: rideData.arrival, departure_date: rideData.departure_date, reason },
    }).catch(() => {})

    // Notify passengers by email (fire-and-forget)
    const passengersWithEmail = ridePassengers.filter(p => p.email)
    if (passengersWithEmail.length > 0) {
      auth.currentUser?.getIdToken().then(token => {
        fetch('/api/notify-cancellation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ rideId }),
        }).catch(err => console.error('[notify-cancellation]', err))
      }).catch(() => {})
    }
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

    await Promise.all(ridePassengers.map(async (p) => {
      const bookingRef = doc(db, 'bookings', p.booking_id)
      const bookingSnap = await getDoc(bookingRef)
      if (!bookingSnap.exists()) return
      await updateDoc(bookingRef, { booking_status: 'on progress' })
    }))
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

    await Promise.all(ridePassengers.map(async (p) => {
      const bookingRef = doc(db, 'bookings', p.booking_id)
      const bookingSnap = await getDoc(bookingRef)
      if (!bookingSnap.exists()) return
      await updateDoc(bookingRef, { booking_status: 'finished' })
    }))
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

    if (status === 'canceled' || status === 'declined') {
      const actorDoc = await getDoc(doc(db, 'users', auth.currentUser.uid)).catch(() => null)
      const actorData = actorDoc?.data() || {}
      logEvent({
        type: 'booking.canceled',
        message: `Booking ${status}: booking ${bookingId} for ride ${rideId}`,
        userId: auth.currentUser.uid,
        userName: actorData.fullname,
        mhspNumber: actorData.mhspNumber,
        metadata: { bookingId, rideId, passengerId, status },
      }).catch(() => {})
    }
  }
  catch(error){
    toast.error(error.message)
  }
  finally{
    setIsLoading(false)
  }
}



const cancelBooking = async (bookingId, reason = '') => {
  try {
    setIsLoading(true)
    const bookingRef = doc(db, 'bookings', bookingId)
    const bookingSnap = await getDoc(bookingRef)
    if (!bookingSnap.exists()) throw new Error('Booking not found')

    const bookingData = bookingSnap.data()

    if (bookingData.passengerId !== auth.currentUser.uid) {
      throw new Error('You can only cancel your own booking')
    }
    if (isCanceledStatus(bookingData.booking_status)) {
      throw new Error('This booking is already canceled')
    }

    await updateDoc(bookingRef, { booking_status: 'canceled', cancellation_reason: reason })

    if (bookingData.ride_id) {
      const rideRef = doc(db, 'rides', bookingData.ride_id)
      const rideSnap = await getDoc(rideRef)
      if (rideSnap.exists()) {
        const rideData = rideSnap.data()
        const updatedPassengers = (rideData.passengers || []).map(p =>
          p.booking_id === bookingId ? { ...p, status: 'canceled' } : p
        )
        await updateDoc(rideRef, {
          available_seats: (rideData.available_seats || 0) + (bookingData.booked_seats || 1),
          passengers: updatedPassengers,
        })
      }
    }

    toast.success('Booking canceled')

    const actorDoc = await getDoc(doc(db, 'users', auth.currentUser.uid)).catch(() => null)
    const actorData = actorDoc?.data() || {}
    logEvent({
      type: 'booking.canceled',
      message: `Booking canceled by passenger: ${bookingData.departure} → ${bookingData.arrival} on ${bookingData.departure_date}${reason ? ` — Reason: ${reason}` : ''}`,
      userId: auth.currentUser.uid,
      userName: actorData.fullname,
      mhspNumber: actorData.mhspNumber,
      metadata: { bookingId, rideId: bookingData.ride_id, selfCanceled: true, reason },
    }).catch(() => {})

    // Notify driver + passenger by email (fire-and-forget)
    auth.currentUser?.getIdToken().then(token => {
      fetch('/api/notify-booking-cancellation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingId }),
      }).catch(err => console.error('[notify-booking-cancellation]', err))
    }).catch(() => {})

    return true
  }
  catch (error) {
    toast.error(error.message)
    return false
  }
  finally {
    setIsLoading(false)
  }
}

    return <NetworkContext.Provider value={{getRidesByNetworkId , changeBookingStatus , offerRide , getRide , bookRide , getBookings , getBooking, getRides , cancelRide , cancelBooking , finalizeRide , startRide , isLoading , saveFavorites , toggleFavoriteDriver , updateRide , dismissRideUpdate}}>
        {children}
    </NetworkContext.Provider>
}

export const useNetwork = ()=> useContext(NetworkContext)