'use client'
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, MapPin, MoveRight, Users } from "lucide-react";
import { usePopup } from "@/context/PopupContext";
import DriverDetailsPopup from "@/components/popup-forms/DriverDetailsPopup";
import { resolveLocation } from "@/lib/locations";
import { formatDate, formatTime } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";

export const STATUS_LABEL = {
  open:        'Open',
  full:        'Full',
  in_progress: 'In Progress',
  completed:   'Completed',
  canceled:    'Canceled',
};

export const STATUS_CLASS = {
  open:        'bg-green-100 text-green-800 border-green-300',
  full:        'bg-yellow-100 text-yellow-800 border-yellow-300',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-300',
  completed:   'bg-muted text-muted-foreground',
  canceled:    'bg-red-100 text-red-700 border-red-300',
};

// Card for a ride within a network list (dashboard Available Rides groups and
// the network page). Expects ride._status to be set via computeRideStatus.
export default function NetworkRideCard({ ride, networkId, muted }) {
  const { openPopup } = usePopup()

  return (
    <Link href={`/dashboard/network/${networkId}/rides/${ride.id}`}>
      <Card className={`py-0 hover:border-primary/50 transition-colors cursor-pointer ${muted ? 'opacity-60' : ''}`}>
        <CardContent className="py-2.5 flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="font-semibold flex items-center gap-2">
              <MapPin className="size-4 text-muted-foreground shrink-0" />
              {resolveLocation(ride.departure)}
              <MoveRight className="size-4 text-muted-foreground" />
              {resolveLocation(ride.arrival)}
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="size-3.5" />
              <span className="font-bold text-foreground">{formatDate(ride.departure_date)}</span>
              <span>at</span>
              <span className="font-bold text-foreground">{formatTime(ride.departure_time)}</span>
            </div>
            {ride.driver?.fullname && (
              <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                <UserAvatar user={ride.driver} size="sm" />
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
