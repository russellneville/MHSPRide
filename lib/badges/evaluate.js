// Pure badge-evaluation functions: facts in, currently-earned badge ids out.
// Callers (the future POST /api/badges/evaluate route) diff the returned ids
// against a member's existing users/{uid}/badges docs and create award
// records for the new ones — idempotency and persistence live there, not here.
// See resources/badging.md for the award-model rationale.

import { computeBookingStatus, computeRideStatus, isCanceledStatus } from "@/lib/rides";

const SUNRISE_CUTOFF = "06:00";
const NIGHT_OWL_CUTOFF = "20:00";
const CUTTING_IT_CLOSE_BOOKING_CUTOFF_HOURS = 6;
const CUTTING_IT_CLOSE_BUFFER_MINUTES = 30;
const PACK_MULE_STORAGE_OPTIONS = 3;
const GARAGE_FULL_VEHICLE_COUNT = 3;
const BOUNCED_BACK_WINDOW_DAYS = 7;
const CREATURE_OF_HABIT_THRESHOLD = 5;
const THE_DIPLOMAT_THRESHOLD = 3;
const FREQUENT_FLYER_NETWORK_COUNT = 4;
const ON_A_ROLL_STREAK_WEEKS = 4;
const FIVE_RIDES_REQUESTED_THRESHOLD = 5;
const TEN_RIDES_REQUESTED_THRESHOLD = 10;
const NEEDY_RIDER_THRESHOLD = 25;
const CARPOOL_HERO_THRESHOLD = 5;
const CARPOOL_CAPTAIN_THRESHOLD = 10;
const QUICK_DRAW_MINUTES = 15;
const DOWN_TO_THE_WIRE_MINUTES = 60;
const RESCUE_SQUAD_RIDER_COUNT = 3;
const REPEAT_FULFILLER_COUNT = 3;

// resources/badging.md pins "On a Roll" to America/Los_Angeles calendar weeks
// specifically (not the server's local time zone) since the evaluate route
// runs on Vercel, which defaults to UTC — a naive `date.getDay()` would put
// ride departures in the wrong week for Pacific-time members half the year.
function mondayOfPacificWeek(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const noonUTCOnDate = new Date(Date.UTC(y, m - 1, d, 12));
  const pacificDay = new Date(
    noonUTCOnDate.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
  ).getDay(); // 0=Sun..6=Sat, in Pacific time
  const daysSinceMonday = pacificDay === 0 ? 6 : pacificDay - 1;
  const monday = new Date(Date.UTC(y, m - 1, d));
  monday.setUTCDate(monday.getUTCDate() - daysSinceMonday);
  return monday.toISOString().slice(0, 10);
}

function pacificDateStr(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(date);
}

function hasConsecutiveWeekStreak(dateStrs, weeksNeeded) {
  const weekStarts = [...new Set(dateStrs.map(mondayOfPacificWeek))].sort();
  let streak = weekStarts.length > 0 ? 1 : 0;
  for (let i = 1; i < weekStarts.length; i++) {
    const gapDays = (new Date(weekStarts[i]) - new Date(weekStarts[i - 1])) / (24 * 60 * 60 * 1000);
    streak = gapDays === 7 ? streak + 1 : 1;
    if (streak >= weeksNeeded) return true;
  }
  return streak >= weeksNeeded;
}

function countCompletedDrives(offeredRides, now) {
  return (offeredRides || []).filter((ride) => computeRideStatus(ride, now) === "completed").length;
}

function countCompletedRides(bookedRides, now) {
  return (bookedRides || []).filter((booking) => computeBookingStatus(booking, now) === "completed").length;
}

// "Offered"/"Booked" badges reward the action itself (matches the issue's
// original "Offered a ride" / "Booked a first ride" wording) — no completion
// or cancellation filtering. "Completed" badges require the ride/booking to
// have actually finished, using date/time-based completion (computeRideStatus
// / computeBookingStatus), not the manually-set ride_status/booking_status
// "finished" value, which under-counts real completions (resources/badging.md
// correction #1).
export function evaluateMilestoneBadges({ offeredRides = [], bookedRides = [], now = new Date() } = {}) {
  const earned = [];

  if (offeredRides.length >= 1) earned.push("first-ride-offered");
  if (bookedRides.length >= 1) earned.push("first-ride-booked");

  const completedDrives = countCompletedDrives(offeredRides, now);
  const completedRides = countCompletedRides(bookedRides, now);
  const combined = completedDrives + completedRides;

  if (completedDrives >= 1) earned.push("first-drive-completed");
  if (completedRides >= 1) earned.push("first-ride-completed");
  if (completedDrives >= 5) earned.push("fifth-drive-completed");
  if (completedRides >= 5) earned.push("fifth-ride-completed");
  if (combined >= 10) earned.push("ten-drives-or-rides");
  if (combined >= 25) earned.push("twenty-five-drives-or-rides");
  if (combined >= 50) earned.push("fifty-drives-or-rides");

  return earned;
}

