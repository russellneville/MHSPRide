'use client'
import { useNetwork } from "@/context/NetworksContext"
import DashboardLayout from "./dashboardLayout"
import { useAuth } from "@/context/AuthContext"
import { useEffect, useState } from "react"
import { toLocalDateStr } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Car, Clock, Info, MapPin, MoveRight, Navigation } from "lucide-react"
import Link from "next/link"
import UserAvatar from "@/components/ui/user-avatar"

const PAGE_SIZE = 25

function normalizeStatus(s) {
  return s === 'cancled' ? 'canceled' : (s || '—')
}

export default function Dashboard() {
  const { getRides, getBookings } = useNetwork()
  const { user } = useAuth()
  const [rides, setRides] = useState([])
  const [bookings, setBookings] = useState([])
  const [pastPage, setPastPage] = useState(0)

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return
      const [rideData, bookingData] = await Promise.all([getRides(), getBookings()])
      setRides(rideData || [])
      setBookings(bookingData || [])
    }
    fetchData()
  }, [user])

  const today = toLocalDateStr(new Date())

  const allOffered = rides.map(r => ({ ...r, _type: 'offered' }))
  const allBooked  = bookings.map(b => ({ ...b, _type: 'booked' }))
  const combined   = [...allOffered, ...allBooked]

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

  return (
    <DashboardLayout>
      {/* Hero */}
      <div
        className="relative h-40 w-full rounded-xl overflow-hidden mb-6"
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcoming.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Badge variant="secondary">{r._type === 'offered' ? 'Offering' : 'Booked'}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{r.departure_date}</TableCell>
                    <TableCell>{r.departure}</TableCell>
                    <TableCell>{r.departure_time}</TableCell>
                    <TableCell>{r.arrival}</TableCell>
                    <TableCell>{r.arrival_time || '—'}</TableCell>
                    <TableCell>{r.return_departure_time || '—'}</TableCell>
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
                        <Badge variant="secondary">{r._type === 'offered' ? 'Offered' : 'Booked'}</Badge>
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
