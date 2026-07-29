export const COLORS = ["Black","White","Silver","Gray","Red","Blue","Green","Brown","Beige","Orange","Yellow","Gold","Purple","Other"]

export const STORAGE_OPTIONS = [
  { value: "ski_box",     label: "Ski/board roof box" },
  { value: "roof_rack",   label: "Roof rack" },
  { value: "bike_rack",   label: "Bike rack" },
  { value: "trunk",       label: "Trunk" },
  { value: "back_seats",  label: "Back seats" },
  { value: "truck_bed",   label: "Truck bed" },
  { value: "cargo_area",  label: "Cargo area (SUV/van)" },
]

export const EMPTY_VEHICLE = { make: "", model: "", year: "", color: "", seats: "", plate: "", storage: [] }

export const VEHICLE_NAME_MAX_LENGTH = 20

// Vehicle make/model are free-text but only ever need to hold a name like
// "Toyota" or "F-150" — strip anything that isn't a letter, number, space,
// hyphen, or apostrophe so the stored value can never carry HTML/script
// markup or other injection payloads, then cap the length.
const UNSAFE_VEHICLE_NAME_CHARS = /[^\p{L}\p{N} '-]/gu

export function sanitizeVehicleName(value) {
  if (typeof value !== "string") return ""
  return value.replace(UNSAFE_VEHICLE_NAME_CHARS, "").slice(0, VEHICLE_NAME_MAX_LENGTH)
}

export function createVehicleId() {
  return `veh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export const VEHICLE_PLATE_MAX_LENGTH = 12

// Years descending from the current year back 50 years, for the vehicle year
// dropdown — bounds the value to a valid year without needing a text-length cap.
export function vehicleYearOptions() {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: 51 }, (_, i) => String(currentYear - i))
}

// Profiles created before multi-vehicle support store a single vehicle as flat
// vehicle_* fields directly on the user doc. Rather than running a one-time
// migration script, we fold those fields into a one-item vehicles array here
// whenever we read a profile — it gets persisted as `vehicles` the next time
// the user saves their profile (see app/dashboard/profile/page.jsx).
export function getVehicles(profile) {
  if (!profile) return []
  if (Array.isArray(profile.vehicles)) return profile.vehicles

  const hasLegacyVehicle = profile.vehicle_make || profile.vehicle_model || profile.vehicle_year ||
    profile.vehicle_color || profile.vehicle_plate || profile.vehicle_seats ||
    (profile.vehicle_storage || []).length > 0

  if (!hasLegacyVehicle) return []

  return [{
    id: "legacy",
    make: profile.vehicle_make || "",
    model: profile.vehicle_model || "",
    year: profile.vehicle_year || "",
    color: profile.vehicle_color || "",
    seats: profile.vehicle_seats || "",
    plate: profile.vehicle_plate || "",
    storage: profile.vehicle_storage || [],
    isDefault: true,
  }]
}

export function getDefaultVehicle(vehicles) {
  if (!Array.isArray(vehicles) || vehicles.length === 0) return null
  return vehicles.find(v => v.isDefault) || vehicles[0]
}

export function vehicleLabel(vehicle) {
  if (!vehicle) return ""
  return [vehicle.year, vehicle.color, vehicle.make, vehicle.model].filter(Boolean).join(" ")
}

// Short "Make Model" label — used where space is tight, e.g. the Offer Ride
// dialog title ("Offer ride in: (Mercedes Sprinter)").
export function vehicleShortLabel(vehicle) {
  if (!vehicle) return ""
  return [vehicle.make, vehicle.model].filter(Boolean).join(" ")
}

// Flattens a vehicle object onto the legacy vehicle_* field names so ride/booking
// snapshots and the display components that read them (DriverDetailsPopup,
// RideDetailsPopup, the ride details page) don't need to change.
export function flattenVehicleForSnapshot(vehicle) {
  if (!vehicle) return {}
  return {
    vehicle_make: vehicle.make || "",
    vehicle_model: vehicle.model || "",
    vehicle_year: vehicle.year || "",
    vehicle_color: vehicle.color || "",
    vehicle_plate: vehicle.plate || "",
    vehicle_seats: vehicle.seats || "",
    vehicle_storage: vehicle.storage || [],
  }
}
