import { useState } from "react"
import { Label } from "../ui/label"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import CancelReasonDialog from "@/components/CancelReasonDialog"
import { usePopup } from "@/context/PopupContext"
import { useAuth } from "@/context/AuthContext"
import { useNetwork } from "@/context/NetworksContext"
import { useLocations } from "@/context/LocationsContext"
import { formatDate, formatTime } from "@/lib/utils"
import { equipmentLabel } from "@/lib/rideRequests"
import { NETWORKS } from "@/lib/networks"
import OfferRidePopup, { OfferRideTitle } from "./OfferRidePopup"

const ADMIN_ROLES = ['admin', 'super-admin']

// Click-through from a "REQUESTED RIDES" row. A rider can't fulfill their
// own request (only cancel it); any other driver sees the reverse — Offer
// Ride, not Cancel, unless they're an admin (who gets both).
export default function RideRequestDetailsPopup({ request, onChanged }) {
  const { closePopup, openPopup } = usePopup()
  const { user } = useAuth()
  const { resolveLocation } = useLocations()
  const { cancelRideRequest } = useNetwork()
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const isOwnRequest = request.requesterId === user?.uid
  const isAdmin = ADMIN_ROLES.includes(user?.role)
  const canCancel = isOwnRequest || isAdmin
  const canOffer = !isOwnRequest

  const handleCancel = async (reason) => {
    const ok = await cancelRideRequest(request.id, reason)
    if (ok) {
      onChanged?.()
      closePopup()
    }
  }

  const openOfferForNetwork = (networkId) => {
    openPopup(<OfferRideTitle />, <OfferRidePopup networkId={networkId} prefill={request} onSaved={onChanged} />)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="font-semibold">{resolveLocation(request.departure)} → {resolveLocation(request.arrival)}</div>
        <div className="text-sm text-muted-foreground">{formatDate(request.departure_date)} at {formatTime(request.departure_time)}</div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{request.seats_requested} seat{request.seats_requested !== 1 ? 's' : ''}</Badge>
        {request.equipment && request.equipment !== 'no_equipment' && (
          <Badge variant="outline">{equipmentLabel(request.equipment)}</Badge>
        )}
      </div>

      {request.notes && (
        <div className="space-y-1">
          <Label>Rider's notes</Label>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{request.notes}</p>
        </div>
      )}

      <div className="flex justify-end gap-2 flex-wrap pt-2">
        {canCancel && (
          <Button variant="outline" onClick={() => setShowCancelConfirm(true)}>Cancel request</Button>
        )}
        {canOffer && (
          <Popover>
            <PopoverTrigger asChild>
              <Button>Offer Ride</Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="end">
              {NETWORKS.map(net => (
                <button
                  key={net.id}
                  className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
                  onClick={() => openOfferForNetwork(net.id)}
                >
                  {net.name}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        )}
      </div>

      <CancelReasonDialog
        open={showCancelConfirm}
        onOpenChange={setShowCancelConfirm}
        title="Cancel this ride request?"
        description={isOwnRequest
          ? "This removes your request from the board. You can submit a new one any time."
          : "This removes the request from the board and notifies the requester by email."}
        onConfirm={reason => { setShowCancelConfirm(false); handleCancel(reason) }}
      />
    </div>
  )
}