function completedItems(offeredRides, bookedRides, now) {
  const drives = (offeredRides || []).filter((ride) => computeRideStatus(ride, now) === "completed");
  const rides = (bookedRides || []).filter((booking) => computeBookingStatus(booking, now) === "completed");
  return [...drives, ...rides];
}

function daysBetween(dateStrA, dateStrB) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return (new Date(dateStrB) - new Date(dateStrA)) / msPerDay;
}

// The 13 whimsical badges added after initial review (resources/badging.md,
// "Additional badge ideas") — all reuse existing ride/booking/user fields, no
// schema changes. Grouped roughly by theme; see resources/badging.md for the
// rationale behind each threshold, most of which are judgment calls rather
// than values derived from the product spec.
export function evaluateActivityBadges({ offeredRides = [], bookedRides = [], user = {}, now = new Date() } = {}) {
  const earned = [];
  const completed = completedItems(offeredRides, bookedRides, now);

  // --- Timing ---
  if (completed.some((item) => item.departure_time && item.departure_time < SUNRISE_CUTOFF)) {
    earned.push("sunrise-patrol");
  }
  if (completed.some((item) => item.departure_time && item.departure_time >= NIGHT_OWL_CUTOFF)) {
    earned.push("night-owl");
  }

  // Booked as late as the 6h booking cutoff legally allows (within a 30min
  // buffer of the boundary). Assumes booked_at is already a JS Date — the
  // caller is responsible for converting Firestore Timestamps before calling.
  const cuttingItClose = (bookedRides || []).some((booking) => {
    if (!booking.booked_at || !booking.departure_date) return false;
    const departure = new Date(`${booking.departure_date}T${booking.departure_time || "00:00"}`);
    const cutoff = new Date(departure.getTime() - CUTTING_IT_CLOSE_BOOKING_CUTOFF_HOURS * 60 * 60 * 1000);
    const bufferStart = new Date(cutoff.getTime() - CUTTING_IT_CLOSE_BUFFER_MINUTES * 60 * 1000);
    const bookedAt = booking.booked_at instanceof Date ? booking.booked_at : new Date(booking.booked_at);
    return bookedAt >= bufferStart && bookedAt <= cutoff;
  });
  if (cuttingItClose) earned.push("cutting-it-close");

  // Four consecutive Pacific-time calendar weeks with a non-canceled offered
  // ride that has already departed — a still-scheduled future ride doesn't
  // count yet (resources/badging.md streak semantics).
  const today = pacificDateStr(now);
  const occurredOfferedDates = (offeredRides || [])
    .filter((ride) => !isCanceledStatus(ride.ride_status) && ride.departure_date && ride.departure_date <= today)
    .map((ride) => ride.departure_date);
  if (hasConsecutiveWeekStreak(occurredOfferedDates, ON_A_ROLL_STREAK_WEEKS)) {
    earned.push("on-a-roll");
  }

  // Booking docs never store one_way at all (context/NetworksContext.jsx's
  // bookRide only uses it transiently to decide return_departure_time, never
  // persists it) — return_departure_time truthiness is the reliable signal
  // for round-trip-ness on both rides and bookings, and is what
  // lib/rides.js's getRideEndTime already keys off for the same reason.
  if (completed.some((item) => item.return_departure_time)) {
    earned.push("round-tripper");
  }

  // --- Vehicle ---
  if (
    (offeredRides || []).some(
      (ride) => !isCanceledStatus(ride.ride_status) && ride.available_seats === 0 && ride.total_seats > 0
    )
  ) {
    earned.push("fully-loaded");
  }
  if ((offeredRides || []).some((ride) => (ride.driver?.vehicle_storage || []).length >= PACK_MULE_STORAGE_OPTIONS)) {
    earned.push("pack-mule");
  }
  if ((user.vehicles || []).length >= GARAGE_FULL_VEHICLE_COUNT) {
    earned.push("garage-full");
  }

  // Both require fields only present on rides created after this shipped
  // (resources/badging.md corrections #3/#4) — historical rides have neither
  // custom_departure/custom_arrival nor a driver.vehicle_id, so this only
  // starts matching prospectively, not retroactively.
  if (completed.some((item) => item.custom_departure || item.custom_arrival)) {
    earned.push("off-the-beaten-path");
  }
  const distinctVehicleIds = new Set(
    (offeredRides || []).map((ride) => ride.driver?.vehicle_id).filter(Boolean)
  );
  if (distinctVehicleIds.size >= 2) {
    earned.push("auto-dexterous");
  }

  // --- Resilience / comedy of errors ---
  const allOwn = [
    ...(offeredRides || []).map((r) => ({ departure_date: r.departure_date, canceled: isCanceledStatus(r.ride_status) })),
    ...(bookedRides || []).map((b) => ({ departure_date: b.departure_date, canceled: isCanceledStatus(b.booking_status) })),
  ].filter((r) => r.departure_date);

  const bouncedBack = allOwn.some((canceledItem) => {
    if (!canceledItem.canceled) return false;
    return allOwn.some((other) => {
      if (other.canceled) return false;
      const gap = daysBetween(canceledItem.departure_date, other.departure_date);
      return gap >= 0 && gap <= BOUNCED_BACK_WINDOW_DAYS;
    });
  });
  if (bouncedBack) earned.push("bounced-back");

  const ownRides = offeredRides || [];
  const persistent = ownRides.some((canceledRide) => {
    if (!isCanceledStatus(canceledRide.ride_status)) return false;
    return ownRides.some(
      (other) => !isCanceledStatus(other.ride_status) && other.departure_date === canceledRide.departure_date
    );
  });
  if (persistent) earned.push("persistent");

  // --- Exploration & social ---
  const networkIds = new Set((bookedRides || []).map((b) => b.networkId).filter(Boolean));
  if (networkIds.size >= FREQUENT_FLYER_NETWORK_COUNT) {
    earned.push("frequent-flyer");
  }

  const driverCounts = new Map();
  for (const booking of bookedRides || []) {
    if (isCanceledStatus(booking.booking_status)) continue;
    const driverId = booking.driverId || booking.driver?.id;
    if (!driverId) continue;
    driverCounts.set(driverId, (driverCounts.get(driverId) || 0) + 1);
  }
  if ([...driverCounts.values()].some((count) => count >= CREATURE_OF_HABIT_THRESHOLD)) {
    earned.push("creature-of-habit");
  }

  // --- Communication ---
  const acknowledgedUpdates = (bookedRides || []).filter(
    (booking) => booking.update_seen === true && booking.ride_updated === false
  ).length;
  if (acknowledgedUpdates >= THE_DIPLOMAT_THRESHOLD) {
    earned.push("the-diplomat");
  }

  return earned;
}

