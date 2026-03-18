import { useState } from "react"
import { Label } from "../ui/label"
import { Input } from "../ui/input"
import DatePicker from "../ui/date-picker"
import { usePopup } from "@/context/PopupContext"
import { useNetwork } from "@/context/NetworksContext"
import { Button } from "../ui/button"
import { Textarea } from "../ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Checkbox } from "../ui/checkbox"
import { LOCATIONS } from "@/lib/locations"
import { estimateArrival } from "@/lib/drive-times"
import { toLocalDateStr } from "@/lib/utils"

const DEPARTURE_LOCATIONS = LOCATIONS.filter(l => l.id !== "timberline-lodge")

const ARRIVAL_LOCATIONS = [
  { id: "buzz-bowman",  name: "Buzz Bowman Ski Patrol Building" },
  { id: "summit-pass",  name: "Summit Pass" },
  { id: "timberline",   name: "Timberline" },
  { id: "ski-bowl",     name: "Ski Bowl" },
  { id: "meadows",      name: "Meadows" },
  { id: "tea-cup",      name: "Tea Cup" },
]

const KNOWN_DEP_IDS  = new Set(DEPARTURE_LOCATIONS.map(l => l.id))
const KNOWN_ARR_IDS  = new Set(ARRIVAL_LOCATIONS.map(l => l.id))

function LocationPicker({ value, onSelectChange, otherValue, onOtherChange, locations, selectPlaceholder }) {
  return (
    <div className="space-y-2">
      <Select
        value={otherValue ? '' : value}
        onValueChange={(v) => { onSelectChange(v); onOtherChange('') }}
        disabled={!!otherValue}
      >
        <SelectTrigger>
          <SelectValue placeholder={selectPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {locations.map(loc => (
            <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        placeholder="Other — type a location"
        value={otherValue}
        onChange={(e) => {
          onOtherChange(e.target.value)
          if (e.target.value) onSelectChange('')
        }}
      />
    </div>
  )
}

export default function EditRidePopup({ ride, onSaved }) {
  const { closePopup } = usePopup()
  const { isLoading, updateRide } = useNetwork()

  // Seed departure — known ID or free-text
  const initDepSelect = KNOWN_DEP_IDS.has(ride.departure) ? ride.departure : ''
  const initDepOther  = KNOWN_DEP_IDS.has(ride.departure) ? '' : (ride.departure || '')

  // Seed arrival — known ID or free-text
  const initArrSelect = KNOWN_ARR_IDS.has(ride.arrival) ? ride.arrival : ''
  const initArrOther  = KNOWN_ARR_IDS.has(ride.arrival) ? '' : (ride.arrival || '')

  const [departureSelect, setDepartureSelect] = useState(initDepSelect)
  const [departureOther,  setDepartureOther]  = useState(initDepOther)
  const [arrivalSelect,   setArrivalSelect]   = useState(initArrSelect)
  const [arrivalOther,    setArrivalOther]    = useState(initArrOther)
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

  const effectiveDeparture = departureOther.trim() ? departureOther.trim().toLowerCase() : departureSelect
  const effectiveArrival   = arrivalOther.trim()   ? arrivalOther.trim().toLowerCase()   : arrivalSelect

  const handleChange = (e) => {
    const updated = { ...rideData, [e.target.id]: e.target.value }
    if (e.target.id === "departure_time" && effectiveDeparture && effectiveArrival) {
      const est = estimateArrival(e.target.value, effectiveDeparture, effectiveArrival)
      if (est) updated.arrival_time = est
    }
    setRideData(updated)
  }

  const validateForm = () => {
    const newErrors = {}
    if (!effectiveDeparture) newErrors.departure = "Departure is required"
    if (!effectiveArrival)   newErrors.arrival   = "Arrival is required"
    if (!date)               newErrors.date      = "Date is required"
    if (!rideData.departure_time) newErrors.departure_time = "Departure time is required"
    if (!rideData.total_seats || Number(rideData.total_seats) < 1) newErrors.total_seats = "Number of riders is required"
    setValidationErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return
    const dateStr = toLocalDateStr(date)
    await updateRide(ride.id, {
      departure:             effectiveDeparture,
      arrival:               effectiveArrival,
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
            onSelectChange={setDepartureSelect}
            otherValue={departureOther}
            onOtherChange={setDepartureOther}
            locations={DEPARTURE_LOCATIONS}
            selectPlaceholder="Select pickup location"
          />
          {validationError.departure && <p className="text-red-500 text-sm">{validationError.departure}</p>}
        </div>

        <div className="space-y-1">
          <Label>Arrival</Label>
          <LocationPicker
            value={arrivalSelect}
            onSelectChange={setArrivalSelect}
            otherValue={arrivalOther}
            onOtherChange={setArrivalOther}
            locations={ARRIVAL_LOCATIONS}
            selectPlaceholder="Select arrival location"
          />
          {validationError.arrival && <p className="text-red-500 text-sm">{validationError.arrival}</p>}
        </div>

        <div className="flex items-start gap-2">
          <div className="flex-1 space-y-1">
            <Label>Date</Label>
            <DatePicker date={date} setDate={setDate} disabled={{ before: new Date() }} />
            {validationError.date && <p className="text-red-500 text-sm">{validationError.date}</p>}
          </div>
          <div className="flex-1 space-y-1">
            <Label htmlFor="departure_time">Departure time</Label>
            <Input type="time" id="departure_time" onChange={handleChange} value={rideData.departure_time} />
            {validationError.departure_time && <p className="text-red-500 text-sm">{validationError.departure_time}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="arrival_time">Arrival time</Label>
          <Input type="time" id="arrival_time" onChange={handleChange} value={rideData.arrival_time} />
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
            <Input type="time" id="return_departure_time" onChange={handleChange} value={rideData.return_departure_time} />
          </div>
        )}
      </div>

      {/* ── Riders + Notes ─────────────────────────────── */}
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Number of riders</Label>
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
