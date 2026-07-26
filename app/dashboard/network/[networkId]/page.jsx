'use client'
import { useParams } from "next/navigation";
import DashboardLayout from "../../dashboardLayout";
import { useNetwork } from "@/context/NetworksContext";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePopup } from "@/context/PopupContext";
import OfferRidePopup from "@/components/popup-forms/OfferRidePopup";
import { useLocations } from "@/context/LocationsContext";
import { Skeleton } from "@/components/ui/skeleton";
import DatePicker from "@/components/ui/date-picker";
import { computeRideStatus } from "@/lib/rides";
import { networkName } from "@/lib/networks";
import { toLocalDateStr } from "@/lib/utils";
import NetworkRideCard from "@/components/cards/network-ride-card";

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NetworkPage() {
  const { networkId } = useParams();
  const { getRidesByNetworkId } = useNetwork();
  const { resolveLocation } = useLocations();
  const { user } = useAuth();
  const { openPopup } = usePopup();

  const [rides, setRides] = useState(null);
  const [pastOpen, setPastOpen] = useState(false);
  const [ridesKey, setRidesKey] = useState(0);

  const refreshRides = () => setRidesKey(k => k + 1);

  // Filters
  const [filterDate, setFilterDate] = useState('');
  const [filterPickup, setFilterPickup] = useState('');
  const [filterArrival, setFilterArrival] = useState('');
  const [filterDriver, setFilterDriver] = useState('');
  const hasFilters = filterDate || filterPickup || filterArrival || filterDriver;

  useEffect(() => {
    if (!user || !networkId) return;
    getRidesByNetworkId(networkId).then(rideList => setRides(rideList || []));
  }, [user, networkId, ridesKey]);

  if (rides === null) return (
    <DashboardLayout>
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </DashboardLayout>
  );

  // Annotate each ride with computed status
  const annotated = rides.map(r => ({ ...r, _status: computeRideStatus(r) }));

  const now = new Date();
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const upcoming   = annotated.filter(r => r._status === 'open' || r._status === 'full');
  const inProgress = annotated.filter(r => r._status === 'in_progress');
  const past       = annotated.filter(r => {
    if (r._status !== 'completed' && r._status !== 'canceled') return false;
    const dep = new Date(`${r.departure_date}T${r.departure_time || '00:00'}`);
    return dep >= cutoff24h;
  });

  // Sort upcoming by date then time
  const sortedUpcoming = [...upcoming].sort((a, b) =>
    `${a.departure_date}${a.departure_time}`.localeCompare(`${b.departure_date}${b.departure_time}`)
  );

  // Apply filters to upcoming
  const filteredUpcoming = sortedUpcoming.filter(r => {
    if (filterDate && r.departure_date !== filterDate) return false;
    if (filterPickup && r.departure !== filterPickup) return false;
    if (filterArrival && r.arrival !== filterArrival) return false;
    if (filterDriver && r.driver?.fullname !== filterDriver) return false;
    return true;
  });

  // Collect distinct values for filter dropdowns
  const pickupOptions  = [...new Set(sortedUpcoming.map(r => r.departure).filter(Boolean))].sort((a, b) => resolveLocation(a).localeCompare(resolveLocation(b)));
  const arrivalOptions = [...new Set(sortedUpcoming.map(r => r.arrival).filter(Boolean))].sort((a, b) => resolveLocation(a).localeCompare(resolveLocation(b)));
  const driverOptions  = [...new Set(sortedUpcoming.map(r => r.driver?.fullname).filter(Boolean))];

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-xl font-semibold">{networkName(networkId)}</h3>
          <Button onClick={() => openPopup('Offer ride', <OfferRidePopup networkId={networkId} onSaved={refreshRides} />)}>
            Offer Ride <Plus className="size-4 ml-1" />
          </Button>
        </div>

        {/* ── Upcoming rides ──────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Upcoming Rides {upcoming.length > 0 && <span className="ml-1 text-foreground">({upcoming.length})</span>}
            </h4>
          </div>

          {/* Filters */}
          {upcoming.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-40">
                <DatePicker
                  date={filterDate ? new Date(filterDate + 'T12:00:00') : undefined}
                  setDate={(d) => setFilterDate(d ? toLocalDateStr(d) : '')}
                />
              </div>
              <Select value={filterPickup} onValueChange={setFilterPickup}>
                <SelectTrigger className="w-48 h-9 text-sm">
                  <SelectValue placeholder="Pickup location" />
                </SelectTrigger>
                <SelectContent>
                  {pickupOptions.map(id => (
                    <SelectItem key={id} value={id}>{resolveLocation(id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterArrival} onValueChange={setFilterArrival}>
                <SelectTrigger className="w-44 h-9 text-sm">
                  <SelectValue placeholder="Arrival location" />
                </SelectTrigger>
                <SelectContent>
                  {arrivalOptions.map(id => (
                    <SelectItem key={id} value={id}>{resolveLocation(id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterDriver} onValueChange={setFilterDriver}>
                <SelectTrigger className="w-40 h-9 text-sm">
                  <SelectValue placeholder="Driver" />
                </SelectTrigger>
                <SelectContent>
                  {driverOptions.map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={() => { setFilterDate(''); setFilterPickup(''); setFilterArrival(''); setFilterDriver(''); }}>
                  <X className="size-3.5 mr-1" /> Clear
                </Button>
              )}
            </div>
          )}

          {filteredUpcoming.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                {hasFilters
                  ? 'No rides match your filters.'
                  : <>No upcoming rides. Be the first to{' '}
                    <button className="text-primary underline" onClick={() => openPopup('Offer ride', <OfferRidePopup networkId={networkId} onSaved={refreshRides} />)}>
                      offer one
                    </button>.</>
                }
              </CardContent>
            </Card>
          ) : (
            filteredUpcoming.map(ride => (
              <NetworkRideCard key={ride.id} ride={ride} networkId={networkId} />
            ))
          )}
        </div>

        {/* ── In Progress ─────────────────────────────────────────────────── */}
        {inProgress.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-blue-600">
              In Progress ({inProgress.length})
            </h4>
            {inProgress.map(ride => (
              <NetworkRideCard key={ride.id} ride={ride} networkId={networkId} />
            ))}
          </div>
        )}

        {/* ── Past rides (last 24h) ────────────────────────────────────────── */}
        {past.length > 0 && (
          <div className="space-y-3">
            <button
              className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setPastOpen(o => !o)}
            >
              {pastOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              Past Rides <span className="normal-case font-normal ml-1">({past.length})</span>
            </button>
            {pastOpen && past.map(ride => (
              <NetworkRideCard key={ride.id} ride={ride} networkId={networkId} muted />
            ))}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}

