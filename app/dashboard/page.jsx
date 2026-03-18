'use client'
import { useNetwork } from "@/context/NetworksContext"
import DashboardLayout from "./dashboardLayout"
import { useAuth } from "@/context/AuthContext"
import { usePopup } from "@/context/PopupContext"
import { useEffect, useState } from "react"
import { toLocalDateStr } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Car, ChevronDown, Clock, Info, MapPin, MoveRight, Navigation, Plus, Search } from "lucide-react"
import Link from "next/link"
import UserAvatar from "@/components/ui/user-avatar"
import OfferRidePopup from "@/components/popup-forms/OfferRidePopup"

const KNOWN_NETWORKS = [
  { id: "network-HILLPATROL",    name: "Hill Patrol" },
  { id: "network-MOUNTAINHOSTS", name: "Mountain Hosts" },
  { id: "network-NORDIC",        name: "Nordic" },
]

const PAGE_SIZE = 25

function normalizeStatus(s) {
  return s === 'cancled' ? 'canceled' : (s || '—')
}

export default function Dashboard() {
  const { getRides, getBookings, getNetworkList } = useNetwork()
  const { user } = useAuth()
  const { openPopup } = usePopup()
  const [rides, setRides] = useState([])
  const [bookings, setBookings] = useState([])
  const [joinedNetworks, setJoinedNetworks] = useState([])
  const [pastPage, setPastPage] = useState(0)

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return
      const [rideData, bookingData, netList] = await Promise.all([getRides(), getBookings(), getNetworkList()])
      setRides(rideData || [])
      setBookings(bookingData || [])
      const ids = new Set((netList || []).map(n => n.id))
      setJoinedNetworks(KNOWN_NETWORKS.filter(n => ids.has(n.id)))
    }
    fetchData()
  }, [user])

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

  const todayRides = combined.filter(r => r.departure_date === today && !isCanceled(r))

  const upcoming = combined
    .filter(r => r.departure_date > today && !isCanceled(r))
    .sort((a, b) =>
      `${a.departure_date}${a.departure_time}`.localeCompare(`${b.departure_date}${b.departure_time}`)
    )

  const past = combined
    .filter(r => r.departure_date < today)
    .sort((a, b) =>
      `${b.departure_date}${b.departure_time}`.localeCompare(`${a.departure_date}${a.departure_time}`)
    )

  const pastPageCount = Math.ceil(past.length / PAGE_SIZE)
  const pagedPast = past.slice(pastPage * PAGE_SIZE, (pastPage + 1) * PAGE_SIZE)

  const openOffer = (networkId) => openPopup('Offer ride', <OfferRidePopup networkId={networkId} />)

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
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href="/dashboard/networks"><Search className="size-4 mr-1" /> Find Ride</Link>
      </Button>
      {joinedNetworks.length === 1 && (
        <Button size="sm" onClick={() => openOffer(joinedNetworks[0].id)}>
          <Plus className="size-4 mr-1" /> Offer Ride
        </Button>
      )}
      {joinedNetworks.length > 1 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm">
              <Plus className="size-4 mr-1" /> Offer Ride <ChevronDown className="size-3.5 ml-1" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="end">
            {joinedNetworks.map(net => (
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

        {/* ── Rides Today ─────────────────────────────────── */}
        {todayRides.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-green-700">Rides Today!</h3>
            {todayRides.map((ride, i) => (
              <TodayRideCard key={i} ride={ride} />
            ))}
          </section>
        )}

        {/* ── Upcoming Rides ──────────────────────────────── */}
        <section className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Upcoming Rides {upcoming.length > 0 && <span className="text-foreground ml-1">({upcoming.length})</span>}
          </h4>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming rides. <Link href="/dashboard/networks" className="text-primary underline">Browse your networks</Link> to offer or book one.</p>
          ) : (
            <Table className="border border-border">
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Departure</TableHead>
                  <TableHead>Departs</TableHead>
                  <TableHead>Arrival</TableHead>
                  <TableHead>Arrives</TableHead>
                  <TableHead>Return</TableHead>
                  <TableHead>Riders</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcoming.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      {r._type === 'offered'
                        ? <Badge className="bg-green-100 text-green-800 border-green-300">Offered</Badge>
                        : <Badge className="bg-blue-100 text-blue-800 border-blue-300">Booked</Badge>
                      }
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{r.departure_date}</TableCell>
                    <TableCell>{r.departure}</TableCell>
                    <TableCell>{r.departure_time}</TableCell>
                    <TableCell>{r.arrival}</TableCell>
                    <TableCell>{r.arrival_time || '—'}</TableCell>
                    <TableCell>{r.return_departure_time || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r._type === 'offered'
                        ? `${(r.total_seats || 0) - (r.available_seats || 0)} of ${r.total_seats || 0}`
                        : '—'
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        {/* ── Past Rides ──────────────────────────────────── */}
        {past.length > 0 && (
          <section className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Past Rides
            </h4>
            <Table className="border border-border">
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Departure</TableHead>
                  <TableHead>Arrival</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedPast.map((r, i) => {
                  const status = normalizeStatus(r._type === 'offered' ? r.ride_status : r.booking_status)
                  return (
                    <TableRow key={i}>
                      <TableCell>
                        {r._type === 'offered'
                          ? <Badge className="bg-green-100 text-green-800 border-green-300">Offered</Badge>
                          : <Badge className="bg-blue-100 text-blue-800 border-blue-300">Booked</Badge>
                        }

                      </TableCell>
                      <TableCell className="whitespace-nowrap">{r.departure_date}</TableCell>
                      <TableCell>{r.departure}</TableCell>
                      <TableCell>{r.arrival}</TableCell>
                      <TableCell>
                        <Badge variant={status}>{status}</Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            {pastPageCount > 1 && (
              <div className="flex items-center gap-3 text-sm">
                <Button variant="outline" size="sm" disabled={pastPage === 0} onClick={() => setPastPage(p => p - 1)}>
                  Previous
                </Button>
                <span className="text-muted-foreground">Page {pastPage + 1} of {pastPageCount}</span>
                <Button variant="outline" size="sm" disabled={pastPage >= pastPageCount - 1} onClick={() => setPastPage(p => p + 1)}>
                  Next
                </Button>
              </div>
            )}
          </section>
        )}

      </div>
    </DashboardLayout>
  )
}

function TodayRideCard({ ride }) {
  const isOffering = ride._type === 'offered'
  const networkId  = ride.network_id || ride.networkId
  const href       = networkId ? `/dashboard/network/${networkId}/rides/${ride.id}` : '#'

  return (
    <Link href={href}>
      <Card className="border-green-200 bg-green-50/50 hover:border-green-400 transition-colors cursor-pointer">
        <CardHeader className="flex items-center gap-3">
          <div className="size-12 rounded-full bg-green-100 flex items-center justify-center">
            <Car className="text-green-700" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
              {ride.departure} <MoveRight className="size-4" /> {ride.arrival}
            </CardTitle>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
              <Clock className="size-3.5" /> {ride.departure_date} at {ride.departure_time}
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {isOffering ? 'You are driving' : 'You are a passenger'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm text-muted-foreground">
          <p><MapPin className="inline size-4 mr-1" /><span className="font-medium">Departure:</span> {ride.departure}</p>
          <p><Navigation className="inline size-4 mr-1" /><span className="font-medium">Arrival:</span> {ride.arrival}</p>
          {ride.arrival_time && (
            <p><Clock className="inline size-4 mr-1" /><span className="font-medium">Arrives:</span> {ride.arrival_time}</p>
          )}
          {ride.return_departure_time && (
            <p><Clock className="inline size-4 mr-1" /><span className="font-medium">Return departs:</span> {ride.return_departure_time}</p>
          )}
          {ride.ride_description && (
            <p><Info className="inline size-4 mr-1" /><span className="font-medium">Notes:</span> {ride.ride_description}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
