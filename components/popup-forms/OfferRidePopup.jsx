import { useEffect, useState } from "react"
import { Label } from "../ui/label"
import { Input } from "../ui/input"
import TimeInput from "../ui/time-input"
import DatePicker from "../ui/date-picker"
import { usePopup } from "@/context/PopupContext"
import { useNetwork } from "@/context/NetworksContext"
import { useAuth } from "@/context/AuthContext"
import { useSkin } from "@/context/SkinContext"
import { useLocations } from "@/context/LocationsContext"
import { Button } from "../ui/button"
import { Textarea } from "../ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Checkbox } from "../ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../ui/alert-dialog"
import { useEstimatedArrival } from "@/hooks/use-estimated-arrival"
import { LocationPicker } from "./LocationPicker"
import { formatDate, toLocalDateStr, TEXTAREA_MAX_LENGTH, LOCATION_NAME_MAX_LENGTH } from "@/lib/utils"
import { hasActiveSameDayBooking, hasActiveSameDayRide } from "@/lib/rides"
import { diffPrefilledFields, requiredStorageFor, equipmentLabel } from "@/lib/rideRequests"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { db, auth } from "@/lib/firebaseClient"
import { getVehicles, getDefaultVehicle, vehicleShortLabel, STORAGE_OPTIONS } from "@/lib/vehicles"
import { Info, Loader2 } from "lucide-react"

const NOTES_REQUIRED_MESSAGE = "Please tell the requesting rider about the ride change details."

