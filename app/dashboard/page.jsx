'use client'
import { useNetwork } from "@/context/NetworksContext"
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
import { AlertTriangle, ArrowDown, ArrowUp, Car, ChevronDown, ChevronLeft, ChevronRight, Clock, Info, MapPin, MoveRight, Navigation, Plus, Search, X } from "lucide-react"
import Link from "next/link"
import UserAvatar from "@/components/ui/user-avatar"
import DatePicker from "@/components/ui/date-picker"
import { Skeleton } from "@/components/ui/skeleton"
import OfferRidePopup, { OfferRideTitle } from "@/components/popup-forms/OfferRidePopup"
import AddFavoritePopup from "@/components/popup-forms/AddFavoritePopup"
import SearchRidesPopup from "@/components/popup-forms/SearchRidesPopup"
import RideRowCard from "@/components/cards/ride-row-card"
import NetworkRideCard from "@/components/cards/network-ride-card"
import { useLocations } from "@/context/LocationsContext"
import { computeRideStatus } from "@/lib/rides"
import { NETWORKS, NETWORK_IDS, networkName, defaultFavoritesFor } from "@/lib/networks"
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
  const { getRides, getBookings, getRidesByNetworkId, saveFavorites, dismissRideUpdate } = useNetwork()
  const { resolveLocation } = useLocations()
  const router = useRouter()
  const { user } = useAuth()
  const { openPopup, isOpen } = usePopup()
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
  const migratedRef = useRef(false)

  // Available Rides filters — shared across every favorited network's list (issue #84)
  const [filterDate, setFilterDate] = useState('')
  const [filterOrigin, setFilterOrigin] = useState('')
  const [filterDestination, setFilterDestination] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const hasAvailableFilters = filterDate || filterOrigin || filterDestination || searchTerm

  // Ordered favorites from the live user doc, restricted to known networks
  const favorites = (Array.isArray(user?.favorite_networks) ? user.favorite_networks : [])
    .filter(id => NETWORK_IDS.includes(id))

  // Lazy migration: users from before favorites existed (or who somehow have
  // none) get defaults from their roster classifications, else all networks.
  useEffect(() => {
    if (!user || favorites.length > 0 || migratedRef.current) return
    migratedRef.current = true
    const defaults = defaultFavoritesFor(user.classifications)
    saveFavorites(defaults.length > 0 ? defaults : NETWORK_IDS)
  }, [user, favorites.length])

  // Badge evaluation (resources/badging.md): runs once per dashboard mount for
  // the signed-in user. The server throttles repeat calls to every 10 minutes
  // (app/api/badges/evaluate), so this is safe even though it fires on every
  // navigation back to the dashboard, not just first login. Evaluation always
  // runs, even when the member has hidden badges (Profile → Badges) — hiding
  // only suppresses the reveal, not the tracking, so nothing is lost when
  // they turn it back on. After evaluating, check for ANY unseen badge, not
  // just ones this call awarded — event-based badges (favorited/photo-
  // uploaded, via award-event/route.js) have no other surface that shows
  // the celebration dialog, so this is also what makes those ever appear.
  useEffect(() => {
    if (!user?.uid) return
    let cancelled = false
    evaluateBadges({ theme })
      .then(() => {
        if (cancelled || user.hide_badges) return null
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
      const [rideData, bookingData, ...networkLists] = await Promise.all([
        getRides(),
        getBookings(),
        ...favorites.map(id => getRidesByNetworkId(id)),
      ])
      if (cancelled) return
      setRides(rideData || [])
      setBookings(bookingData || [])
      setNetworkRides(Object.fromEntries(favorites.map((id, i) => [id, networkLists[i] || []])))
      setLoaded(true)
    }
    fetchDataRef.current = fetchData
    fetchData()
    return () => { cancelled = true }
  }, [user, isOpen, favorites.join(',')])

  // Refresh when the tab regains focus (e.g. after booking a ride on the detail page)
  useEffect(() => {
    const onFocus = () => fetchDataRef.current?.()
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

  const allRawAvailable = Object.values(rawAvailableByNetwork).flat()

  // Distinct origin/destination options across every favorited network's
  // available rides — mirrors the pattern in dashboard/network/[networkId]/page.jsx
  const originOptions = [...new Set(allRawAvailable.map(r => r.departure).filter(Boolean))]
    .sort((a, b) => resolveLocation(a).localeCompare(resolveLocation(b)))
  const destinationOptions = [...new Set(allRawAvailable.map(r => r.arrival).filter(Boolean))]
    .sort((a, b) => resolveLocation(a).localeCompare(resolveLocation(b)))

  // Filters apply uniformly across every network's list (issue #84)
  const searchLower = searchTerm.trim().toLowerCase()
  const availableByNetwork = Object.fromEntries(favorites.map(id => [
    id,
    rawAvailableByNetwork[id].filter(r => {
      if (filterDate && r.departure_date !== filterDate) return false
      if (filterOrigin && r.departure !== filterOrigin) return false
      if (filterDestination && r.arrival !== filterDestination) return false
      if (searchLower) {
        const haystack = [r.driver?.fullname, resolveLocation(r.departure), resolveLocation(r.arrival)]
          .filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(searchLower)) return false
      }
      return true
    }),
  ]))

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

  const banner = (
    <div
      className="relative h-40 w-full overflow-hidden"
      style={{ backgroundImage: 'url(/assets/hood_2.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-black/40 flex items-center gap-4 px-6">
        <UserAvatar user={user} size="lg" />
        <div>
          <p className="text-white text-2xl font-bold leading-tight">{user?.fullname}</p>
          <p className="text-white/70 text-sm">Mount Hood Ski Patrol</p>
        </div>
      </div>
    </div>
  )

  const headerActions = (
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
                    <Badge variant="outline">{networkName(rideNetworkId(r))}</Badge>
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
                    <TableHead>Network</TableHead>
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
                        <TableCell className="whitespace-nowrap">{networkName(rideNetworkId(r))}</TableCell>
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
                {hasAvailableFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setFilterDate(''); setFilterOrigin(''); setFilterDestination(''); setSearchTerm('') }}
                  >
                    <X className="size-3.5 mr-1" /> Clear filters
                  </Button>
                )}
              </div>
            )}
          </div>

          {networkRides === null ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            favorites.map((id, idx) => {
              const available = availableByNetwork[id] || []
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
                  {!collapsed[id] && (
                    available.length === 0 ? (
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
                    </>)
                  )}
                </div>
              )
            })
          )}

          {favorites.length > 0 && favorites.length < NETWORKS.length && (
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
    </DashboardLayout>
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
