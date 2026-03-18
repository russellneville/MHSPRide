'use client'
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "../../dashboardLayout";
import { useNetwork } from "@/context/NetworksContext";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, Clock, MapPin, MoveRight, Plus, Trash, Users, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePopup } from "@/context/PopupContext";
import OfferRidePopup from "@/components/popup-forms/OfferRidePopup";
import DriverDetailsPopup from "@/components/popup-forms/DriverDetailsPopup";
import Link from "next/link";
import { LOCATIONS, ARRIVAL_LOCATIONS, getLocationName } from "@/lib/locations";
import { formatTime } from "@/lib/utils";
import { Input } from "@/components/ui/input";

// ── Location resolution ───────────────────────────────────────────────────────
function resolveLocation(id) {
  if (!id) return id;
  return getLocationName(id)
    || ARRIVAL_LOCATIONS.find(l => l.id === id)?.name
    || id;
}

const DEPARTURE_LOCATIONS = LOCATIONS.filter(l => l.id !== 'timberline-lodge');

// ── Status computation (no Firestore writes needed) ───────────────────────────
function computeRideStatus(ride) {
  if (ride.ride_status === 'canceled' || ride.ride_status === 'canceled') return 'canceled';

  const now = new Date();
  const departure = new Date(`${ride.departure_date}T${ride.departure_time || '00:00'}`);
  const arrival = ride.arrival_time
    ? new Date(`${ride.departure_date}T${ride.arrival_time}`)
    : new Date(departure.getTime() + 4 * 60 * 60 * 1000); // 4-hour fallback

  if (now < departure) return ride.available_seats > 0 ? 'open' : 'full';
  if (now <= arrival)  return 'in_progress';
  return 'completed';
}

const STATUS_LABEL = {
  open:        'Open',
  full:        'Full',
  in_progress: 'In Progress',
  completed:   'Completed',
  canceled:    'Canceled',
};

const STATUS_CLASS = {
  open:        'bg-green-100 text-green-800 border-green-300',
  full:        'bg-yellow-100 text-yellow-800 border-yellow-300',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-300',
  completed:   'bg-muted text-muted-foreground',
  canceled:    'bg-red-100 text-red-700 border-red-300',
};

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NetworkPage() {
  const { networkId } = useParams();
  const router = useRouter();
  const { getNetwork, deleteNetwork, getRidesByNetworkId } = useNetwork();
  const { user } = useAuth();
  const { openPopup } = usePopup();

  const [networkData, setNetworkData] = useState(null);
  const [rides, setRides] = useState([]);
  const [pastOpen, setPastOpen] = useState(false);

  // Filters
  const [filterDate, setFilterDate] = useState('');
  const [filterPickup, setFilterPickup] = useState('');
  const [filterArrival, setFilterArrival] = useState('');
  const hasFilters = filterDate || filterPickup || filterArrival;

  useEffect(() => {
    if (!user || !networkId) return;
    Promise.all([
      getNetwork(networkId),
      getRidesByNetworkId(networkId),
    ]).then(([net, rideList]) => {
      setNetworkData(net);
      setRides(rideList || []);
    });
  }, [user, networkId]);

  const handleDeleteNetwork = async () => {
    if (confirm('Are you sure you want to delete this network?')) {
      await deleteNetwork(networkId);
      router.push('/dashboard/networks');
    }
  };

  if (!networkData) return <DashboardLayout><p className="p-6 text-muted-foreground">Loading…</p></DashboardLayout>;

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
    return true;
  });

  // Collect distinct pickup/arrival values present in upcoming rides for filter dropdowns
  const pickupOptions = [...new Set(sortedUpcoming.map(r => r.departure).filter(Boolean))];
  const arrivalOptions = [...new Set(sortedUpcoming.map(r => r.arrival).filter(Boolean))];

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-xl font-semibold">{networkData.name}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" asChild>
              <Link href={`/dashboard/network/${networkId}/members`}>
                <Users className="size-4 mr-1" /> Members
              </Link>
            </Button>
            <Button onClick={() => openPopup('Offer ride', <OfferRidePopup networkId={networkId} />)}>
              Offer Ride <Plus className="size-4 ml-1" />
            </Button>
            {user?.role === 'director' && (
              <Button variant="destructive" size="icon" onClick={handleDeleteNetwork}>
                <Trash className="size-4" />
              </Button>
            )}
          </div>
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
              <Input
                type="date"
                className="w-40 h-9 text-sm"
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
              />
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
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={() => { setFilterDate(''); setFilterPickup(''); setFilterArrival(''); }}>
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
                    <button className="text-primary underline" onClick={() => openPopup('Offer ride', <OfferRidePopup networkId={networkId} />)}>
                      offer one
                    </button>.</>
                }
              </CardContent>
            </Card>
          ) : (
            filteredUpcoming.map(ride => (
              <RideCard key={ride.id} ride={ride} networkId={networkId} />
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
              <RideCard key={ride.id} ride={ride} networkId={networkId} />
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
              <RideCard key={ride.id} ride={ride} networkId={networkId} muted />
            ))}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}


// ── Ride card ─────────────────────────────────────────────────────────────────
function RideCard({ ride, networkId, muted }) {
  const { openPopup } = usePopup()

  return (
    <Link href={`/dashboard/network/${networkId}/rides/${ride.id}`}>
      <Card className={`hover:border-primary/50 transition-colors cursor-pointer ${muted ? 'opacity-60' : ''}`}>
        <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="font-semibold flex items-center gap-2">
              <MapPin className="size-4 text-muted-foreground shrink-0" />
              {resolveLocation(ride.departure)}
              <MoveRight className="size-4 text-muted-foreground" />
              {resolveLocation(ride.arrival)}
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="size-3.5" />
              <span className="font-bold text-foreground">{ride.departure_date}</span>
              <span>at</span>
              <span className="font-bold text-foreground">{formatTime(ride.departure_time)}</span>
            </div>
            {ride.driver?.fullname && (
              <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                Driver: <span className="text-foreground font-medium">{ride.driver.fullname}</span>
                <button
                  className="text-xs text-primary underline underline-offset-2 hover:text-primary/70 transition-colors"
                  onClick={e => { e.preventDefault(); openPopup(`${ride.driver.fullname}'s car`, <DriverDetailsPopup driver={ride.driver} />) }}
                >
                  car details
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {(ride._status === 'open' || ride._status === 'full') && (
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Users className="size-4" />
                {ride.available_seats} seat{ride.available_seats !== 1 ? 's' : ''} left
              </div>
            )}
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_CLASS[ride._status]}`}>
              {STATUS_LABEL[ride._status]}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
