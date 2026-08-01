import { isCanceledStatus } from "./rides";

// Ride-request-specific status set: unlike rides/bookings (open/canceled),
// a request also passes through fulfilled/expired, neither of which
// isCanceledStatus() recognizes — so this collection gets its own predicate
// rather than overloading the rides one.
export function isClosedRequestStatus(status) {
  return status === "fulfilled" || status === "expired" || isCanceledStatus(status);
}

export const REQUEST_STATUS_LABEL = {
  open:      "Requested",
  fulfilled: "Fulfilled",
  expired:   "Expired",
  canceled:  "Canceled",
};

export const REQUEST_STATUS_CLASS = {
  open:      "bg-purple-100 text-purple-800 border-purple-300",
  fulfilled: "bg-green-100 text-green-800 border-green-300",
  expired:   "bg-muted text-muted-foreground",
  canceled:  "bg-red-100 text-red-700 border-red-300",
};

// Same shape as hasActiveSameDayRide/hasActiveSameDayBooking (lib/rides.js),
// but keyed on "is there any open request at all" rather than a specific date —
// only one open request is allowed per rider at a time.
export function hasOpenRideRequest(requests) {
  return (requests || []).some((r) => r.status === "open");
}

export const REQUEST_EXPIRY_CUTOFF_HOURS = 6;

export function computeRequestExpiresAt(departure_date, departure_time) {
  return new Date(
    new Date(`${departure_date}T${departure_time || "00:00"}`).getTime() -
      REQUEST_EXPIRY_CUTOFF_HOURS * 60 * 60 * 1000
  );
}

export const EQUIPMENT_OPTIONS = [
  { value: "skis_snowboard", label: "Skis/Snowboard" },
  { value: "bike",           label: "Bike" },
  { value: "no_equipment",   label: "No equipment" },
];

export function equipmentLabel(equipment) {
  return EQUIPMENT_OPTIONS.find((o) => o.value === equipment)?.label || equipment;
}

// Maps a request's equipment type onto the one existing vehicle STORAGE_OPTIONS
// (lib/vehicles.js) entry that actually carries it. Deliberately narrow — the
// other storage options (roof_rack, trunk, back_seats, truck_bed, cargo_area)
// are generic capacity, not equipment-specific, so they don't count as a match.
export function requiredStorageFor(equipment) {
  if (equipment === "skis_snowboard") return "ski_box";
  if (equipment === "bike") return "bike_rack";
  return null;
}

// Fields literally copied from a ride_request into a prefilled Offer Ride
// form. arrival_time is deliberately excluded — it's auto-estimated via
// useEstimatedArrival, never copied from the request, so including it here
// would flag "changed" on nearly every fulfillment.
const DIFFABLE_FIELDS = [
  { field: "departure",       label: "Departure location" },
  { field: "arrival",         label: "Arrival location" },
  { field: "departure_date",  label: "Date" },
  { field: "departure_time",  label: "Departure time" },
];

// Pure diff between a request and what a driver actually submits — used both
// client-side (Notes-required validation) and server-side (email diff block,
// authoritative validation), so there's one source of truth for "changed."
export function diffPrefilledFields(request, submitted) {
  return DIFFABLE_FIELDS
    .filter(({ field }) => String(request?.[field] ?? "") !== String(submitted?.[field] ?? ""))
    .map(({ field, label }) => ({
      field,
      label,
      oldValue: request?.[field] ?? "",
      newValue: submitted?.[field] ?? "",
    }));
}
