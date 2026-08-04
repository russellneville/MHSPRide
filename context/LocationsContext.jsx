'use client'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { db } from '@/lib/firebaseClient'
import { collection, getDocs } from 'firebase/firestore'
import { useAuth } from './AuthContext'

const LocationsContext = createContext()

// Fallback for an id with no matching Firestore doc yet (e.g. cache still
// loading on first render) — same prettification the old static resolveLocation() used.
function prettify(id) {
  return id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export const LocationsProvider = ({ children }) => {
  const { user, isLoading: authLoading } = useAuth()
  const [byId, setById] = useState(new Map())
  const [origins, setOrigins] = useState([])
  const [destinations, setDestinations] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const snap = await getDocs(collection(db, 'locations'))
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setById(new Map(all.map(l => [l.id, l])))
      // 'both' locations (e.g. a site that's both a common pickup spot and a
      // training destination) appear in both lists.
      setOrigins(all.filter(l => l.role === 'origin' || l.role === 'both').sort((a, b) => a.name.localeCompare(b.name)))
      setDestinations(all.filter(l => l.role === 'destination' || l.role === 'both').sort((a, b) => a.name.localeCompare(b.name)))
    } catch (err) {
      console.error('[LocationsContext]', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Firebase Auth restores the session asynchronously — fetching before it settles
  // sends the Firestore request with no auth token, which the rules correctly deny.
  // Wait for auth to resolve, and skip the fetch entirely while logged out (the
  // rules require auth anyway, so there's nothing to show).
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setById(new Map())
      setOrigins([])
      setDestinations([])
      setIsLoading(false)
      return
    }
    refresh()
  }, [authLoading, user, refresh])

  const getLocationName = (id) => byId.get(id)?.name

  const resolveLocation = (id) => {
    if (!id) return id
    return byId.get(id)?.name || prettify(id)
  }

  // Predefined locations are already geocoded + admin-reviewed (see
  // app/api/admin/locations/add/route.js), unlike free-text ride locations —
  // this is the single place that turns a known location id into the same
  // {latitude, longitude, formattedAddress} shape address validation returns
  // for free text, so ride forms and map rendering share one lookup instead
  // of each re-deriving lat/lon from a location doc independently.
  const getLocationCoords = (id) => {
    const loc = byId.get(id)
    if (!loc || loc.lat == null || loc.lon == null) return null
    return { latitude: loc.lat, longitude: loc.lon, formattedAddress: loc.name }
  }

  return (
    <LocationsContext.Provider value={{ origins, destinations, byId, isLoading, refresh, resolveLocation, getLocationName, getLocationCoords }}>
      {children}
    </LocationsContext.Provider>
  )
}

export const useLocations = () => useContext(LocationsContext)
