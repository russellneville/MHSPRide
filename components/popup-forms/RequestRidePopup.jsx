import { useState } from "react"
import { Label } from "../ui/label"
import TimeInput from "../ui/time-input"
import DatePicker from "../ui/date-picker"
import { usePopup } from "@/context/PopupContext"
import { useNetwork } from "@/context/NetworksContext"
import { useLocations } from "@/context/LocationsContext"
import { Button } from "../ui/button"
import { Textarea } from "../ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../ui/alert-dialog"
import { LocationPicker } from "./LocationPicker"
import { toLocalDateStr, TEXTAREA_MAX_LENGTH } from "@/lib/utils"
import { EQUIPMENT_OPTIONS, hasOpenRideRequest } from "@/lib/rideRequests"

// Deliberately simpler than OfferRidePopup — a request has no vehicle,
// network, one-way/return trip, or arrival time, since none of that is known
// until a driver claims it.
export default function RequestRidePopup({ onSaved }) {
  const { closePopup } = usePopup()
  const { requestRide, getMyRideRequests } = useNetwork()
  const { origins, destinations, getLocationCoords } = useLocations()
  const [showAlreadyOpen, setShowAlreadyOpen] = useState(false)
  // Local, not the shared NetworksContext isLoading — that flag defaults to
  // true and only flips once some other useNetwork() call resolves, so a
  // page that hasn't triggered one yet would show this button stuck on
  // "Submitting..." from first render.
  const [submitting, setSubmitting] = useState(false)

  const [departureSelect, setDepartureSelect] = useState('')
  const [departureOther, setDepartureOther] = useState('')
  const [arrivalSelect, setArrivalSelect] = useState('')
  const [arrivalOther, setArrivalOther] = useState('')
  const [departureCoords, setDepartureCoords] = useState(null)
  const [arrivalCoords, setArrivalCoords] = useState(null)
  const [date, setDate] = useState(undefined)
  const [departureTime, setDepartureTime] = useState('')
  const [seatsRequested, setSeatsRequested] = useState('')
  const [equipment, setEquipment] = useState('no_equipment')
  const [notes, setNotes] = useState('')
  const [validationError, setValidationErrors] = useState({})

  const effectiveDeparture = departureOther.trim() || departureSelect
  const effectiveArrival = arrivalOther.trim() || arrivalSelect

  const validateForm = () => {
    const newErrors = {}
    if (!effectiveDeparture) newErrors.departure = "Departure is required"
    if (!effectiveArrival) newErrors.arrival = "Arrival is required"
    if (departureOther.trim() && !departureCoords) newErrors.departure = "Please confirm this address before submitting"
    if (arrivalOther.trim() && !arrivalCoords) newErrors.arrival = "Please confirm this address before submitting"
    if (!date) newErrors.date = "Date is required"
    if (!departureTime) newErrors.departure_time = "Requested pickup time is required"
    if (!seatsRequested || Number(seatsRequested) < 1) newErrors.seats_requested = "Number of seats is required"
    setValidationErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleRequestRide = async () => {
    if (!validateForm()) return

    setSubmitting(true)
    const myRequests = await getMyRideRequests()
    if (hasOpenRideRequest(myRequests)) {
      setSubmitting(false)
      setShowAlreadyOpen(true)
      return
    }

    await requestRide({
      departure: effectiveDeparture,
      arrival: effectiveArrival,
      custom_departure: !!departureOther.trim(),
      custom_arrival: !!arrivalOther.trim(),
      departure_lat: departureCoords?.latitude ?? null,
      departure_lng: departureCoords?.longitude ?? null,
      arrival_lat: arrivalCoords?.latitude ?? null,
      arrival_lng: arrivalCoords?.longitude ?? null,
      departure_date: toLocalDateStr(date),
      departure_time: departureTime,
      seats_requested: Number(seatsRequested),
      equipment,
      notes,
    })
    setSubmitting(false)
    onSaved?.()
    closePopup()
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Departure</Label>
          <LocationPicker
            value={departureSelect}
            onSelectChange={(id) => { setDepartureSelect(id); setDepartureCoords(getLocationCoords(id)) }}
            otherValue={departureOther}
            onOtherChange={setDepartureOther}
            onValidated={setDepartureCoords}
            locations={origins}
            selectPlaceholder="Select pickup location"
          />
          {validationError.departure && <p className="text-red-500 text-sm">{validationError.departure}</p>}
        </div>

        <div className="space-y-1">
          <Label>Arrival</Label>
          <LocationPicker
            value={arrivalSelect}
            onSelectChange={(id) => { setArrivalSelect(id); setArrivalCoords(getLocationCoords(id)) }}
            otherValue={arrivalOther}
            onOtherChange={setArrivalOther}
            onValidated={setArrivalCoords}
            locations={destinations}
            selectPlaceholder="Select arrival location"
          />
          {validationError.arrival && <p className="text-red-500 text-sm">{validationError.arrival}</p>}
        </div>

        <div className="flex flex-wrap items-start gap-2">
          <div className="flex-1 min-w-[140px] space-y-1">
            <Label>Date</Label>
            <DatePicker date={date} setDate={setDate} disabled={[{ before: new Date() }]} />
            {validationError.date && <p className="text-red-500 text-sm">{validationError.date}</p>}
          </div>
          <div className="flex-1 min-w-[220px] space-y-1">
            <Label htmlFor="departure_time">Requested pickup time</Label>
            <TimeInput id="departure_time" onChange={e => setDepartureTime(e.target.value)} value={departureTime} />
            {validationError.departure_time && <p className="text-red-500 text-sm">{validationError.departure_time}</p>}
          </div>
        </div>
      </div>

      <div className="space-y-1 border-t border-border pt-4">
        <Label>Seats needed</Label>
        <Select value={seatsRequested ? String(seatsRequested) : ''} onValueChange={setSeatsRequested}>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5, 6].map(n => (
              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {validationError.seats_requested && <p className="text-red-500 text-sm">{validationError.seats_requested}</p>}
      </div>

      <div className="space-y-1">
        <Label>Equipment</Label>
        <Select value={equipment} onValueChange={setEquipment}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EQUIPMENT_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          placeholder="Anything the driver should know?"
          className="resize-none h-20"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          maxLength={TEXTAREA_MAX_LENGTH}
        />
      </div>

      <div className="flex justify-end gap-4">
        <Button onClick={closePopup} variant="outline">Cancel</Button>
        <Button onClick={handleRequestRide} disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit request'}
        </Button>
      </div>

      <AlertDialog open={showAlreadyOpen} onOpenChange={setShowAlreadyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You already have an open request</AlertDialogTitle>
            <AlertDialogDescription>
              Only one open ride request is allowed at a time. Cancel your existing request before submitting a new one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowAlreadyOpen(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
