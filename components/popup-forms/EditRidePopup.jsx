import { useEffect, useState } from "react"
import { Label } from "../ui/label"
import TimeInput from "../ui/time-input"
import DatePicker from "../ui/date-picker"
import { usePopup } from "@/context/PopupContext"
import { useNetwork } from "@/context/NetworksContext"
import { useLocations } from "@/context/LocationsContext"
import { Button } from "../ui/button"
import { Textarea } from "../ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Checkbox } from "../ui/checkbox"
import { useEstimatedArrival } from "@/hooks/use-estimated-arrival"
import { LocationPicker } from "./LocationPicker"
import { toLocalDateStr, TEXTAREA_MAX_LENGTH } from "@/lib/utils"
import { Loader2 } from "lucide-react"

// Wrapper mounts the actual form only once locations have loaded — the form
// seeds its departure/arrival select-vs-other state from the known location
// ids on first render only (useState initializers run once), so it must not
// mount until that lookup is real.
export default function EditRidePopup({ ride, onSaved }) {
  const { origins, destinations, isLoading: locationsLoading, getLocationCoords } = useLocations()
  if (locationsLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  return <EditRidePopupForm ride={ride} onSaved={onSaved} origins={origins} destinations={destinations} getLocationCoords={getLocationCoords} />
}

function EditRidePopupForm({ ride, onSaved, origins, destinations, getLocationCoords }) {
  const { closePopup } = usePopup()
  const { isLoading, updateRide, getRides, getBookings } = useNetwork()

  // Seed departure — known ID or free-text
  const knownDepIds = new Set(origins.map(l => l.id))
  const knownArrIds = new Set(destinations.map(l => l.id))
  const initDepSelect = knownDepIds.has(ride.departure) ? ride.departure : ''
  const initDepOther  = knownDepIds.has(ride.departure) ? '' : (ride.departure || '')

  // Seed arrival — known ID or free-text
  const initArrSelect = knownArrIds.has(ride.arrival) ? ride.arrival : ''
  const initArrOther  = knownArrIds.has(ride.arrival) ? '' : (ride.arrival || '')

  const [departureSelect, setDepartureSelect] = useState(initDepSelect)
  const [departureOther,  setDepartureOther]  = useState(initDepOther)
  const [arrivalSelect,   setArrivalSelect]   = useState(initArrSelect)
  const [arrivalOther,    setArrivalOther]    = useState(initArrOther)
  // Predefined locations: trusted lookup. Free text: trust the ride's already
  // -validated stored coords (set the last time this ride was saved through
  // this validation flow) rather than forcing re-confirmation on every edit
  // that doesn't touch location — null only for free text saved before this
  // feature existed, which correctly requires one re-confirmation to migrate.
  const [departureCoords, setDepartureCoords] = useState(
    initDepSelect ? getLocationCoords(initDepSelect)
      : (initDepOther && ride.departure_lat != null && ride.departure_lng != null)
        ? { latitude: ride.departure_lat, longitude: ride.departure_lng, formattedAddress: ride.departure }
        : null
  )
  const [arrivalCoords, setArrivalCoords] = useState(
    initArrSelect ? getLocationCoords(initArrSelect)
      : (initArrOther && ride.arrival_lat != null && ride.arrival_lng != null)
        ? { latitude: ride.arrival_lat, longitude: ride.arrival_lng, formattedAddress: ride.arrival }
        : null
  )
  const [date, setDate] = useState(ride.departure_date ? new Date(ride.departure_date + 'T12:00:00') : undefined)
  const [oneWay, setOneWay] = useState(ride.one_way || false)
  const [rideData, setRideData] = useState({
    departure_time:        ride.departure_time || '',
    arrival_time:          ride.arrival_time || '',
    return_departure_time: ride.return_departure_time || '',
    ride_description:      ride.ride_description || '',
    total_seats:           ride.total_seats ? String(ride.total_seats) : '',
  })
  const [validationError, setValidationErrors] = useState({})
  const [takenDates, setTakenDates] = useState([])

  // Days with another offered or booked ride get disabled in the date picker
  useEffect(() => {
    Promise.all([getRides(), getBookings()]).then(([rides, bookings]) => {
      const rideDates = (rides || [])
        .filter(r => r.id !== ride.id && r.ride_status !== 'canceled' && r.ride_status !== 'cancled')
        .map(r => r.departure_date)
      const bookingDates = (bookings || [])
        .filter(b => b.booking_status !== 'canceled' && b.booking_status !== 'cancled')
        .map(b => b.departure_date)
      setTakenDates([...new Set([...rideDates, ...bookingDates].filter(Boolean))])
    })
  }, [])

  const effectiveDeparture = departureOther.trim() || departureSelect
  const effectiveArrival   = arrivalOther.trim()   || arrivalSelect

  // Recompute arrival time whenever departure time, origin, or destination changes —
  // mirrors OfferRidePopup's effect so switching pickup/dropoff after a time is
  // already set keeps the estimate in sync. Predefined-to-predefined pairs use the
  // free precomputed lookup; a free-text side falls to a live Directions estimate
  // once its address is confirmed (departureCoords/arrivalCoords).
  const { arrivalTime: estimatedArrival, estimating: estimatingArrival } = useEstimatedArrival(
    rideData.departure_time,
    { locationId: departureSelect || null, coords: departureCoords ? { lat: departureCoords.latitude, lng: departureCoords.longitude } : null },
    { locationId: arrivalSelect || null, coords: arrivalCoords ? { lat: arrivalCoords.latitude, lng: arrivalCoords.longitude } : null }
  )
  useEffect(() => {
    if (!estimatedArrival) return
    setRideData(prev => (prev.arrival_time === estimatedArrival ? prev : { ...prev, arrival_time: estimatedArrival }))
  }, [estimatedArrival])

  const handleChange = (e) => {
    setRideData(prev => ({ ...prev, [e.target.id]: e.target.value }))
  }

  const validateForm = () => {
    const newErrors = {}
    if (!effectiveDeparture) newErrors.departure = "Departure is required"
    if (!effectiveArrival)   newErrors.arrival   = "Arrival is required"
    if (departureOther.trim() && !departureCoords) newErrors.departure = "Please confirm this address before submitting"
    if (arrivalOther.trim() && !arrivalCoords) newErrors.arrival = "Please confirm this address before submitting"
    if (!date)               newErrors.date      = "Date is required"
    if (!rideData.departure_time) newErrors.departure_time = "Departure time is required"
    if (!oneWay && !rideData.return_departure_time) newErrors.return_departure_time = "Return time is required — or mark the trip one way"
    if (!rideData.total_seats || Number(rideData.total_seats) < 1) newErrors.total_seats = "Number of seats is required"
    setValidationErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return
    const dateStr = toLocalDateStr(date)
    await updateRide(ride.id, {
      departure:             effectiveDeparture,
      arrival:               effectiveArrival,
      // Explicit flags for the "Off the Beaten Path" badge (resources/badging.md) —
      // matches OfferRidePopup/RequestRidePopup/EditRideRequestPopup, which already set these.
      custom_departure:      !!departureOther.trim(),
      custom_arrival:        !!arrivalOther.trim(),
      departure_lat:         departureCoords?.latitude ?? null,
      departure_lng:         departureCoords?.longitude ?? null,
      arrival_lat:           arrivalCoords?.latitude ?? null,
      arrival_lng:           arrivalCoords?.longitude ?? null,
      departure_date:        dateStr,
      arrival_date:          dateStr,
      departure_time:        rideData.departure_time,
      arrival_time:          rideData.arrival_time,
      one_way:               oneWay,
      return_departure_time: oneWay ? '' : rideData.return_departure_time,
      ride_description:      rideData.ride_description,
      total_seats:           Number(rideData.total_seats),
    })
    onSaved?.()
    closePopup()
  }

  return (
    <div className="space-y-5">

      {/* ── To Destination ─────────────────────────────── */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">To Destination</h4>

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
            <DatePicker
              date={date}
              setDate={setDate}
              disabled={[{ before: new Date() }, ...takenDates.map(d => new Date(d + 'T12:00:00'))]}
            />
            {takenDates.length > 0 && (
              <p className="text-xs text-muted-foreground">Days you already offer or have booked a ride are unavailable.</p>
            )}
            {validationError.date && <p className="text-red-500 text-sm">{validationError.date}</p>}
          </div>
          <div className="flex-1 min-w-[220px] space-y-1">
            <Label htmlFor="departure_time">Departure time</Label>
            <TimeInput id="departure_time" onChange={handleChange} value={rideData.departure_time} />
            {validationError.departure_time && <p className="text-red-500 text-sm">{validationError.departure_time}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="arrival_time">Arrival time</Label>
          <TimeInput id="arrival_time" onChange={handleChange} value={rideData.arrival_time} />
          {estimatingArrival && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" /> Estimating arrival time…
            </p>
          )}
        </div>
      </div>

      {/* ── Return from Destination ────────────────────── */}
      <div className="space-y-3 border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Return from Destination</h4>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <Checkbox checked={oneWay} onCheckedChange={setOneWay} />
            One way trip
          </label>
        </div>
        {!oneWay && (
          <div className="space-y-1">
            <Label htmlFor="return_departure_time">Return departure time</Label>
            <TimeInput id="return_departure_time" onChange={handleChange} value={rideData.return_departure_time} />
            {validationError.return_departure_time && <p className="text-red-500 text-sm">{validationError.return_departure_time}</p>}
          </div>
        )}
      </div>

      {/* ── Riders + Notes ─────────────────────────────── */}
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Seats available</Label>
          <Select
            value={rideData.total_seats ? String(rideData.total_seats) : ''}
            onValueChange={(v) => setRideData(prev => ({ ...prev, total_seats: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {validationError.total_seats && <p className="text-red-500 text-sm">{validationError.total_seats}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="ride_description">Ride notes</Label>
          <Textarea
            placeholder="Add any notes for riders"
            id="ride_description"
            className="resize-none h-20"
            onChange={handleChange}
            value={rideData.ride_description}
            maxLength={TEXTAREA_MAX_LENGTH}
          />
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <Button onClick={closePopup} variant="outline">Cancel</Button>
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? 'Saving…' : 'Save changes'}
        </Button>
      </div>

    </div>
  )
}
