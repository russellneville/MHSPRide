export function normalizeStatus(status) {
  return status === "cancled" ? "canceled" : status || "—";
}

export function isCanceledStatus(status) {
  return normalizeStatus(status) === "canceled";
}

export function computeRideStatus(ride, now = new Date()) {
  if (isCanceledStatus(ride?.ride_status)) return "canceled";

  const departure = new Date(`${ride.departure_date}T${ride.departure_time || "00:00"}`);
  const arrival = ride.arrival_time
    ? new Date(`${ride.departure_date}T${ride.arrival_time}`)
    : new Date(departure.getTime() + 4 * 60 * 60 * 1000);

  if (now < departure) return (ride.available_seats || 0) > 0 ? "open" : "full";
  if (now <= arrival) return "in_progress";
  return "completed";
}

export function hasActiveSameDayBooking(bookings, departureDate) {
  return (bookings || []).some(
    (booking) =>
      booking.departure_date === departureDate &&
      !isCanceledStatus(booking.booking_status)
  );
}

export function getBookedSeatCount(ride) {
  return (ride?.total_seats || 0) - (ride?.available_seats || 0);
}

export function getAvailableSeatsAfterBooking(ride, seatsToBook) {
  return (ride?.available_seats || 0) - Number(seatsToBook || 0);
}
