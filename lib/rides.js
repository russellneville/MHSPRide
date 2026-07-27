export function normalizeStatus(status) {
  return status === "cancled" ? "canceled" : status || "—";
}

export function isCanceledStatus(status) {
  return normalizeStatus(status) === "canceled";
}

// End of the ride window: the return departure for round trips, the arrival
// time for one-way trips, or a 4-hour default when neither is set yet.
export function getRideEndTime(ride) {
  const departure = getBookingDeparture(ride);
  if (!ride.one_way && ride.return_departure_time) {
    return new Date(`${ride.departure_date}T${ride.return_departure_time}`);
  }
  if (ride.arrival_time) {
    return new Date(`${ride.departure_date}T${ride.arrival_time}`);
  }
  return new Date(departure.getTime() + 4 * 60 * 60 * 1000);
}

export function computeRideStatus(ride, now = new Date()) {
  if (isCanceledStatus(ride?.ride_status)) return "canceled";

  const departure = getBookingDeparture(ride);
  const end = getRideEndTime(ride);

  if (now < departure) return (ride.available_seats || 0) > 0 ? "open" : "full";
  if (now <= end) return "in_progress";
  return "completed";
}

export function hasActiveSameDayBooking(bookings, departureDate) {
  return (bookings || []).some(
    (booking) =>
      booking.departure_date === departureDate &&
      !isCanceledStatus(booking.booking_status)
  );
}

export function hasActiveSameDayRide(rides, departureDate) {
  return (rides || []).some(
    (ride) =>
      ride.departure_date === departureDate &&
      !isCanceledStatus(ride.ride_status)
  );
}

export function getBookedSeatCount(ride) {
  return (ride?.total_seats || 0) - (ride?.available_seats || 0);
}

export function getAvailableSeatsAfterBooking(ride, seatsToBook) {
  return (ride?.available_seats || 0) - Number(seatsToBook || 0);
}

export const CANCELLATION_CUTOFF_HOURS = 12;

export function getBookingDeparture(booking) {
  return new Date(`${booking.departure_date}T${booking.departure_time || "00:00"}`);
}

export function canCancelBooking(booking, now = new Date()) {
  if (isCanceledStatus(booking?.booking_status)) return false;
  if (!booking?.departure_date) return false;
  const cutoff = new Date(
    getBookingDeparture(booking).getTime() - CANCELLATION_CUTOFF_HOURS * 60 * 60 * 1000
  );
  return now < cutoff;
}

export const BOOKING_CUTOFF_HOURS = 6;

export function canBookRide(ride, now = new Date()) {
  if (!ride?.departure_date) return false;
  const cutoff = new Date(
    getBookingDeparture(ride).getTime() - BOOKING_CUTOFF_HOURS * 60 * 60 * 1000
  );
  return now < cutoff;
}
