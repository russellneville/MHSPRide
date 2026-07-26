'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"

// Safari's native <input type="time"> treats the AM/PM segment as unset until
// the user explicitly cycles it — it can display a complete-looking time
// ("12:30 PM") while .value still reports "" per the browser's own validity
// state, silently desyncing any controlled React value from what's on screen.
// Three plain selects can never be in that ambiguous state, so this sidesteps
// the native control entirely instead of trying to out-handle its events.

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1) // 1..12
const MINUTES = Array.from({ length: 60 }, (_, i) => i)   // 0..59

function parse24(value) {
  if (!value) return null
  const [h, m] = value.split(":").map(Number)
  const meridiem = h >= 12 ? "PM" : "AM"
  let hour12 = h % 12
  if (hour12 === 0) hour12 = 12
  return { hour12, minute: m, meridiem }
}

function to24(hour12, minute, meridiem) {
  let h = hour12 % 12
  if (meridiem === "PM") h += 12
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

export default function TimeInput({ id, value, onChange, disabled }) {
  const parsed = parse24(value) ?? { hour12: 12, minute: 0, meridiem: "AM" }
  const { hour12, minute, meridiem } = parsed

  const emit = (nextHour12, nextMinute, nextMeridiem) => {
    onChange({ target: { id, value: to24(nextHour12, nextMinute, nextMeridiem) } })
  }

  return (
    <div className="flex items-center gap-1.5">
      <Select disabled={disabled} value={String(hour12)} onValueChange={(v) => emit(Number(v), minute, meridiem)}>
        <SelectTrigger className="w-[4.25rem]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {HOURS.map(h => <SelectItem key={h} value={String(h)}>{h}</SelectItem>)}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground">:</span>
      <Select disabled={disabled} value={String(minute)} onValueChange={(v) => emit(hour12, Number(v), meridiem)}>
        <SelectTrigger className="w-[4.25rem]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {MINUTES.map(m => <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select disabled={disabled} value={meridiem} onValueChange={(v) => emit(hour12, minute, v)}>
        <SelectTrigger className="w-[4.5rem]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
