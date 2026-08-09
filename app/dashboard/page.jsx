'use client'
import { useNetwork } from "@/context/NetworksContext"
import { useSkin } from "@/context/SkinContext"
import DashboardLayout from "./dashboardLayout"
import { useAuth } from "@/context/AuthContext"
import { usePopup } from "@/context/PopupContext"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { formatDate, formatTime, toLocalDateStr } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { AlertTriangle, ArrowDown, ArrowUp, Car, ChevronDown, ChevronLeft, ChevronRight, Clock, Info, MapPin, MoveRight, Navigation, Plus, Search, Star, X } from "lucide-react"
import Link from "next/link"
import UserAvatar from "@/components/ui/user-avatar"
import DatePicker from "@/components/ui/date-picker"
import { Skeleton } from "@/components/ui/skeleton"
import OfferRidePopup, { OfferRideTitle } from "@/components/popup-forms/OfferRidePopup"
import RequestRidePopup from "@/components/popup-forms/RequestRidePopup"
import RideRequestDetailsPopup from "@/components/popup-forms/RideRequestDetailsPopup"
import AddFavoritePopup from "@/components/popup-forms/AddFavoritePopup"
import SearchRidesPopup from "@/components/popup-forms/SearchRidesPopup"
import CancelReasonDialog from "@/components/CancelReasonDialog"
import RideRowCard from "@/components/cards/ride-row-card"
import NetworkRideCard from "@/components/cards/network-ride-card"
import { useLocations } from "@/context/LocationsContext"
import { computeRideStatus } from "@/lib/rides"
import { equipmentLabel } from "@/lib/rideRequests"
import { NETWORKS, NETWORK_IDS, TROOPITER_NETWORK_ID, networkName, defaultFavoritesFor } from "@/lib/networks"
import { normalizeEmail } from "@/lib/rosterDiff"
import { useTheme } from "next-themes"
import AchievementBadge from "@/components/AchievementBadge"
import { badgeById } from "@/lib/badges/catalog"
import { acknowledgeBadge, evaluateBadges, fetchUnseenBadges } from "@/lib/badges/client"

const PAGE_SIZE = 10

function normalizeStatus(s) {
  return s === 'cancled' ? 'canceled' : (s || '—')
}

function rideNetworkId(r) {
  return r.network_id || r.networkId
}

// Troopiter tenants have no network concept — the shift/event name Troopiter
// dispatched the ride under (issue #199) stands in for it wherever a network
// name would otherwise show. Only ever set on troopiter-originated rides, so
// this is a no-op for MHSP's own networks.
function rideGroupLabel(r) {
  return r.shift_name || networkName(rideNetworkId(r))
}

// Buckets already-sorted (by date/time) available rides by shift/event name,
// groups ordered by their earliest ride's date — mirrors how a real Troopiter
// month view lists dispatches chronologically (resources/troopiter screenshot,
// December 2025).
function groupByShift(rides) {
  const groups = new Map()
  for (const r of rides) {
    const key = r.shift_name || 'Unscheduled'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(r)
  }
  return [...groups.entries()]
    .map(([name, rides]) => ({ name, rides }))
    .sort((a, b) => (a.rides[0]?.departure_date || '9999').localeCompare(b.rides[0]?.departure_date || '9999'))
}

function rideHref(r) {
  const networkId = rideNetworkId(r)
  const rideId = r._type === 'offered' ? r.id : r.ride_id
  return networkId && rideId ? `/dashboard/network/${networkId}/rides/${rideId}` : null
}

function typeBadge(r) {
  return r._type === 'offered'
    ? <Badge className="bg-green-100 text-green-800 border-green-300">Offered</Badge>
    : <Badge className="bg-blue-100 text-blue-800 border-blue-300">Booked</Badge>
}

function seatsText(r) {
  return r._type === 'offered'
    ? `${(r.total_seats || 0) - (r.available_seats || 0)} of ${r.total_seats || 0} booked`
    : `${r.booked_seats || 1} seat${(r.booked_seats || 1) !== 1 ? 's' : ''}`
}

// Clamps a raw page index to a valid range and slices `items` into that page.
// Returns the clamped page alongside the slice so callers can drive a Pager
// without a page ever pointing past the end of a list that's since shrunk.
function paginate(items, rawPage) {
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const page = Math.min(rawPage, pageCount - 1)
  return { page, pageCount, paged: items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) }
}

function Pager({ page, pageCount, onPrev, onNext }) {
  if (pageCount <= 1) return null
  return (
    <div className="flex items-center gap-3 text-sm">
      <Button variant="outline" size="sm" disabled={page === 0} onClick={onPrev}>
        <ChevronLeft className="size-3.5 mr-1" /> Previous
      </Button>
      <span className="text-muted-foreground">Page {page + 1} of {pageCount}</span>
      <Button variant="outline" size="sm" disabled={page >= pageCount - 1} onClick={onNext}>
        Next <ChevronRight className="size-3.5 ml-1" />
      </Button>
    </div>
  )
}

