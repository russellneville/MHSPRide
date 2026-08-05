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
import { LocationPicker } from "./LocationPicker"
import { toLocalDateStr, TEXTAREA_MAX_LENGTH } from "@/lib/utils"
import { EQUIPMENT_OPTIONS } from "@/lib/rideRequests"

// Admin-only edit of an open ride request (Admin Rides page). Same field set
// as RequestRidePopup, prefilled from the existing request, with no
// one-open-request cap check — it's editing the same request, not adding one.
export default function EditRideRequestPopup({ request, onSaved }) {
  const { closePopup } = usePopup()
  const { updateRideRequest } = useNetwork()
  const { origins, destinations, getLocationCoords } = useLocations()
  // Local, not the shared NetworksContext isLoading (that flag defaults to
  // true and only flips once some other useNetwork() call resolves — on
  // pages like this admin page that never call one on mount, it would stay
  // true forever and make this button permanently show "Saving...").
  const [saving, setSaving] = useState(false)

  const knownDepIds = new Set(origins.map(o => o.id))
  const knownArrIds = new Set(destinations.map(d => d.id))

  const [departureSelect, setDepartureSelect] = useState(knownDepIds.has(request.departure) ? request.departure : '')
  const [departureOther, setDepartureOther] = useState(knownDepIds.has(request.departure) ? '' : (request.departure || ''))
  const [arrivalSelect, setArrivalSelect] = useState(knownArrIds.has(request.arrival) ? request.arrival : '')
  const [arrivalOther, setArrivalOther] = useState(knownArrIds.has(request.arrival) ? '' : (request.arrival || ''))
  const [departureCoords, setDepartureCoords] = useState(knownDepIds.has(request.departure) ? getLocationCoords(request.departure) : null)
  const [arrivalCoords, setArrivalCoords] = useState(knownArrIds.has(request.arrival) ? getLocationCoords(request.arrival) : null)
  const [date, setDate] = useState(request.departure_date ? new Date(request.departure_date + 'T12:00:00') : undefined)
  const [departureTime, setDepartureTime] = useState(request.departure_time || '')
  const [seatsRequested, setSeatsRequested] = useState(request.seats_requested ? String(request.seats_requested) : '')
  const [equipment, setEquipment] = useState(request.equipment || 'no_equipment')
  const [notes, setNotes] = useState(request.notes || '')
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

  const handleSave = async () => {
    if (!validateForm()) return

    setSaving(true)
    const ok = await updateRideRequest(request.id, {
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
    setSaving(false)
    if (ok) {
      onSaved?.()
      closePopup()
    }
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
          className="resize-none h-20"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          maxLength={TEXTAREA_MAX_LENGTH}
        />
      </div>

      <div className="flex justify-end gap-4">
        <Button onClick={closePopup} variant="outline">Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save changes'}
        </Button>
      </div>
    </div>
  )
}
