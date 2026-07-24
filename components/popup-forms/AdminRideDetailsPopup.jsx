import { formatDate, formatTime } from "@/lib/utils"
import { resolveLocation } from "@/lib/locations"
import { Calendar, Clock, Mail, MapPin, MoveRight, Phone, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { UserAvatar } from "@/components/ui/user-avatar"

const STATUS_VARIANTS = {
  'not started': 'secondary',
  'in progress': 'default',
  'finished':    'outline',
  'canceled':    'destructive',
}

export default function AdminRideDetailsPopup({ ride, status, networkName }) {
  if (!ride) return null

  const passengers = ride.passengers || []

  return (
    <div className="space-y-5 text-sm">
      {/* Route + date */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 font-semibold text-base">
          <MapPin className="size-4 text-muted-foreground shrink-0" />
          {resolveLocation(ride.departure)}
          <MoveRight className="size-4 text-muted-foreground" />
          {resolveLocation(ride.arrival)}
        </div>
        <div className="flex flex-wrap gap-4 text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="size-3.5" />
            {formatDate(ride.departure_date)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" />
            Departs {formatTime(ride.departure_time)}
          </span>
          {ride.arrival_time && (
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              Arrives {formatTime(ride.arrival_time)}
            </span>
          )}
          {!ride.one_way && ride.return_departure_time && (
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              Return departs {formatTime(ride.return_departure_time)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_VARIANTS[status] || 'secondary'}>{status}</Badge>
          {networkName && <span className="text-muted-foreground">{networkName}</span>}
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Driver */}
      {ride.driver?.fullname ? (
        <div className="space-y-2">
          <p className="font-medium text-muted-foreground uppercase tracking-wide text-xs">Driver</p>
          <div className="flex items-center gap-3">
            <UserAvatar user={ride.driver} size="md" />
            <div>
              <p className="font-semibold">{ride.driver.fullname}</p>
              {ride.driver.email && <p className="text-muted-foreground">{ride.driver.email}</p>}
              {ride.driver.phone && <p className="text-muted-foreground">{ride.driver.phone}</p>}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground">No driver info available.</p>
      )}

      <div className="border-t border-border" />

      {/* Seats */}
      <div className="flex items-center gap-2 text-muted-foreground">
        <Users className="size-4 shrink-0" />
        <span>
          <span className="font-medium text-foreground">{ride.available_seats}</span> of{" "}
          <span className="font-medium text-foreground">{ride.total_seats}</span> seats available
        </span>
      </div>

      {/* Notes */}
      {ride.ride_description && (
        <div>
          <p className="font-medium text-muted-foreground uppercase tracking-wide text-xs mb-1">Notes</p>
          <p className="text-foreground">{ride.ride_description}</p>
        </div>
      )}

      <div className="border-t border-border" />

      {/* Passengers */}
      <div className="space-y-2">
        <p className="font-medium text-muted-foreground uppercase tracking-wide text-xs flex items-center gap-1">
          <Users className="size-3.5" /> Riders
        </p>
        {passengers.length > 0 ? (
          <ul className="space-y-2">
            {passengers.map((p, i) => (
              <li key={p.booking_id || i} className="border rounded-lg p-2 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-foreground">{p.fullname}</p>
                  <Badge variant="outline" className="text-xs">{p.status}</Badge>
                </div>
                {p.email && (
                  <p className="flex items-center gap-1 text-muted-foreground">
                    <Mail className="size-3" /> {p.email}
                  </p>
                )}
                {p.phone && (
                  <p className="flex items-center gap-1 text-muted-foreground">
                    <Phone className="size-3" /> {p.phone}
                  </p>
                )}
                <p className="text-muted-foreground">
                  Seats booked: <span className="font-medium text-foreground">{p.booked_seats || 1}</span>
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No riders booked yet.</p>
        )}
      </div>
    </div>
  )
}