export default function Dashboard() {
  const { getRides, getBookings, getRidesByNetworkId, getShiftsForOrg, getRidesByShiftId, saveFavorites, dismissRideUpdate, getRideRequests, cancelRideRequest } = useNetwork()
  const { resolveLocation } = useLocations()
  const router = useRouter()
  const { user } = useAuth()
  const { skin, org } = useSkin()
  const isTroopiter = skin === 'troopiter'
  const orgName = org?.displayName || 'Mount Hood Ski Patrol'
  const { openPopup, isOpen } = usePopup()
  const [rideRequests, setRideRequests] = useState([])
  const [cancelingRequestId, setCancelingRequestId] = useState(null)
  // Deliberately `theme`, not `resolvedTheme` — "Gone to the Dark Side" should
  // reward an explicit choice to switch to dark mode, not a member whose OS
  // happens to prefer dark while their MHSPRide setting is still "System".
  const { theme } = useTheme()
  const [earnedBadges, setEarnedBadges] = useState([])
  const [badgeDialogOpen, setBadgeDialogOpen] = useState(false)
  const [rides, setRides] = useState([])
  const [bookings, setBookings] = useState([])
  const [networkRides, setNetworkRides] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [pastPage, setPastPage] = useState(0)
  const [pastOpen, setPastOpen] = useState(false)
  const [collapsed, setCollapsed] = useState({})
  const [scheduledPage, setScheduledPage] = useState(0)
  const [availablePages, setAvailablePages] = useState({})
  const fetchDataRef = useRef(null)
  const fetchShiftsRef = useRef(null)
  const migratedRef = useRef(false)

  // Troopiter-only: real shift records (issue #199) + the rides posted under
  // each, plus rides created via the top-level Offer button that have no
  // shift record behind them at all (shift_id null — still worth surfacing,
  // just not attributable to a specific shift). Parallel to
  // favorites/networkRides below rather than reusing that machinery, since a
  // shift isn't a network id and needs its own fetch shape.
  const [shifts, setShifts] = useState([])
  const [shiftRides, setShiftRides] = useState({})
  const [manualRides, setManualRides] = useState([])
  const [shiftsLoaded, setShiftsLoaded] = useState(false)
  const [otherShiftsOpen, setOtherShiftsOpen] = useState(false)

  // Available Rides filters — shared across every favorited network's list (issue #84)
  const [filterDate, setFilterDate] = useState('')
  const [filterOrigin, setFilterOrigin] = useState('')
  const [filterDestination, setFilterDestination] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [favoriteDriversOnly, setFavoriteDriversOnly] = useState(false)
  const hasAvailableFilters = filterDate || filterOrigin || filterDestination || searchTerm || favoriteDriversOnly

  // Requested Rides filters — same shape as Available Rides' above, but its
  // own independent state since it's a separate, flat (no per-network) list.
  const [requestFilterDate, setRequestFilterDate] = useState('')
  const [requestFilterOrigin, setRequestFilterOrigin] = useState('')
  const [requestFilterDestination, setRequestFilterDestination] = useState('')
  const [requestSearchTerm, setRequestSearchTerm] = useState('')
  const [favoriteRidersOnly, setFavoriteRidersOnly] = useState(false)
  const hasRequestFilters = requestFilterDate || requestFilterOrigin || requestFilterDestination || requestSearchTerm || favoriteRidersOnly

  // Ordered favorites from the live user doc, restricted to known networks —
  // meaningless for troopiter tenants (no network-favoriting concept there;
  // see the shifts state above instead).
  const favorites = (Array.isArray(user?.favorite_networks) ? user.favorite_networks : [])
    .filter(id => NETWORK_IDS.includes(id))

  // Lazy migration: users from before favorites existed (or who somehow have
  // none) get defaults from their roster classifications, else all networks.
  // Troopiter tenants skip this entirely — there's nothing to favorite.
  useEffect(() => {
    if (isTroopiter || !user || favorites.length > 0 || migratedRef.current) return
    migratedRef.current = true
    const defaults = defaultFavoritesFor(user.classifications)
    saveFavorites(defaults.length > 0 ? defaults : NETWORK_IDS)
  }, [user, favorites.length, isTroopiter])

  // Badge evaluation (resources/badging.md): runs once per dashboard mount for
  // the signed-in user. The server throttles repeat calls to every 10 minutes
  // (app/api/badges/evaluate), so this is safe even though it fires on every
  // navigation back to the dashboard, not just first login. Evaluation always
  // runs, even when the member has hidden badge notifications (Profile →
  // Badges) — hiding only suppresses the reveal, not the tracking, so nothing
  // is lost when they turn it back on. After evaluating, check for ANY unseen
  // badge, not just ones this call awarded — event-based badges (favorited/
  // photo-uploaded, via award-event/route.js) have no other surface that
  // shows the celebration dialog, so this is also what makes those ever
  // appear. hide_badge_notifications falls back to the legacy combined
  // hide_badges flag for members who haven't been migrated yet (issue #177's
  // split) — see the migration effect on the profile page.
  useEffect(() => {
    if (!user?.uid) return
    let cancelled = false
    evaluateBadges({ theme })
      .then(() => {
        if (cancelled || (user.hide_badge_notifications ?? user.hide_badges)) return null
        return fetchUnseenBadges(user.uid)
      })
      .then((unseenIds) => {
        if (cancelled || !unseenIds?.length) return
        const resolved = unseenIds.map(badgeById).filter(Boolean)
        if (resolved.length) {
          setEarnedBadges(resolved)
          setBadgeDialogOpen(true)
        }
      })
      .catch((error) => console.error("[dashboard] badge evaluation failed:", error))
    return () => { cancelled = true }
  }, [user?.uid])

  function handleBadgeAcknowledge(badgeId) {
    acknowledgeBadge(badgeId).catch((error) => console.error("[dashboard] badge acknowledge failed:", error))
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const fetchData = async () => {
      const [rideData, bookingData, requestData, ...networkLists] = await Promise.all([
        getRides(),
        getBookings(),
        getRideRequests(),
        ...favorites.map(id => getRidesByNetworkId(id)),
      ])
      if (cancelled) return
      setRides(rideData || [])
      setBookings(bookingData || [])
      setRideRequests(requestData || [])
      setNetworkRides(Object.fromEntries(favorites.map((id, i) => [id, networkLists[i] || []])))
      setLoaded(true)
    }
    fetchDataRef.current = fetchData
    fetchData()
    return () => { cancelled = true }
  }, [user, isOpen, favorites.join(',')])

  // Troopiter-only: shifts posted for this org + their rides, fetched
  // separately since shift ids aren't network ids (issue #199).
  useEffect(() => {
    if (!isTroopiter || !user || !org?.id) return
    let cancelled = false
    const fetchShifts = async () => {
      const [shiftsData, allTroopiterRides] = await Promise.all([
        getShiftsForOrg(org.id),
        getRidesByNetworkId(TROOPITER_NETWORK_ID),
      ])
      if (cancelled) return
      const rideLists = await Promise.all(shiftsData.map(s => getRidesByShiftId(s.id)))
      if (cancelled) return
      setShifts(shiftsData)
      setShiftRides(Object.fromEntries(shiftsData.map((s, i) => [s.id, rideLists[i] || []])))
      setManualRides((allTroopiterRides || []).filter(r => !r.shift_id))
      setShiftsLoaded(true)
    }
    fetchShiftsRef.current = fetchShifts
    fetchShifts()
    return () => { cancelled = true }
  }, [isTroopiter, user, org?.id, isOpen])

  // Refresh when the tab regains focus (e.g. after booking a ride on the detail page)
  useEffect(() => {
    const onFocus = () => { fetchDataRef.current?.(); fetchShiftsRef.current?.() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const today = toLocalDateStr(new Date())

  const allOffered = rides.map(r => ({ ...r, _type: 'offered' }))

  // Deduplicate bookings by ride_id — keep the most recently booked
  const dedupedBookings = Object.values(
    bookings.reduce((acc, b) => {
      const key = b.ride_id || b.id
      if (!acc[key] || (b.booked_at?.seconds || 0) > (acc[key].booked_at?.seconds || 0)) {
        acc[key] = b
      }
      return acc
    }, {})
  )
  const allBooked = dedupedBookings.map(b => ({ ...b, _type: 'booked' }))
  const combined  = [...allOffered, ...allBooked]

  const isCanceled = (r) => {
    const s = r._type === 'offered' ? r.ride_status : r.booking_status
    return s === 'canceled' || s === 'cancled'
  }

  const todayRides = combined.filter(r => {
    if (r.departure_date !== today || isCanceled(r)) return false
    const now = new Date()
    const returnTime = r.return_departure_time
    if (returnTime) {
      const returnDt = new Date(`${r.departure_date}T${returnTime}`)
      if (now > returnDt) return false
    }
    return true
  })

  const upcoming = combined
    .filter(r => r.departure_date > today && !isCanceled(r))
    .sort((a, b) =>
      `${a.departure_date}${a.departure_time}`.localeCompare(`${b.departure_date}${b.departure_time}`)
    )

  const past = combined
    .filter(r => {
      if (r.departure_date < today) return true
      if (r.departure_date === today && r.return_departure_time) {
        const now = new Date()
        const returnDt = new Date(`${r.departure_date}T${r.return_departure_time}`)
        return now > returnDt
      }
      return false
    })
    .sort((a, b) =>
      `${b.departure_date}${b.departure_time}`.localeCompare(`${a.departure_date}${a.departure_time}`)
    )

  const { page: effectivePastPage, pageCount: pastPageCount, paged: pagedPast } = paginate(past, pastPage)

  const { page: effectiveScheduledPage, pageCount: scheduledPageCount, paged: pagedUpcoming } = paginate(upcoming, scheduledPage)

  // Rides someone else offers that this user could book: open/full, upcoming,
  // not their own offer, not already actively booked (those sit in Scheduled).
  const activeBookedRideIds = new Set(
    dedupedBookings.filter(b => !isCanceled({ ...b, _type: 'booked' })).map(b => b.ride_id)
  )
  const rawAvailableByNetwork = Object.fromEntries(favorites.map(id => [
    id,
    (networkRides?.[id] || [])
      .map(r => ({ ...r, _status: computeRideStatus(r) }))
      .filter(r =>
        (r._status === 'open' || r._status === 'full') &&
        r.driverId !== user?.uid &&
        !activeBookedRideIds.has(r.id)
      )
      .sort((a, b) =>
        `${a.departure_date}${a.departure_time}`.localeCompare(`${b.departure_date}${b.departure_time}`)
      ),
  ]))

  // Same shape as rawAvailableByNetwork/availableByNetwork above, keyed by
  // shift id instead of network id (issue #199) — filters (below) are
  // shared across both skins' available-rides lists.
  const rawAvailableByShift = Object.fromEntries(shifts.map(s => [
    s.id,
    (shiftRides[s.id] || [])
      .map(r => ({ ...r, _status: computeRideStatus(r) }))
      .filter(r =>
        (r._status === 'open' || r._status === 'full') &&
        r.driverId !== user?.uid &&
        !activeBookedRideIds.has(r.id)
      )
      .sort((a, b) =>
        `${a.departure_date}${a.departure_time}`.localeCompare(`${b.departure_date}${b.departure_time}`)
      ),
  ]))

  // The user's own offered ride(s) for a given network/shift — previously
  // invisible outside Scheduled Rides because rawAvailableBy* above
  // deliberately excludes `driverId === user.uid` (that list means "rides
  // you could book from someone else"). This is the opposite: an always-on
  // reminder, unaffected by the Available Rides filters below, that surfaces
  // in the same card the ride was posted from (issue #228). Not gated on
  // seats — a full ride you're driving is still yours to see.
  const myOffered = (r) => r.driverId === user?.uid
  const stillRelevant = (r) => r._status !== 'canceled' && r._status !== 'completed'
  const myOfferedByNetwork = Object.fromEntries(favorites.map(id => [
    id,
    (networkRides?.[id] || [])
      .filter(myOffered)
      .map(r => ({ ...r, _status: computeRideStatus(r) }))
      .filter(stillRelevant)
      .sort((a, b) => `${a.departure_date}${a.departure_time}`.localeCompare(`${b.departure_date}${b.departure_time}`)),
  ]))
  const myOfferedByShift = Object.fromEntries(shifts.map(s => [
    s.id,
    (shiftRides[s.id] || [])
      .filter(myOffered)
      .map(r => ({ ...r, _status: computeRideStatus(r) }))
      .filter(stillRelevant)
      .sort((a, b) => `${a.departure_date}${a.departure_time}`.localeCompare(`${b.departure_date}${b.departure_time}`)),
  ]))
  // Ride requests carry no network_id (they're never network-scoped — see
  // getRideRequests above), so only shifts get a "my requests" bucket.
  const myRequestsByShift = Object.fromEntries(shifts.map(s => [
    s.id,
    rideRequests.filter(r => r.shift_id === s.id && r.requesterId === user?.uid),
  ]))
  const rawManualAvailable = manualRides
    .map(r => ({ ...r, _status: computeRideStatus(r) }))
    .filter(r => (r._status === 'open' || r._status === 'full') && r.driverId !== user?.uid && !activeBookedRideIds.has(r.id))
    .sort((a, b) => `${a.departure_date}${a.departure_time}`.localeCompare(`${b.departure_date}${b.departure_time}`))

  const allRawAvailable = isTroopiter
    ? [...Object.values(rawAvailableByShift).flat(), ...rawManualAvailable]
    : Object.values(rawAvailableByNetwork).flat()

  // Distinct origin/destination options across every favorited network's (or,
  // for troopiter, every shift's) available rides — mirrors the pattern in
  // dashboard/network/[networkId]/page.jsx
  const originOptions = [...new Set(allRawAvailable.map(r => r.departure).filter(Boolean))]
    .sort((a, b) => resolveLocation(a).localeCompare(resolveLocation(b)))
  const destinationOptions = [...new Set(allRawAvailable.map(r => r.arrival).filter(Boolean))]
    .sort((a, b) => resolveLocation(a).localeCompare(resolveLocation(b)))

  // Filters apply uniformly across every network's (or shift's) list (issue #84)
  const searchLower = searchTerm.trim().toLowerCase()
  const favoriteDriverIds = new Set((user?.favorite_drivers || []).map(d => d.id))
  const passesAvailableFilters = (r) => {
    if (filterDate && r.departure_date !== filterDate) return false
    if (filterOrigin && r.departure !== filterOrigin) return false
    if (filterDestination && r.arrival !== filterDestination) return false
    if (favoriteDriversOnly && !favoriteDriverIds.has(r.driverId || r.driver?.id)) return false
    if (searchLower) {
      const haystack = [r.driver?.fullname, resolveLocation(r.departure), resolveLocation(r.arrival)]
        .filter(Boolean).join(' ').toLowerCase()
      if (!haystack.includes(searchLower)) return false
    }
    return true
  }
  const availableByNetwork = Object.fromEntries(favorites.map(id => [id, rawAvailableByNetwork[id].filter(passesAvailableFilters)]))
  const availableByShift = Object.fromEntries(shifts.map(s => [s.id, rawAvailableByShift[s.id].filter(passesAvailableFilters)]))
  const availableManual = rawManualAvailable.filter(passesAvailableFilters)

  // Shifts this user is rostered on show expanded; everything else (posted
  // for the org, but not this user's own shift) collapses under "Other
  // shifts/events" by default, same treatment as Past Rides.
  const normalizedUserEmail = normalizeEmail(user?.email)
  const myShifts = shifts.filter(s => (s.rosterEmails || []).includes(normalizedUserEmail))
  const otherShifts = shifts.filter(s => !(s.rosterEmails || []).includes(normalizedUserEmail))
  // Manually-offered rides (top-level Offer button, no real shift record)
  // grouped by their own typed shift/event name — still discoverable by
  // other riders, just bucketed under "Other shifts/events" alongside
  // shifts this user isn't part of, since there's no roster to place them
  // under otherwise.
  const manualGroups = groupByShift(availableManual)

  const requestOriginOptions = [...new Set(rideRequests.map(r => r.departure).filter(Boolean))]
    .sort((a, b) => resolveLocation(a).localeCompare(resolveLocation(b)))
  const requestDestinationOptions = [...new Set(rideRequests.map(r => r.arrival).filter(Boolean))]
    .sort((a, b) => resolveLocation(a).localeCompare(resolveLocation(b)))

  const requestSearchLower = requestSearchTerm.trim().toLowerCase()
  const favoriteRiderIds = new Set((user?.favorite_riders || []).map(r => r.id))
  const filteredRideRequests = rideRequests.filter(r => {
    if (requestFilterDate && r.departure_date !== requestFilterDate) return false
    if (requestFilterOrigin && r.departure !== requestFilterOrigin) return false
    if (requestFilterDestination && r.arrival !== requestFilterDestination) return false
    if (favoriteRidersOnly && !favoriteRiderIds.has(r.requesterId || r.requester?.id)) return false
    if (requestSearchLower) {
      const haystack = [r.requester?.fullname, resolveLocation(r.departure), resolveLocation(r.arrival)]
        .filter(Boolean).join(' ').toLowerCase()
      if (!haystack.includes(requestSearchLower)) return false
    }
    return true
  })

  const toggleSection = (key) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))

  const moveFavorite = (id, dir) => {
    const i = favorites.indexOf(id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= favorites.length) return
    const next = [...favorites]
    ;[next[i], next[j]] = [next[j], next[i]]
    saveFavorites(next)
  }

  const unfavorite = (id) => {
    if (favorites.length > 1) saveFavorites(favorites.filter(f => f !== id))
  }

  const openOffer = (networkId) => openPopup(<OfferRideTitle />, <OfferRidePopup networkId={networkId} />)
  const openAddFavorite = () => openPopup('Add favorite network', <AddFavoritePopup favorites={favorites} />)
  const openRequestRide = () => openPopup('Request a ride', <RequestRidePopup onSaved={() => fetchDataRef.current?.()} />)

  // Shift-scoped variants (issue #199) — the shift doc itself already has
  // everything OfferRidePopup/RequestRidePopup need to prefill, so it's
  // passed straight through rather than remapped.
  const refreshAfterShiftRide = () => { fetchDataRef.current?.(); fetchShiftsRef.current?.() }
  const openOfferForShift = (s) => openPopup(<OfferRideTitle />, <OfferRidePopup networkId={TROOPITER_NETWORK_ID} shift={s} onSaved={refreshAfterShiftRide} />)
  const openRequestForShift = (s) => openPopup('Request a ride', <RequestRidePopup shift={s} onSaved={refreshAfterShiftRide} />)

  const handleCancelRequest = async (reason) => {
    const id = cancelingRequestId
    setCancelingRequestId(null)
    const ok = await cancelRideRequest(id, reason)
    if (ok) setRideRequests(prev => prev.filter(r => r.id !== id))
  }

  // Renders the current user's own offered ride(s)/request(s) for a card
  // (network or shift) — always visible, unaffected by Available Rides
  // filters, since it's a "here's what you already posted" reminder rather
  // than part of the bookable list (issue #228).
  const renderMyEntries = (networkId, myOfferedList, myRequestedList = []) => (
    (myOfferedList.length > 0 || myRequestedList.length > 0) && (
      <div className="space-y-2">
        {myOfferedList.map(ride => (
          <NetworkRideCard key={ride.id} ride={ride} networkId={networkId} />
        ))}
        {myRequestedList.map(r => (
          <MyRequestSummaryCard
            key={r.id}
            r={r}
            onOpen={() => openPopup('Ride request details', <RideRequestDetailsPopup request={r} onChanged={refreshAfterShiftRide} />)}
            onCancel={() => setCancelingRequestId(r.id)}
          />
        ))}
      </div>
    )
  )

  // One card per shift in Available Rides (issue #199) — title/date + inline
  // Offer/Request buttons scoped to that shift, no network picker needed.
  const renderShiftSection = (s) => {
    const available = availableByShift[s.id] || []
    const raw = rawAvailableByShift[s.id] || []
    const myOfferedForShift = myOfferedByShift[s.id] || []
    const myRequestedForShift = myRequestsByShift[s.id] || []
    const hasOwnEntry = myOfferedForShift.length > 0 || myRequestedForShift.length > 0
    const { page: availPage, pageCount: availPageCount, paged: pagedAvailable } = paginate(available, availablePages[s.id] || 0)
    const setAvailPage = (updater) => setAvailablePages(prev => ({ ...prev, [s.id]: updater(prev[s.id] || 0) }))
    return (
      <div key={s.id} className="space-y-2 rounded-lg border border-border bg-muted/45 dark:bg-[oklch(0.39_0_0)] p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            className="flex items-center gap-2 font-semibold hover:text-primary transition-colors"
            onClick={() => toggleSection(s.id)}
          >
            {collapsed[s.id] ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
            {s.title}
            <span className="text-muted-foreground font-normal">
              {formatDate(s.date)}{available.length > 0 && ` · ${available.length}`}
            </span>
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <Button size="sm" variant="outline" onClick={() => openRequestForShift(s)}>
              <Plus className="size-3.5 mr-1" /> Request Ride
            </Button>
            <Button size="sm" onClick={() => openOfferForShift(s)}>
              <Plus className="size-3.5 mr-1" /> Offer Ride
            </Button>
          </div>
        </div>
        {!collapsed[s.id] && (<>
          {renderMyEntries(TROOPITER_NETWORK_ID, myOfferedForShift, myRequestedForShift)}
          {available.length === 0 ? (
            hasOwnEntry && !hasAvailableFilters ? null : (
              <Card>
                <CardContent className="py-6 text-center text-muted-foreground text-sm">
                  {hasAvailableFilters && raw.length > 0
                    ? 'No rides match your filters.'
                    : 'No rides available. Click on Offer or Request ride above.'}
                </CardContent>
              </Card>
            )
          ) : (<>
            {pagedAvailable.map(ride => (
              <NetworkRideCard key={ride.id} ride={ride} networkId={TROOPITER_NETWORK_ID} />
            ))}
            <Pager
              page={availPage}
              pageCount={availPageCount}
              onPrev={() => setAvailPage(p => p - 1)}
              onNext={() => setAvailPage(p => p + 1)}
            />
          </>)}
        </>)}
      </div>
    )
  }

  // Rides offered via the top-level Offer button (no real shift record),
  // grouped by their own typed shift/event name — no inline Offer/Request
  // buttons, since there's no shift record to scope them to.
  const renderManualGroup = ({ name, rides: groupRides }) => {
    const key = `manual-${name}`
    const { page: availPage, pageCount: availPageCount, paged: pagedAvailable } = paginate(groupRides, availablePages[key] || 0)
    const setAvailPage = (updater) => setAvailablePages(prev => ({ ...prev, [key]: updater(prev[key] || 0) }))
    return (
      <div key={key} className="space-y-2 rounded-lg border border-border bg-muted/45 dark:bg-[oklch(0.39_0_0)] p-3">
        <button
          className="flex items-center gap-2 font-semibold hover:text-primary transition-colors"
          onClick={() => toggleSection(key)}
        >
          {collapsed[key] ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
          {name}
          <span className="text-muted-foreground font-normal">
            {formatDate(groupRides[0]?.departure_date)} · {groupRides.length}
          </span>
        </button>
        {!collapsed[key] && (<>
          {pagedAvailable.map(ride => (
            <NetworkRideCard key={ride.id} ride={ride} networkId={TROOPITER_NETWORK_ID} />
          ))}
          <Pager
            page={availPage}
            pageCount={availPageCount}
            onPrev={() => setAvailPage(p => p - 1)}
            onNext={() => setAvailPage(p => p + 1)}
          />
        </>)}
      </div>
    )
  }

  const banner = (
    <div
      className="relative h-40 w-full overflow-hidden"
      style={{ backgroundImage: 'url(/assets/hood_2.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-black/40 flex items-center gap-4 px-6">
        <UserAvatar user={user} size="lg" />
        <div>
          <p className="text-white text-2xl font-bold leading-tight">{user?.fullname}</p>
          <p className="text-white/70 text-sm">{orgName}</p>
        </div>
      </div>
    </div>
  )

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={openRequestRide}>
        <Plus className="size-4 mr-1" /> Request Ride
      </Button>
      {isTroopiter ? (
        <Button size="sm" onClick={() => openOffer(TROOPITER_NETWORK_ID)}>
          <Plus className="size-4 mr-1" /> Offer Ride
        </Button>
      ) : (
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm">
              <Plus className="size-4 mr-1" /> Offer Ride <ChevronDown className="size-3.5 ml-1" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="end">
            {NETWORKS.map(net => (
              <button
                key={net.id}
                className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
                onClick={() => openOffer(net.id)}
              >
                {net.name}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      )}
    </div>
  )

  return (
    <DashboardLayout banner={banner} headerActions={headerActions}>
      <div className="space-y-8">

        {/* ── Ride update notifications ────────────────────── */}
        {bookings.filter(b => b.ride_updated && !b.update_seen).map(b => (
          <RideUpdatedBanner key={b.id} booking={b} onDismiss={() => {
            dismissRideUpdate(b.id)
            setBookings(prev => prev.map(x => x.id === b.id ? { ...x, update_seen: true } : x))
          }} />
        ))}

        {/* ── Rides Today ─────────────────────────────────── */}
        {todayRides.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-green-700">Ride Today!</h3>
            {todayRides.map((ride, i) => (
              <TodayRideCard key={i} ride={ride} />
            ))}
          </section>
        )}

        {/* ── Scheduled Rides ─────────────────────────────── */}
        <section className="space-y-3 rounded-lg border border-border bg-muted/45 dark:bg-[oklch(0.39_0_0)] p-3">
          <button
            className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => toggleSection('scheduled')}
          >
            {collapsed['scheduled'] ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
            Scheduled Rides {upcoming.length > 0 && <span className="text-foreground ml-1">({upcoming.length})</span>}
          </button>
          {!collapsed['scheduled'] && (!loaded ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scheduled rides. Book one from the available rides below, or offer a ride.</p>
          ) : (<>
            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {pagedUpcoming.map((r, i) => (
                <RideRowCard
                  key={i}
                  departure={r.departure}
                  arrival={r.arrival}
                  date={r.departure_date}
                  time={r.departure_time}
                  details={r.return_departure_time && (
                    <p className="text-sm text-muted-foreground">Return departs {formatTime(r.return_departure_time)}</p>
                  )}
                  badges={<>
                    {typeBadge(r)}
                    <Badge variant="outline">{rideGroupLabel(r)}</Badge>
                    <Badge variant="outline">{seatsText(r)}</Badge>
                  </>}
                  onClick={rideHref(r) ? () => router.push(rideHref(r)) : undefined}
                />
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table className="border border-border">
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Date &amp; Time</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>{isTroopiter ? 'Shift' : 'Network'}</TableHead>
                    <TableHead>Return</TableHead>
                    <TableHead>Seats</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedUpcoming.map((r, i) => {
                    const href = rideHref(r)
                    return (
                      <TableRow
                        key={i}
                        className={href ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}
                        onClick={() => href && router.push(href)}
                      >
                        <TableCell>{typeBadge(r)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(r.departure_date)} at {formatTime(r.departure_time)}</TableCell>
                        <TableCell>{resolveLocation(r.departure)} → {resolveLocation(r.arrival)}</TableCell>
                        <TableCell className="whitespace-nowrap">{rideGroupLabel(r)}</TableCell>
                        <TableCell>{formatTime(r.return_departure_time)}</TableCell>
                        <TableCell className="whitespace-nowrap">{seatsText(r)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <Pager
              page={effectiveScheduledPage}
              pageCount={scheduledPageCount}
              onPrev={() => setScheduledPage(p => p - 1)}
              onNext={() => setScheduledPage(p => p + 1)}
            />
          </>))}
        </section>

        {/* ── Requested Rides ──────────────────────────────── */}
        {rideRequests.length > 0 && (
          <section className="space-y-2 rounded-lg border border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/30 p-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-purple-800 dark:text-purple-300">
                Requested Rides <span className="font-normal">({filteredRideRequests.length})</span>
              </h4>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-40">
                  <DatePicker
                    date={requestFilterDate ? new Date(requestFilterDate + 'T12:00:00') : undefined}
                    setDate={(d) => setRequestFilterDate(d ? toLocalDateStr(d) : '')}
                  />
                </div>
                <Select value={requestFilterOrigin} onValueChange={setRequestFilterOrigin}>
                  <SelectTrigger className="w-44 h-9 text-sm">
                    <SelectValue placeholder="Origin" />
                  </SelectTrigger>
                  <SelectContent>
                    {requestOriginOptions.map(id => (
                      <SelectItem key={id} value={id}>{resolveLocation(id)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={requestFilterDestination} onValueChange={setRequestFilterDestination}>
                  <SelectTrigger className="w-44 h-9 text-sm">
                    <SelectValue placeholder="Destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {requestDestinationOptions.map(id => (
                      <SelectItem key={id} value={id}>{resolveLocation(id)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => openPopup('Search requests', <SearchRidesPopup initialValue={requestSearchTerm} onApply={setRequestSearchTerm} />)}
                >
                  <Search className="size-3.5 mr-1" /> {requestSearchTerm ? `“${requestSearchTerm}”` : 'Search'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  aria-pressed={favoriteRidersOnly}
                  onClick={() => setFavoriteRidersOnly(v => !v)}
                >
                  <Star className={`size-3.5 mr-1 ${favoriteRidersOnly ? 'fill-yellow-400 text-yellow-400' : ''}`} /> Favorite riders
                </Button>
                {hasRequestFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setRequestFilterDate(''); setRequestFilterOrigin(''); setRequestFilterDestination(''); setRequestSearchTerm(''); setFavoriteRidersOnly(false) }}
                  >
                    <X className="size-3.5 mr-1" /> Clear filters
                  </Button>
                )}
              </div>
            </div>

            {filteredRideRequests.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-muted-foreground text-sm">
                  No requests match your filters.
                </CardContent>
              </Card>
            ) : (
            <div className="space-y-2">
              {filteredRideRequests.map(r => (
                <Card
                  key={r.id}
                  className="py-0 cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => openPopup(
                    'Ride request details',
                    <RideRequestDetailsPopup request={r} onChanged={() => fetchDataRef.current?.()} />
                  )}
                >
                  <CardContent className="py-2.5 flex items-center justify-between gap-4 flex-wrap">
                    <div className="space-y-1">
                      <div className="font-semibold flex items-center gap-2">
                        <MapPin className="size-4 text-muted-foreground shrink-0" />
                        {resolveLocation(r.departure)}
                        <MoveRight className="size-4 text-muted-foreground" />
                        {resolveLocation(r.arrival)}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="size-3.5" />
                        <span className="font-bold text-foreground">{formatDate(r.departure_date)}</span>
                        <span>at</span>
                        <span className="font-bold text-foreground">{formatTime(r.departure_time)}</span>
                      </div>
                      {r.requester?.fullname && (
                        <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <UserAvatar user={r.requester} size="sm" />
                          Requested by: <span className="text-foreground font-medium">{r.requester.fullname}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{r.seats_requested} seat{r.seats_requested !== 1 ? 's' : ''}</Badge>
                      {r.equipment && r.equipment !== 'no_equipment' && (
                        <Badge variant="outline">{equipmentLabel(r.equipment)}</Badge>
                      )}
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900 dark:text-purple-200">
                        Ride request
                      </span>
                      {r.requesterId === user?.uid && (
                        <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setCancelingRequestId(r.id) }}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            )}
          </section>
        )}

        {/* ── Available Rides ─────────────────────────────── */}
        <section className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Available Rides</h4>

            {allRawAvailable.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-40">
                  <DatePicker
                    date={filterDate ? new Date(filterDate + 'T12:00:00') : undefined}
                    setDate={(d) => setFilterDate(d ? toLocalDateStr(d) : '')}
                  />
                </div>
                <Select value={filterOrigin} onValueChange={setFilterOrigin}>
                  <SelectTrigger className="w-44 h-9 text-sm">
                    <SelectValue placeholder="Origin" />
                  </SelectTrigger>
                  <SelectContent>
                    {originOptions.map(id => (
                      <SelectItem key={id} value={id}>{resolveLocation(id)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterDestination} onValueChange={setFilterDestination}>
                  <SelectTrigger className="w-44 h-9 text-sm">
                    <SelectValue placeholder="Destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {destinationOptions.map(id => (
                      <SelectItem key={id} value={id}>{resolveLocation(id)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => openPopup('Search rides', <SearchRidesPopup initialValue={searchTerm} onApply={setSearchTerm} />)}
                >
                  <Search className="size-3.5 mr-1" /> {searchTerm ? `“${searchTerm}”` : 'Search'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  aria-pressed={favoriteDriversOnly}
                  onClick={() => setFavoriteDriversOnly(v => !v)}
                >
                  <Star className={`size-3.5 mr-1 ${favoriteDriversOnly ? 'fill-yellow-400 text-yellow-400' : ''}`} /> Favorite drivers
                </Button>
                {hasAvailableFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setFilterDate(''); setFilterOrigin(''); setFilterDestination(''); setSearchTerm(''); setFavoriteDriversOnly(false) }}
                  >
                    <X className="size-3.5 mr-1" /> Clear filters
                  </Button>
                )}
              </div>
            )}
          </div>

          {(isTroopiter ? !shiftsLoaded : networkRides === null) ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : isTroopiter ? (
            myShifts.length === 0 && otherShifts.length === 0 && manualGroups.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-muted-foreground text-sm">
                  No shifts posted yet.
                </CardContent>
              </Card>
            ) : (<>
              {myShifts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No shifts posted for you yet — check "Other shifts/events" below, or offer/request a ride directly.</p>
              ) : (
                myShifts.map(renderShiftSection)
              )}
              {(otherShifts.length > 0 || manualGroups.length > 0) && (
                <div className="space-y-2">
                  <button
                    className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setOtherShiftsOpen(o => !o)}
                  >
                    {otherShiftsOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    Other Shifts / Events <span className="normal-case font-normal ml-1">({otherShifts.length + manualGroups.length})</span>
                  </button>
                  {otherShiftsOpen && (
                    <div className="space-y-2">
                      {otherShifts.map(renderShiftSection)}
                      {manualGroups.map(renderManualGroup)}
                    </div>
                  )}
                </div>
              )}
            </>)
          ) : (
            favorites.map((id, idx) => {
              const available = availableByNetwork[id] || []
              const myOfferedForNetwork = myOfferedByNetwork[id] || []
              const { page: availPage, pageCount: availPageCount, paged: pagedAvailable } = paginate(available, availablePages[id] || 0)
              const setAvailPage = (updater) => setAvailablePages(prev => ({ ...prev, [id]: updater(prev[id] || 0) }))
              return (
                <div key={id} className="space-y-2 rounded-lg border border-border bg-muted/45 dark:bg-[oklch(0.39_0_0)] p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      className="flex items-center gap-2 font-semibold hover:text-primary transition-colors"
                      onClick={() => toggleSection(id)}
                    >
                      {collapsed[id] ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                      {networkName(id)}
                      {available.length > 0 && <span className="text-muted-foreground font-normal">({available.length})</span>}
                    </button>
                    <div className="flex items-center gap-1 ml-auto">
                      {favorites.length > 1 && (
                        <button
                          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors mr-1"
                          onClick={() => unfavorite(id)}
                        >
                          unfavorite
                        </button>
                      )}
                      <Button
                        variant="ghost" size="icon" className="size-7"
                        disabled={idx === 0}
                        onClick={() => moveFavorite(id, -1)}
                        aria-label={`Move ${networkName(id)} up`}
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="size-7"
                        disabled={idx === favorites.length - 1}
                        onClick={() => moveFavorite(id, 1)}
                        aria-label={`Move ${networkName(id)} down`}
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  {!collapsed[id] && (<>
                    {renderMyEntries(id, myOfferedForNetwork)}
                    {available.length === 0 ? (
                      myOfferedForNetwork.length > 0 && !hasAvailableFilters ? null : (
                        <Card>
                          <CardContent className="py-6 text-center text-muted-foreground text-sm">
                            {hasAvailableFilters && rawAvailableByNetwork[id].length > 0 ? (
                              'No rides match your filters.'
                            ) : (
                              <>No rides available. Be the first to{' '}
                                <button className="text-primary underline" onClick={() => openOffer(id)}>
                                  offer one
                                </button>.
                              </>
                            )}
                          </CardContent>
                        </Card>
                      )
                    ) : (<>
                      {pagedAvailable.map(ride => (
                        <NetworkRideCard key={ride.id} ride={ride} networkId={id} />
                      ))}
                      <Pager
                        page={availPage}
                        pageCount={availPageCount}
                        onPrev={() => setAvailPage(p => p - 1)}
                        onNext={() => setAvailPage(p => p + 1)}
                      />
                    </>)}
                  </>)}
                </div>
              )
            })
          )}

          {!isTroopiter && favorites.length > 0 && favorites.length < NETWORKS.length && (
            <Button variant="outline" size="sm" onClick={openAddFavorite}>
              <Plus className="size-4 mr-1" /> Add favorite
            </Button>
          )}
        </section>

        {/* ── Past Rides ──────────────────────────────────── */}
        {past.length > 0 && (
          <section className="space-y-3">
            <button
              className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setPastOpen(o => !o)}
            >
              {pastOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              Past Rides <span className="normal-case font-normal ml-1">({past.length})</span>
            </button>
            {pastOpen && <>
              {/* Mobile cards */}
              <div className="space-y-2 md:hidden">
                {pagedPast.map((r, i) => {
                  const status = normalizeStatus(r._type === 'offered' ? r.ride_status : r.booking_status)
                  return (
                    <RideRowCard
                      key={i}
                      departure={r.departure}
                      arrival={r.arrival}
                      date={r.departure_date}
                      badges={<>
                        {typeBadge(r)}
                        <Badge variant={status}>{status}</Badge>
                      </>}
                    />
                  )
                })}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table className="border border-border">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedPast.map((r, i) => {
                      const status = normalizeStatus(r._type === 'offered' ? r.ride_status : r.booking_status)
                      return (
                        <TableRow key={i}>
                          <TableCell>{typeBadge(r)}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatDate(r.departure_date)}</TableCell>
                          <TableCell>{resolveLocation(r.departure)} → {resolveLocation(r.arrival)}</TableCell>
                          <TableCell>
                            <Badge variant={status}>{status}</Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <Pager
                page={effectivePastPage}
                pageCount={pastPageCount}
                onPrev={() => setPastPage(p => p - 1)}
                onNext={() => setPastPage(p => p + 1)}
              />
            </>}
          </section>
        )}

      </div>

      <AchievementBadge
        open={badgeDialogOpen}
        onOpenChange={setBadgeDialogOpen}
        badges={earnedBadges}
        onAcknowledge={handleBadgeAcknowledge}
      />

      <CancelReasonDialog
        open={!!cancelingRequestId}
        onOpenChange={(open) => { if (!open) setCancelingRequestId(null) }}
        title="Cancel your ride request?"
        description="This removes your request from the board. You can submit a new one any time."
        onConfirm={handleCancelRequest}
      />
    </DashboardLayout>
  )
}

// Compact variant of the request card used in the flat "Requested Rides"
// section (page.jsx ~776-830) — reused inside a shift card to surface the
// user's own request there too (issue #228), rather than duplicating the
// full card markup.
function MyRequestSummaryCard({ r, onOpen, onCancel }) {
  const { resolveLocation } = useLocations()
  return (
    <Card
      className="py-0 cursor-pointer hover:border-primary/50 transition-colors border-purple-200 dark:border-purple-900"
      onClick={onOpen}
    >
      <CardContent className="py-2.5 flex items-center justify-between gap-4 flex-wrap">
        <div className="font-semibold flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
          <span className="flex items-center gap-2 min-w-0">
            <MapPin className="size-4 text-muted-foreground shrink-0" />
            <span className="break-words">{resolveLocation(r.departure)}</span>
          </span>
          <span className="flex items-center gap-2 min-w-0">
            <MoveRight className="size-4 text-muted-foreground shrink-0" />
            <span className="break-words">{resolveLocation(r.arrival)}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">{r.seats_requested} seat{r.seats_requested !== 1 ? 's' : ''}</Badge>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900 dark:text-purple-200">
            Your request
          </span>
          <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); onCancel() }}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function RideUpdatedBanner({ booking, onDismiss }) {
  const { resolveLocation } = useLocations()
  const r = booking.updated_ride_snapshot || booking
  return (
    <div className="rounded-xl border border-yellow-400 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-600 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold text-yellow-800 dark:text-yellow-200">
          <AlertTriangle className="size-4 shrink-0" />
          One of your rides has changed!
        </div>
        <button
          onClick={onDismiss}
          className="text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-200 transition-colors"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="text-sm text-yellow-900 dark:text-yellow-100 space-y-1">
        <p><span className="font-medium">Route:</span> {resolveLocation(r.departure)} → {resolveLocation(r.arrival)}</p>
        <p><span className="font-medium">Date:</span> {formatDate(r.departure_date)}</p>
        <p><span className="font-medium">Departs:</span> {formatTime(r.departure_time)}</p>
        {r.arrival_time && <p><span className="font-medium">Arrives:</span> {formatTime(r.arrival_time)}</p>}
        {r.return_departure_time && <p><span className="font-medium">Return departs:</span> {formatTime(r.return_departure_time)}</p>}
        {r.ride_description && <p><span className="font-medium">Notes:</span> {r.ride_description}</p>}
      </div>
      <Button size="sm" variant="outline" className="border-yellow-400 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-100 dark:hover:bg-yellow-900" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  )
}

function TodayRideCard({ ride }) {
  const { resolveLocation } = useLocations()
  const isOffering = ride._type === 'offered'
  const networkId  = ride.network_id || ride.networkId
  const rideId     = isOffering ? ride.id : ride.ride_id
  const href       = networkId && rideId ? `/dashboard/network/${networkId}/rides/${rideId}` : '#'

  const now       = new Date()
  const departure = new Date(`${ride.departure_date}T${ride.departure_time || '00:00'}`)
  const arrival   = ride.arrival_time
    ? new Date(`${ride.departure_date}T${ride.arrival_time}`)
    : new Date(departure.getTime() + 4 * 60 * 60 * 1000)
  const inProgress = now >= departure && now <= arrival

  return (
    <Link href={href}>
      <Card className="border-green-600 bg-green-700 hover:bg-green-600 transition-colors cursor-pointer">
        <CardHeader className="flex items-center gap-3">

          {/* Logo with optional spinning ring */}
          <div className="relative size-12 shrink-0 flex items-center justify-center">
            {inProgress && (
              <div
                className="absolute inset-0 rounded-full animate-spin"
                style={{
                  background: 'conic-gradient(from 0deg, transparent 75%, rgba(255,255,255,0.75) 100%)',
                  animationDuration: '4s',
                  animationTimingFunction: 'linear',
                }}
              />
            )}
            <div className="size-11 rounded-full bg-green-500/40 flex items-center justify-center relative z-10">
              <Car className="text-white" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2 flex-wrap">
              {resolveLocation(ride.departure)} <MoveRight className="size-4 shrink-0" /> {resolveLocation(ride.arrival)}
            </CardTitle>
            <p className="text-sm text-green-100 flex items-center gap-1 mt-0.5">
              <Clock className="size-3.5 shrink-0" /> {formatDate(ride.departure_date)} at {formatTime(ride.departure_time)}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {inProgress && (
                <Badge className="bg-white text-green-800 border-white/50 font-semibold">
                  In Progress
                </Badge>
              )}
              <Badge className="bg-white/20 text-white border-white/30">
                {isOffering ? 'You are driving' : 'You are a passenger'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm text-green-100">
          <p><MapPin className="inline size-4 mr-1" /><span className="font-medium text-white">Departure:</span> {resolveLocation(ride.departure)}</p>
          <p><Navigation className="inline size-4 mr-1" /><span className="font-medium text-white">Arrival:</span> {resolveLocation(ride.arrival)}</p>
          {ride.arrival_time && (
            <p><Clock className="inline size-4 mr-1" /><span className="font-medium text-white">Arrives:</span> {formatTime(ride.arrival_time)}</p>
          )}
          {ride.return_departure_time && (
            <p><Clock className="inline size-4 mr-1" /><span className="font-medium text-white">Return departs:</span> {formatTime(ride.return_departure_time)}</p>
          )}
          {ride.ride_description && (
            <p><Info className="inline size-4 mr-1" /><span className="font-medium text-white">Notes:</span> {ride.ride_description}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
