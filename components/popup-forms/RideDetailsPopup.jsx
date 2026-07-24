import { useState } from "react"
import { formatDate, formatTime } from "@/lib/utils"
import { resolveLocation } from "@/lib/locations"
import { canCancelBooking, isCanceledStatus } from "@/lib/rides"
import { Calendar, Car, Clock, MapPin, MoveRight, Users, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/ui/user-avatar"
import { useNetwork } from "@/context/NetworksContext"
import { usePopup } from "@/context/PopupContext"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function RideDetailsPopup({ booking, onCanceled }) {
  const { cancelBooking, isLoading } = useNetwork()
  const { closePopup } = usePopup()
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  if (!booking) return null

  const driver = booking.driver || {}
  const vehicle = [driver.vehicle_year, driver.vehicle_color, driver.vehicle_make, driver.vehicle_model]
    .filter(Boolean).join(' ')

  const statusColor = {
    booked:   'bg-blue-100 text-blue-800 border-blue-300',
    canceled: 'bg-gray-100 text-gray-600 border-gray-300',
  }[booking.booking_status] || 'bg-muted text-muted-foreground'

  const handleCancelBooking = async () => {
    const ok = await cancelBooking(booking.id)
    if (ok) {
      onCanceled?.()
      closePopup()
    }
  }

  return (
    <div className="space-y-5 text-sm">

      {/* Route + date */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 font-semibold text-base">
          <MapPin className="size-4 text-muted-foreground shrink-0" />
          {resolveLocation(booking.departure)}
          <MoveRight className="size-4 text-muted-foreground" />
          {resolveLocation(booking.arrival)}
        </div>
        <div className="flex flex-wrap gap-4 text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="size-3.5" />
            {formatDate(booking.departure_date)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" />
            Departs {formatTime(booking.departure_time)}
          </span>
          {booking.arrival_time && (
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              Arrives {formatTime(booking.arrival_time)}
            </span>
          )}
          {booking.return_departure_time && (
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              Return departs {formatTime(booking.return_departure_time)}
            </span>
          )}
        </div>
        <div>
          <Badge className={`text-xs border ${statusColor}`}>
            {booking.booking_status || '—'}
          </Badge>
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Driver */}
      {driver.fullname ? (
        <div className="space-y-2">
          <p className="font-medium text-muted-foreground uppercase tracking-wide text-xs">Driver</p>
          <div className="flex items-center gap-3">
            <UserAvatar user={driver} size="md" />
            <div>
              <p className="font-semibold">{driver.fullname}</p>
              {driver.phone && <p className="text-muted-foreground">{driver.phone}</p>}
            </div>
          </div>
          {vehicle && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Car className="size-4 shrink-0" />
              <span>{vehicle}</span>
              {driver.vehicle_plate && <span>· {driver.vehicle_plate}</span>}
            </div>
          )}
          {driver.vehicle_seats && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="size-4 shrink-0" />
              <span>{driver.vehicle_seats} passenger seats</span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground">No driver info available.</p>
      )}

      {/* Seats booked */}
      {booking.booked_seats && (
        <>
          <div className="border-t border-border" />
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="size-4 shrink-0" />
            <span>You booked <span className="font-medium text-foreground">{booking.booked_seats}</span> seat{booking.booked_seats !== 1 ? 's' : ''}</span>
          </div>
        </>
      )}

      {/* Notes */}
      {booking.ride_description && (
        <>
          <div className="border-t border-border" />
          <div>
            <p className="font-medium text-muted-foreground uppercase tracking-wide text-xs mb-1">Notes</p>
            <p className="text-foreground">{booking.ride_description}</p>
          </div>
        </>
      )}

      {/* Cancel booking */}
      {!isCanceledStatus(booking.booking_status) && (
        <>
          <div className="border-t border-border" />
          {canCancelBooking(booking) ? (
            <Button
              variant="cancel"
              className="w-full"
              disabled={isLoading}
              onClick={() => setShowCancelConfirm(true)}
            >
              Cancel Booking <X className="size-4 ml-1" />
            </Button>
          ) : (
            <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 text-sm">
              Too close to departure to cancel online. Contact your driver directly
              {driver.phone ? ` at ${driver.phone}` : ""}
              {driver.email ? ` (${driver.email})` : ""}.
            </div>
          )}
        </>
      )}

      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel your booking?</AlertDialogTitle>
            <AlertDialogDescription>
              This frees your seat on this ride and notifies the driver by email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep booking</AlertDialogCancel>
            <AlertDialogAction
              variant="cancel"
              onClick={() => { setShowCancelConfirm(false); handleCancelBooking() }}
            >
              Cancel booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
