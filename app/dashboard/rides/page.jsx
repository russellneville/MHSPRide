'use client'
import { useNetwork } from "@/context/NetworksContext";
import DashboardLayout from "../dashboardLayout";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePopup } from "@/context/PopupContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { toLocalDateStr } from "@/lib/utils";
import OfferRidePopup from "@/components/popup-forms/OfferRidePopup";

const PAGE_SIZE = 25

const KNOWN_NETWORKS = [
  { id: "network-HILLPATROL",    name: "Hill Patrol" },
  { id: "network-MOUNTAINHOSTS", name: "Mountain Hosts" },
  { id: "network-NORDIC",        name: "Nordic" },
]

function normalizeStatus(s) {
  return s === 'cancled' ? 'canceled' : (s || '—')
}

function isCanceled(r) {
  return normalizeStatus(r.ride_status) === 'canceled'
}

export default function MyOfferedRides() {
  const { getRides, getNetworkList } = useNetwork()
  const { openPopup } = usePopup()
  const { user } = useAuth()
  const [rides, setRides] = useState([])
  const [joinedNetworks, setJoinedNetworks] = useState([])
  const [pastOpen, setPastOpen] = useState(false)
  const [pastPage, setPastPage] = useState(0)

  useEffect(() => {
    if (!user) return
    getRides().then(data => setRides(data || []))
    getNetworkList().then(list => {
      const ids = new Set((list || []).map(n => n.id))
      setJoinedNetworks(KNOWN_NETWORKS.filter(n => ids.has(n.id)))
    })
  }, [user]);

  const today = toLocalDateStr(new Date())

  const upcoming = rides
    .filter(r => r.departure_date >= today && !isCanceled(r))
    .sort((a, b) => `${a.departure_date}${a.departure_time}`.localeCompare(`${b.departure_date}${b.departure_time}`))

  const past = rides
    .filter(r => r.departure_date < today || isCanceled(r))
    .sort((a, b) => `${b.departure_date}${b.departure_time}`.localeCompare(`${a.departure_date}${a.departure_time}`))

  const pastPageCount = Math.ceil(past.length / PAGE_SIZE)
  const pagedPast = past.slice(pastPage * PAGE_SIZE, (pastPage + 1) * PAGE_SIZE)

  const openOffer = (networkId) => {
    openPopup('Offer ride', <OfferRidePopup networkId={networkId} />)
  }

  const OfferButton = () => {
    if (joinedNetworks.length === 0) return null
    if (joinedNetworks.length === 1) {
      return (
        <Button onClick={() => openOffer(joinedNetworks[0].id)}>
          <Plus className="size-4 mr-1" /> Offer Ride
        </Button>
      )
    }
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button>
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
    )
  }

  const RideTable = ({ rows }) => (
    <Table className="border border-border overflow-x-auto">
      <TableHeader>
        <TableRow>
          <TableHead>Departure</TableHead>
          <TableHead>Arrival</TableHead>
          <TableHead>Departure date</TableHead>
          <TableHead>Arrival date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Booked seats</TableHead>
          <TableHead>Available seats</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(r => {
          const status = normalizeStatus(r.ride_status)
          return (
            <TableRow key={r.id} className={r.departure_date === today ? 'bg-blue-50 dark:bg-blue-950' : ''}>
              <TableCell>{r.departure}</TableCell>
              <TableCell>{r.arrival}</TableCell>
              <TableCell className="whitespace-nowrap">{r.departure_date} at {r.departure_time}</TableCell>
              <TableCell className="whitespace-nowrap">{r.arrival_date} at {r.arrival_time}</TableCell>
              <TableCell><Badge variant={status}>{status}</Badge></TableCell>
              <TableCell>{r.total_seats - r.available_seats}</TableCell>
              <TableCell>{r.available_seats}</TableCell>
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
            <h3 className="text-xl font-semibold">My Offered Rides</h3>
            <OfferButton />
          </div>

          {/* Upcoming */}
          <section className="space-y-2">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Upcoming and Current Rides {upcoming.length > 0 && <span className="text-foreground ml-1">({upcoming.length})</span>}
            </h4>
            {upcoming.length === 0
              ? <p className="text-sm text-muted-foreground">No upcoming rides.</p>
              : <RideTable rows={upcoming} />
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
                Past Rides <span className="normal-case font-normal ml-1">({past.length})</span>
              </button>

              {pastOpen && (
                <div className="space-y-3">
                  <RideTable rows={pagedPast} />
                  {pastPageCount > 1 && (
                    <div className="flex items-center gap-3 text-sm">
                      <Button variant="outline" size="sm" disabled={pastPage === 0} onClick={() => setPastPage(p => p - 1)}>Previous</Button>
                      <span className="text-muted-foreground">Page {pastPage + 1} of {pastPageCount}</span>
                      <Button variant="outline" size="sm" disabled={pastPage >= pastPageCount - 1} onClick={() => setPastPage(p => p + 1)}>Next</Button>
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