// Rendered as the popup's title (see openPopup() call sites) instead of a
// plain string, so the vehicle picker can live in the dialog header. Shares
// selectedVehicleId with OfferRidePopup below via the popup's generic
// popupState — they're sibling element trees, not parent/child, so a plain
// prop can't pass between them.
export function OfferRideTitle() {
  const { user } = useAuth()
  const { popupState, setPopupState } = usePopup()
  const vehicles = getVehicles(user)

  if (vehicles.length === 0) return "Offer ride"

  if (vehicles.length === 1) {
    const label = vehicleShortLabel(vehicles[0])
    return label ? `Offer ride in ${label}` : "Offer ride"
  }

  const selectedVehicleId = popupState?.selectedVehicleId || getDefaultVehicle(vehicles)?.id || ''

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      Offer ride in:
      <Select
        value={selectedVehicleId}
        onValueChange={(id) => setPopupState(prev => ({ ...prev, selectedVehicleId: id }))}
      >
        <SelectTrigger className="h-auto gap-1 border-none bg-transparent p-0 shadow-none font-semibold text-lg hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:bg-transparent [&_svg]:opacity-70">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {vehicles.map((v, i) => (
            <SelectItem key={v.id} value={v.id}>{vehicleShortLabel(v) || `Vehicle ${i + 1}`}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </span>
  )
}

function SuggestLocationPopover({ context }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!text.trim()) return
    setSubmitting(true)
    try {
      await addDoc(collection(db, 'feedback'), {
        type: 'location-suggestion',
        context,
        message: text.trim(),
        userId: auth.currentUser?.uid || null,
        submittedAt: serverTimestamp(),
      })
      setDone(true)
      setText('')
      setTimeout(() => { setDone(false); setOpen(false) }, 1800)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors">
          suggest new
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-2" side="bottom" align="start">
        {done ? (
          <p className="text-sm text-green-700 dark:text-green-400 font-medium">Thanks! We'll review your suggestion.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">Suggest a new {context.toLowerCase()} location</p>
            <Input
              placeholder="Location name…"
              value={text}
              onChange={e => setText(e.target.value)}
              className="h-8 text-sm"
              maxLength={LOCATION_NAME_MAX_LENGTH}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" className="h-7 text-xs" disabled={!text.trim() || submitting} onClick={handleSubmit}>
                {submitting ? 'Sending…' : 'Send'}
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}

// Wrapper mounts the actual form only once locations have loaded — when
// prefill is present, the form seeds its departure/arrival select-vs-other
// state from the known location ids on first render only (useState
// initializers run once), so it must not mount until that lookup is real.
// Mirrors EditRidePopup's loading gate.
export default function OfferRidePopup({ networkId, onSaved, prefill }) {
  const { origins, destinations, isLoading: locationsLoading, getLocationCoords } = useLocations()
  if (locationsLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  return (
    <OfferRidePopupForm
      networkId={networkId}
      onSaved={onSaved}
      prefill={prefill}
      origins={origins}
      destinations={destinations}
      getLocationCoords={getLocationCoords}
    />
  )
}

function OfferRidePopupForm({ networkId, onSaved, prefill, origins, destinations, getLocationCoords }) {
  const { closePopup, popupState, setPopupState } = usePopup()
  const { isLoading, offerRide, fulfillRideRequest, getRides, getBookings } = useNetwork()
  const { user } = useAuth()
  const { skin } = useSkin()
  const isTroopiter = skin === 'troopiter'
  // Troopiter has no network to pick — the shift/event name Troopiter dispatched
  // this driver under is the organizing concept instead (issue #199). Prefilled
  // from the name captured at launch, but editable in case the driver is
  // offering ahead for a different shift than the one they just arrived from.
  const [shiftName, setShiftName] = useState(prefill?.shift_name || user?.currentShiftName || '')
  const [showDayConflict, setShowDayConflict] = useState(false)
  const [showEquipmentWarning, setShowEquipmentWarning] = useState(false)
  const [pendingSubmit, setPendingSubmit] = useState(null)

  const knownDepIds = new Set(origins.map(o => o.id))
  const knownArrIds = new Set(destinations.map(d => d.id))
  const initDepSelect = prefill && knownDepIds.has(prefill.departure) ? prefill.departure : ''
  const initDepOther  = prefill && !knownDepIds.has(prefill.departure) ? (prefill.departure || '') : ''
  const initArrSelect = prefill && knownArrIds.has(prefill.arrival) ? prefill.arrival : ''
  const initArrOther  = prefill && !knownArrIds.has(prefill.arrival) ? (prefill.arrival || '') : ''

  const [departureSelect, setDepartureSelect] = useState(initDepSelect)
  const [departureOther, setDepartureOther] = useState(initDepOther)
  const [arrivalSelect, setArrivalSelect] = useState(initArrSelect)
  const [arrivalOther, setArrivalOther] = useState(initArrOther)
  // Coords backing departure_lat/lng + arrival_lat/lng on submit — set either
  // from a predefined location's trusted lat/lon (see handleDepartureSelect
  // below) or from LocationPicker's onValidated callback once free text is
  // confirmed. null blocks submit for free text; predefined locations submit
  // regardless (see validateForm). A free-text prefill (fulfilling a request
  // that was already validated when submitted) trusts its stored coords
  // rather than forcing re-confirmation — mirrors EditRidePopup.
  const [departureCoords, setDepartureCoords] = useState(
    initDepSelect ? getLocationCoords(initDepSelect)
      : (initDepOther && prefill?.departure_lat != null && prefill?.departure_lng != null)
        ? { latitude: prefill.departure_lat, longitude: prefill.departure_lng, formattedAddress: prefill.departure }
        : null
  )
  const [arrivalCoords, setArrivalCoords] = useState(
    initArrSelect ? getLocationCoords(initArrSelect)
      : (initArrOther && prefill?.arrival_lat != null && prefill?.arrival_lng != null)
        ? { latitude: prefill.arrival_lat, longitude: prefill.arrival_lng, formattedAddress: prefill.arrival }
        : null
  )
  const [date, setDate] = useState(prefill?.departure_date ? new Date(prefill.departure_date + 'T12:00:00') : undefined)
  const [oneWay, setOneWay] = useState(false)
  const [takenDates, setTakenDates] = useState([])
  const vehicles = getVehicles(user)
  // Selected in the title bar (see OfferRideTitle above) via shared popupState;
  // falls back to the default vehicle until the driver picks a different one.
  const selectedVehicleId = popupState?.selectedVehicleId || getDefaultVehicle(vehicles)?.id || ''
  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId) || null
  const [rideData, setRideData] = useState({
    departure_time: prefill?.departure_time || '',
    arrival_time: '',
    return_departure_time: '16:00',
    ride_description: '',
    total_seats: '',
  })
  const [validationError, setValidationErrors] = useState({})

  // Seats follows the selected vehicle — fires once the default resolves after
  // the user loads, and again any time the title-bar dropdown picks a
  // different vehicle. Doesn't fire on unrelated re-renders, so a manual
  // edit to "Seats available" isn't clobbered unless the vehicle itself changes.
  useEffect(() => {
    if (selectedVehicle?.seats) {
      setRideData(prev => ({ ...prev, total_seats: String(selectedVehicle.seats) }))
    }
  }, [selectedVehicleId])

  // Pre-select the arrival location that's flagged as the default for this network
  // (e.g. Timberline for Mountain Biking, Tea Cup for Nordic Patrol) — only while the
  // field is still untouched, so it never overrides a choice the user already made.
  // Skipped when fulfilling a request — the request's own arrival already won.
  useEffect(() => {
    if (prefill) return
    if (arrivalSelect || arrivalOther) return
    const defaultDest = destinations.find(d => d.defaultForNetworkId === networkId)
    if (defaultDest) {
      setArrivalSelect(defaultDest.id)
      setArrivalCoords(getLocationCoords(defaultDest.id))
    }
  }, [networkId, destinations])

  // Days the user already offers or has booked a ride get disabled in the date picker
  useEffect(() => {
    Promise.all([getRides(), getBookings()]).then(([rides, bookings]) => {
      const rideDates = (rides || [])
        .filter(r => r.ride_status !== 'canceled' && r.ride_status !== 'cancled')
        .map(r => r.departure_date)
      const bookingDates = (bookings || [])
        .filter(b => b.booking_status !== 'canceled' && b.booking_status !== 'cancled')
        .map(b => b.departure_date)
      setTakenDates([...new Set([...rideDates, ...bookingDates].filter(Boolean))])
    })
  }, [])

  const effectiveDeparture = departureOther.trim() || departureSelect

  const effectiveArrival = arrivalOther.trim() || arrivalSelect

  // Recompute arrival time whenever departure time, origin, or destination changes —
  // not just on the departure_time field's own onChange — so switching pickup/dropoff
  // after a time is already set keeps the estimate in sync. Predefined-to-predefined
  // pairs use the free precomputed lookup; a free-text side falls to a live
  // Directions estimate once its address is confirmed (departureCoords/arrivalCoords).
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

  // Recomputed on every render from the current form values — cheap pure
  // function, no need to memoize. Drives both the Notes-required tooltip
  // and the submit-time validation; the server (app/api/ride-requests/fulfill)
  // recomputes the same diff independently rather than trusting this.
  const currentDiffs = prefill ? diffPrefilledFields(prefill, {
    departure: effectiveDeparture,
    arrival: effectiveArrival,
    departure_date: date ? toLocalDateStr(date) : '',
    departure_time: rideData.departure_time,
  }) : []
  const notesRequired = currentDiffs.length > 0

  const seatsShortfall = prefill && rideData.total_seats && Number(rideData.total_seats) < prefill.seats_requested

  const validateForm = () => {
    const newErrors = {}
    if (!effectiveDeparture) newErrors.departure = "Departure is required"
    if (!effectiveArrival) newErrors.arrival = "Arrival is required"
    // Predefined locations are already trusted (see LocationsContext.getLocationCoords)
    // and skip this gate entirely — only free text must be confirmed before submit.
    if (departureOther.trim() && !departureCoords) newErrors.departure = "Please confirm this address before submitting"
    if (arrivalOther.trim() && !arrivalCoords) newErrors.arrival = "Please confirm this address before submitting"
    if (!date) newErrors.date = "Date is required"
    if (!rideData.departure_time) newErrors.departure_time = "Departure time is required"
    if (!oneWay && !rideData.return_departure_time) newErrors.return_departure_time = "Return time is required — or mark the trip one way"
    if (!rideData.total_seats || Number(rideData.total_seats) < 1) newErrors.total_seats = "Number of seats is required"
    if (isTroopiter && !shiftName.trim()) newErrors.shift_name = "Shift / event name is required"
    if (notesRequired && !rideData.ride_description.trim()) newErrors.ride_description = NOTES_REQUIRED_MESSAGE
    setValidationErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const buildSubmittedRideData = (dateStr) => ({
    departure: effectiveDeparture,
    arrival: effectiveArrival,
    // Explicit flags for the "Off the Beaten Path" badge (resources/badging.md) —
    // effectiveDeparture/Arrival merge the predefined-location select and the
    // free-text "Other" input into one string, so downstream code can't tell
    // which source it came from without these.
    custom_departure: !!departureOther.trim(),
    custom_arrival: !!arrivalOther.trim(),
    departure_lat: departureCoords?.latitude ?? null,
    departure_lng: departureCoords?.longitude ?? null,
    arrival_lat: arrivalCoords?.latitude ?? null,
    arrival_lng: arrivalCoords?.longitude ?? null,
    departure_date: dateStr,
    arrival_date: dateStr,
    departure_time: rideData.departure_time,
    arrival_time: rideData.arrival_time,
    one_way: oneWay,
    return_departure_time: oneWay ? '' : rideData.return_departure_time,
    ride_description: rideData.ride_description,
    total_seats: Number(rideData.total_seats),
    ...(isTroopiter && { shift_name: shiftName.trim() }),
  })

  const doFulfill = async (submittedRideData) => {
    const result = await fulfillRideRequest(prefill.id, networkId, selectedVehicle, submittedRideData)
    if (result.ok) {
      onSaved?.()
      closePopup()
    }
  }

  const handleOfferRide = async () => {
    if (!validateForm()) return
    const dateStr = toLocalDateStr(date)
    const [existingRides, existingBookings] = await Promise.all([getRides(), getBookings()])
    const conflict = hasActiveSameDayRide(existingRides, dateStr) || hasActiveSameDayBooking(existingBookings, dateStr)
    if (conflict) {
      setShowDayConflict(true)
      return
    }

    const submittedRideData = buildSubmittedRideData(dateStr)

    if (!prefill) {
      await offerRide({ ...submittedRideData, vehicle: selectedVehicle }, networkId)
      onSaved?.()
      closePopup()
      return
    }

    const requiredStorage = requiredStorageFor(prefill.equipment)
    const hasMatch = !requiredStorage || (selectedVehicle?.storage || []).includes(requiredStorage)
    if (!hasMatch) {
      setPendingSubmit(submittedRideData)
      setShowEquipmentWarning(true)
      return
    }

    await doFulfill(submittedRideData)
  }

  const requiredStorageValue = prefill ? requiredStorageFor(prefill.equipment) : null
  const requiredStorageLabel = STORAGE_OPTIONS.find(o => o.value === requiredStorageValue)?.label

  return (
    <div className="space-y-5">

      {/* ── Shift / event (troopiter tenants only) ───────── */}
      {isTroopiter && (
        <div className="space-y-1">
          <Label htmlFor="shift_name">Shift / event</Label>
          <Input
            id="shift_name"
            placeholder="e.g. Timberline - Mountain Host"
            value={shiftName}
            onChange={e => setShiftName(e.target.value)}
          />
          {validationError.shift_name && <p className="text-red-500 text-sm">{validationError.shift_name}</p>}
        </div>
      )}

      {/* ── To Destination ─────────────────────────────── */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">To Destination</h4>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label>Departure</Label>
            <SuggestLocationPopover context="Departure" />
          </div>
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
          <div className="flex items-center justify-between">
            <Label>Arrival</Label>
            <SuggestLocationPopover context="Arrival" />
          </div>
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
            <Checkbox
              checked={oneWay}
              onCheckedChange={setOneWay}
            />
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

      {/* ── Seats available ────────────────────────────── */}
      <div className="space-y-1 border-t border-border pt-4">
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
        {seatsShortfall && (
          <p className="text-amber-600 dark:text-amber-400 text-sm">
            The requesting rider asked for {prefill.seats_requested} seat{prefill.seats_requested !== 1 ? 's' : ''} — you're offering fewer.
          </p>
        )}
      </div>

      {/* ── Notes ──────────────────────────────────────── */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="ride_description">Ride notes{notesRequired && ' *'}</Label>
          {notesRequired && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="size-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>{NOTES_REQUIRED_MESSAGE}</TooltipContent>
            </Tooltip>
          )}
        </div>
        <Textarea
          placeholder="Add any notes for riders"
          id="ride_description"
          className="resize-none h-20"
          onChange={handleChange}
          value={rideData.ride_description}
          maxLength={TEXTAREA_MAX_LENGTH}
        />
        {validationError.ride_description && <p className="text-red-500 text-sm">{validationError.ride_description}</p>}
      </div>

      <div className="flex justify-end gap-4">
        <Button onClick={closePopup} variant="outline">Cancel</Button>
        <Button onClick={handleOfferRide} disabled={isLoading}>
          {isLoading ? 'Submitting...' : (prefill ? 'Fulfill request' : 'Submit ride')}
        </Button>
      </div>

      <AlertDialog open={showDayConflict} onOpenChange={setShowDayConflict}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ride conflict that day</AlertDialogTitle>
            <AlertDialogDescription>
              You already have a ride offered or booked on {formatDate(toLocalDateStr(date))}. Only one ride per day is allowed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowDayConflict(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {prefill && (
        <AlertDialog open={showEquipmentWarning} onOpenChange={setShowEquipmentWarning}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Can you carry this rider's {equipmentLabel(prefill.equipment).toLowerCase()}?</AlertDialogTitle>
              <AlertDialogDescription>
                Your selected vehicle doesn't have a {requiredStorageLabel || 'matching rack'} on file. Confirm you can still carry this equipment before continuing.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowEquipmentWarning(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setShowEquipmentWarning(false); doFulfill(pendingSubmit) }}>
                Yes, I can carry it
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

    </div>
  )
}
