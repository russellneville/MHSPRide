import { useState } from "react"
import { formatDate, formatTime } from "@/lib/utils"
import { useLocations } from "@/context/LocationsContext"
import { normalizeStatus, isCanceledStatus } from "@/lib/rides"
import { adminCancelBooking } from "@/lib/bookings"
import { toast } from "sonner"
import { Calendar, Clock, Mail, MapPin, MoveRight, Phone, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/ui/user-avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useAuth } from "@/context/AuthContext"

const STATUS_VARIANTS = {
  'not started': 'secondary',
  'in progress': 'default',
  'finished':    'outline',
  'canceled':    'destructive',
}

// Raw stored booking_status values, mapped to what's shown to the admin.
const BOOKING_STATUS_LABELS = {
  booked:        'Booked',
  'on progress': 'In Progress',
  finished:      'Completed',
  canceled:      'Canceled',
}

function bookingStatusLabel(status) {
  const normalized = normalizeStatus(status)
  return BOOKING_STATUS_LABELS[normalized] || normalized
}

const STATUS_LABELS = {
  'not started': 'Not Started',
  'in progress': 'In Progress',
  'finished':    'Completed',
  'canceled':    'Canceled',
}

export default function AdminRideDetailsPopup({ ride, status, networkName, bookings: initialBookings = [], onBookingChanged }) {
  const { user: currentUser } = useAuth()
  const { resolveLocation } = useLocations()
  const [bookings, setBookings] = useState(initialBookings)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [acting, setActing] = useState(false)

  if (!ride) return null

  async function handleRemove() {
    if (!removeTarget) return
    setActing(true)
    try {
      await adminCancelBooking(removeTarget.id, { actor: currentUser })
      setBookings(prev => prev.map(b => b.id === removeTarget.id ? { ...b, booking_status: 'canceled' } : b))
      // Refresh the underlying page's rides/bookings in the background so
      // seat counts and future dialog opens reflect the change too.
      onBookingChanged?.()
    } catch (err) {
      toast.error(err.message || 'Could not remove rider')
    } finally {
      setActing(false)
      setRemoveTarget(null)
    }
  }

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
          <Badge variant={STATUS_VARIANTS[status] || 'secondary'}>{STATUS_LABELS[status] || status}</Badge>
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

      {/* Riders (booking records — the canonical source of truth for status/contact info) */}
      <div className="space-y-2">
        <p className="font-medium text-muted-foreground uppercase tracking-wide text-xs flex items-center gap-1">
          <Users className="size-3.5" /> Riders
        </p>
        {bookings.length > 0 ? (
          <ul className="space-y-2">
            {bookings.map(b => (
              <li key={b.id} className="border rounded-lg p-2 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-foreground">{b.passenger?.fullname || '—'}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{bookingStatusLabel(b.booking_status)}</Badge>
                    {!isCanceledStatus(b.booking_status) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() => setRemoveTarget(b)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
                {b.passenger?.email && (
                  <p className="flex items-center gap-1 text-muted-foreground">
                    <Mail className="size-3" /> {b.passenger.email}
                  </p>
                )}
                {b.passenger?.phone && (
                  <p className="flex items-center gap-1 text-muted-foreground">
                    <Phone className="size-3" /> {b.passenger.phone}
                  </p>
                )}
                <p className="text-muted-foreground">
                  Seats booked: <span className="font-medium text-foreground">{b.booked_seats || 1}</span>
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No riders booked yet.</p>
        )}
      </div>

      <AlertDialog open={!!removeTarget} onOpenChange={open => { if (!open) setRemoveTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this rider?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the booking for {removeTarget?.passenger?.fullname || 'this passenger'} and restore the seat to the ride. A cancellation email will be sent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} disabled={acting}>
              {acting ? 'Removing…' : 'Remove Rider'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
