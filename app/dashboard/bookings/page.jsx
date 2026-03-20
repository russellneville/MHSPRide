'use client'
import { useNetwork } from "@/context/NetworksContext";
import DashboardLayout from "../dashboardLayout";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePopup } from "@/context/PopupContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatTime, toLocalDateStr } from "@/lib/utils";
import Link from "next/link";
import RideDetailsPopup from "@/components/popup-forms/RideDetailsPopup";
import { resolveLocation } from "@/lib/locations";

const PAGE_SIZE = 25

function normalizeStatus(s) {
  return s === 'cancled' ? 'canceled' : (s || '—')
}

function isCanceled(b) {
  const s = normalizeStatus(b.booking_status)
  return s === 'canceled'
}

export default function MyBookedRides() {
  const { getBookings } = useNetwork()
  const { user } = useAuth()
  const { openPopup } = usePopup()
  const [bookings, setBookings] = useState([])
  const [pastOpen, setPastOpen] = useState(false)
  const [pastPage, setPastPage] = useState(0)

  useEffect(() => {
    const fetchBookings = async () => {
      const data = await getBookings()
      // Deduplicate by ride_id — keep the most recently booked
      const deduped = Object.values(
        (data || []).reduce((acc, b) => {
          const key = b.ride_id || b.id
          if (!acc[key] || (b.booked_at?.seconds || 0) > (acc[key].booked_at?.seconds || 0)) {
            acc[key] = b
          }
          return acc
        }, {})
      )
      setBookings(deduped)
    }
    if (user) fetchBookings()
  }, [user]);

  const today = toLocalDateStr(new Date())

  const upcoming = bookings
    .filter(b => b.departure_date >= today && !isCanceled(b))
    .sort((a, b) => `${a.departure_date}${a.departure_time}`.localeCompare(`${b.departure_date}${b.departure_time}`))

  const past = bookings
    .filter(b => b.departure_date < today || isCanceled(b))
    .sort((a, b) => `${b.departure_date}${b.departure_time}`.localeCompare(`${a.departure_date}${a.departure_time}`))

  const pastPageCount = Math.ceil(past.length / PAGE_SIZE)
  const pagedPast = past.slice(pastPage * PAGE_SIZE, (pastPage + 1) * PAGE_SIZE)

  const statusBadge = (status) => {
    if (status === 'booked')   return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Booked</Badge>
    if (status === 'canceled') return <Badge className="bg-gray-100 text-gray-600 border-gray-300">Canceled</Badge>
    return <Badge variant="secondary">{status}</Badge>
  }

  const handleRowClick = (b) => {
    openPopup(`${resolveLocation(b.departure)} → ${resolveLocation(b.arrival)}`, <RideDetailsPopup booking={b} />)
  }

  const BookingTable = ({ rows }) => (
    <Table className="border border-border overflow-x-auto">
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Departure</TableHead>
          <TableHead>Arrival</TableHead>
          <TableHead>Driver</TableHead>
          <TableHead>Return Departs</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(b => {
          const status = normalizeStatus(b.booking_status)
          return (
            <TableRow
              key={b.id}
              className={`cursor-pointer hover:bg-muted/50 transition-colors ${b.departure_date === today ? 'bg-blue-50 dark:bg-blue-950' : ''}`}
              onClick={() => handleRowClick(b)}
            >
              <TableCell>{statusBadge(status)}</TableCell>
              <TableCell className="whitespace-nowrap">{b.departure_date} at {formatTime(b.departure_time)}</TableCell>
              <TableCell>{resolveLocation(b.departure)}</TableCell>
              <TableCell>{resolveLocation(b.arrival)}</TableCell>
              <TableCell>{b.driver?.fullname || '—'}</TableCell>
              <TableCell className="whitespace-nowrap">{formatTime(b.return_departure_time)}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )

  return (
    <DashboardLayout>
      {user && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">My Booked Rides</h3>
            <Button asChild>
              <Link href="/dashboard/networks">Find Rides</Link>
            </Button>
          </div>

          {/* Upcoming */}
          <section className="space-y-2">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Upcoming and Current Rides {upcoming.length > 0 && <span className="text-foreground ml-1">({upcoming.length})</span>}
            </h4>
            {upcoming.length === 0
              ? <p className="text-sm text-muted-foreground">No upcoming bookings.</p>
              : <BookingTable rows={upcoming} />
            }
          </section>

          {/* Past */}
          {past.length > 0 && (
            <section className="space-y-2">
              <button
                className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setPastOpen(o => !o)}
              >
                {pastOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                Past Rides <span className="normal-case font-normal text-muted-foreground ml-1">({past.length})</span>
              </button>

              {pastOpen && (
                <div className="space-y-3">
                  <BookingTable rows={pagedPast} />
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
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}