// "Gone to the Dark Side" is unlike every other lazy badge: theme is a
// next-themes client preference (localStorage/cookie), never written to
// Firestore (context/ThemeContext.jsx) — there is no user-doc field for the
// route to read. The caller must have the client submit its current theme
// value in the POST /api/badges/evaluate body for this to work at all; it
// cannot be derived from the same Firestore facts as everything else.
export function evaluateThemeBadges({ theme } = {}) {
  return theme === "dark" ? ["dark-side"] : [];
}

// Ride-request badges (issue #160). Rider-side counts reward the raw act of
// requesting (rideRequests.length), matching how "first-ride-offered"/
// "first-ride-booked" reward the action itself, not completion. Driver-side
// fulfillment badges/timing/social badges all key off fields the fulfill
// route (app/api/ride-requests/fulfill/route.js) stamps onto the ride doc it
// creates — source_request_id, source_requester_id, request_response_minutes,
// request_minutes_until_expiry — since the original ride_requests doc is not
// otherwise reachable from a driver's offeredRides.
export function evaluateRideRequestBadges({ rideRequests = [], offeredRides = [], bookedRides = [] } = {}) {
  const earned = [];

  if (rideRequests.length >= 1) earned.push("first-ride-requested");
  if (rideRequests.length >= FIVE_RIDES_REQUESTED_THRESHOLD) earned.push("five-rides-requested");
  if (rideRequests.length >= TEN_RIDES_REQUESTED_THRESHOLD) earned.push("ten-rides-requested");
  if (rideRequests.length >= NEEDY_RIDER_THRESHOLD) earned.push("needy-rider");

  const fulfillments = (offeredRides || []).filter((ride) => !!ride.source_request_id);
  if (fulfillments.length >= 1) earned.push("mountain-mover");
  if (fulfillments.length >= CARPOOL_HERO_THRESHOLD) earned.push("carpool-hero");
  if (fulfillments.length >= CARPOOL_CAPTAIN_THRESHOLD) earned.push("carpool-captain");

  if (fulfillments.some((ride) => typeof ride.request_response_minutes === "number" && ride.request_response_minutes <= QUICK_DRAW_MINUTES)) {
    earned.push("quick-draw");
  }
  if (fulfillments.some((ride) => typeof ride.request_minutes_until_expiry === "number" && ride.request_minutes_until_expiry <= DOWN_TO_THE_WIRE_MINUTES)) {
    earned.push("down-to-the-wire");
  }

  const requesterCounts = new Map();
  for (const ride of fulfillments) {
    if (!ride.source_requester_id) continue;
    requesterCounts.set(ride.source_requester_id, (requesterCounts.get(ride.source_requester_id) || 0) + 1);
  }
  if (requesterCounts.size >= RESCUE_SQUAD_RIDER_COUNT) earned.push("rescue-squad");
  if ([...requesterCounts.values()].some((count) => count >= REPEAT_FULFILLER_COUNT)) earned.push("repeat-fulfiller");

  // Mirrors the-diplomat's "changed and the rider didn't cancel" shape, but
  // one-shot rather than a 3x threshold — request_changed is stamped once at
  // fulfillment time, so there's no separate "seen" state to accumulate.
  const rollingWithIt = (bookedRides || []).some(
    (booking) => booking.request_changed === true && !isCanceledStatus(booking.booking_status)
  );
  if (rollingWithIt) earned.push("rolling-with-it");

  return earned;
}
