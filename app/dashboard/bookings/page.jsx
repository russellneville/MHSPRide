'use client'
import { useNetwork } from "@/context/NetworksContext";
import DashboardLayout from "../dashboardLayout";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { toLocalDateStr } from "@/lib/utils";
import Link from "next/link";

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
  const [bookings, setBookings] = useState([])
  const [pastOpen, setPastOpen] = useState(false)
  const [pastPage, setPastPage] = useState(0)

  useEffect(() => {
    const fetchBookings = async () => {
      const data = await getBookings();
      setBookings(data || []);
    };
    if (user) fetchBookings();
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

  const BookingTable = ({ rows }) => (
    <Table className="border border-border overflow-x-auto">
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Departure</TableHead>
          <TableHead>Arrival</TableHead>
          <TableHead>Departure date</TableHead>
          <TableHead>Arrival date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(b => {
          const status = normalizeStatus(b.booking_status)
          return (
            <TableRow key={b.id} className={b.departure_date === today ? 'bg-blue-50 dark:bg-blue-950' : ''}>
              <TableCell><Badge variant={status}>{status}</Badge></TableCell>
              <TableCell>{b.departure}</TableCell>
              <TableCell>{b.arrival}</TableCell>
              <TableCell className="whitespace-nowrap">{b.departure_date} at {b.departure_time}</TableCell>
              <TableCell className="whitespace-nowrap">{b.arrival_date} at {b.arrival_time}</TableCell>
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
              <Link href="/dashboard">Find Rides</Link>
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
