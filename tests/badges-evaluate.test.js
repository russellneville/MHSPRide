import { describe, expect, it } from "vitest";
import {
  evaluateActivityBadges,
  evaluateMilestoneBadges,
  evaluateRideRequestBadges,
  evaluateThemeBadges,
} from "@/lib/badges/evaluate";

const now = new Date("2026-02-10T12:00:00");

const completedRide = {
  departure_date: "2026-02-01",
  departure_time: "06:00",
  arrival_time: "07:15",
  ride_status: "finished",
};

const upcomingRide = {
  departure_date: "2026-03-01",
  departure_time: "06:00",
  arrival_time: "07:15",
  ride_status: "not started",
};

const canceledRide = {
  departure_date: "2026-02-01",
  departure_time: "06:00",
  arrival_time: "07:15",
  ride_status: "canceled",
};

const completedBooking = {
  departure_date: "2026-02-01",
  departure_time: "06:00",
  arrival_time: "07:15",
  booking_status: "finished",
};

describe("evaluateMilestoneBadges", () => {
  it("awards nothing with no history", () => {
    expect(evaluateMilestoneBadges({ offeredRides: [], bookedRides: [], now })).toEqual([]);
  });

  it("awards first-ride-offered/booked for the act itself, even if canceled or still upcoming", () => {
    const earned = evaluateMilestoneBadges({
      offeredRides: [canceledRide],
      bookedRides: [upcomingRide],
      now,
    });
    expect(earned).toContain("first-ride-offered");
    expect(earned).toContain("first-ride-booked");
    expect(earned).not.toContain("first-drive-completed");
    expect(earned).not.toContain("first-ride-completed");
  });

  it("does not award completion badges from a canceled or upcoming ride", () => {
    const earned = evaluateMilestoneBadges({
      offeredRides: [canceledRide, upcomingRide],
      bookedRides: [],
      now,
    });
    expect(earned).not.toContain("first-drive-completed");
  });

  it("awards first-drive-completed and first-ride-completed once a ride/booking has actually completed", () => {
    const earned = evaluateMilestoneBadges({
      offeredRides: [completedRide],
      bookedRides: [completedBooking],
      now,
    });
    expect(earned).toContain("first-drive-completed");
    expect(earned).toContain("first-ride-completed");
    expect(earned).not.toContain("fifth-drive-completed");
  });

  it("awards fifth-drive-completed at exactly 5 completed drives", () => {
    const earned = evaluateMilestoneBadges({
      offeredRides: Array(5).fill(completedRide),
      bookedRides: [],
      now,
    });
    expect(earned).toContain("fifth-drive-completed");
  });

  it("combines completed drives and rides for the 10/25/50 milestones", () => {
    const earned = evaluateMilestoneBadges({
      offeredRides: Array(6).fill(completedRide),
      bookedRides: Array(4).fill(completedBooking),
      now,
    });
    expect(earned).toContain("ten-drives-or-rides");
    expect(earned).not.toContain("twenty-five-drives-or-rides");
  });

  it("awards twenty-five and fifty at the combined thresholds", () => {
    const earned25 = evaluateMilestoneBadges({
      offeredRides: Array(25).fill(completedRide),
      bookedRides: [],
      now,
    });
    expect(earned25).toContain("twenty-five-drives-or-rides");
    expect(earned25).not.toContain("fifty-drives-or-rides");

    const earned50 = evaluateMilestoneBadges({
      offeredRides: Array(50).fill(completedRide),
      bookedRides: [],
      now,
    });
    expect(earned50).toContain("fifty-drives-or-rides");
  });

  it("ignores canceled rides/bookings when counting completions", () => {
    const earned = evaluateMilestoneBadges({
      offeredRides: [...Array(4).fill(completedRide), canceledRide],
      bookedRides: [],
      now,
    });
    expect(earned).not.toContain("fifth-drive-completed");
  });
});

describe("evaluateActivityBadges", () => {
  it("awards nothing with no history", () => {
    expect(evaluateActivityBadges({ offeredRides: [], bookedRides: [], user: {}, now })).toEqual([]);
  });

  it("awards sunrise-patrol and night-owl from completed departure times, not upcoming ones", () => {
    const early = { ...completedRide, departure_time: "05:30" };
    const late = { ...completedRide, departure_time: "21:00" };
    const upcomingEarly = { ...upcomingRide, departure_time: "05:30" };

    expect(evaluateActivityBadges({ offeredRides: [early], bookedRides: [], user: {}, now })).toContain(
      "sunrise-patrol"
    );
    expect(evaluateActivityBadges({ offeredRides: [late], bookedRides: [], user: {}, now })).toContain("night-owl");
    expect(
      evaluateActivityBadges({ offeredRides: [upcomingEarly], bookedRides: [], user: {}, now })
    ).not.toContain("sunrise-patrol");
  });

  it("awards cutting-it-close only when booked within the buffer of the 6h cutoff", () => {
    const departure = new Date("2026-02-10T18:00:00");
    const booking = (bookedAt) => ({
      departure_date: "2026-02-10",
      departure_time: "18:00",
      booking_status: "booked",
      booked_at: bookedAt,
    });

    const rightAtCutoff = booking(new Date(departure.getTime() - 6 * 60 * 60 * 1000 - 5 * 60 * 1000));
    const wayEarly = booking(new Date(departure.getTime() - 48 * 60 * 60 * 1000));

    expect(evaluateActivityBadges({ offeredRides: [], bookedRides: [rightAtCutoff], user: {}, now })).toContain(
      "cutting-it-close"
    );
    expect(evaluateActivityBadges({ offeredRides: [], bookedRides: [wayEarly], user: {}, now })).not.toContain(
      "cutting-it-close"
    );
  });

  it("awards round-tripper from a completed round-trip ride or booking", () => {
    // return_departure_time, not one_way, is the reliable signal — booking
    // docs never store one_way at all (context/NetworksContext.jsx).
    const roundTripDrive = { ...completedRide, return_departure_time: "16:00" };
    const roundTripBooking = { ...completedBooking, return_departure_time: "16:00" };

    expect(evaluateActivityBadges({ offeredRides: [roundTripDrive], bookedRides: [], user: {}, now })).toContain(
      "round-tripper"
    );
    expect(evaluateActivityBadges({ offeredRides: [], bookedRides: [roundTripBooking], user: {}, now })).toContain(
      "round-tripper"
    );
    expect(evaluateActivityBadges({ offeredRides: [completedRide], bookedRides: [], user: {}, now })).not.toContain(
      "round-tripper"
    );
  });

  it("awards fully-loaded when an active offered ride has zero available seats", () => {
    const full = { ride_status: "not started", available_seats: 0, total_seats: 4 };
    const canceledFull = { ride_status: "canceled", available_seats: 0, total_seats: 4 };

    expect(evaluateActivityBadges({ offeredRides: [full], bookedRides: [], user: {}, now })).toContain(
      "fully-loaded"
    );
    expect(evaluateActivityBadges({ offeredRides: [canceledFull], bookedRides: [], user: {}, now })).not.toContain(
      "fully-loaded"
    );
  });

  it("awards pack-mule from a ride offered with a well-equipped vehicle", () => {
    // vehicle_storage, not storage — lib/vehicles.js's flattenVehicleForSnapshot
    // flattens onto the legacy vehicle_* field names.
    const wellEquipped = { driver: { vehicle_storage: ["roof_rack", "bike_rack", "trunk"] } };
    const sparse = { driver: { vehicle_storage: ["trunk"] } };

    expect(evaluateActivityBadges({ offeredRides: [wellEquipped], bookedRides: [], user: {}, now })).toContain(
      "pack-mule"
    );
    expect(evaluateActivityBadges({ offeredRides: [sparse], bookedRides: [], user: {}, now })).not.toContain(
      "pack-mule"
    );
  });

  it("awards garage-full at three or more registered vehicles", () => {
    const user = { vehicles: [{ id: "a" }, { id: "b" }, { id: "c" }] };
    expect(evaluateActivityBadges({ offeredRides: [], bookedRides: [], user, now })).toContain("garage-full");
    expect(
      evaluateActivityBadges({ offeredRides: [], bookedRides: [], user: { vehicles: [{ id: "a" }] }, now })
    ).not.toContain("garage-full");
  });

  it("awards bounced-back when a new booking follows a cancellation within 7 days", () => {
    const canceled = { departure_date: "2026-02-01", booking_status: "canceled" };
    const rebooked = { departure_date: "2026-02-06", booking_status: "booked" };
    const tooLate = { departure_date: "2026-02-20", booking_status: "booked" };

    expect(
      evaluateActivityBadges({ offeredRides: [], bookedRides: [canceled, rebooked], user: {}, now })
    ).toContain("bounced-back");
    expect(
      evaluateActivityBadges({ offeredRides: [], bookedRides: [canceled, tooLate], user: {}, now })
    ).not.toContain("bounced-back");
  });

  it("awards persistent when a canceled and re-offered ride share a departure date", () => {
    const canceled = { departure_date: "2026-02-10", ride_status: "canceled" };
    const reoffered = { departure_date: "2026-02-10", ride_status: "not started" };

    expect(evaluateActivityBadges({ offeredRides: [canceled, reoffered], bookedRides: [], user: {}, now })).toContain(
      "persistent"
    );
  });

  it("awards frequent-flyer once bookings span all four networks", () => {
    const bookings = ["a", "b", "c", "d"].map((networkId) => ({ networkId, booking_status: "booked" }));
    expect(evaluateActivityBadges({ offeredRides: [], bookedRides: bookings, user: {}, now })).toContain(
      "frequent-flyer"
    );
    expect(
      evaluateActivityBadges({ offeredRides: [], bookedRides: bookings.slice(0, 3), user: {}, now })
    ).not.toContain("frequent-flyer");
  });

  it("awards creature-of-habit at five non-canceled bookings with the same driver", () => {
    const bookings = Array(5).fill({ driverId: "driver-1", booking_status: "booked" });
    const withOneCanceled = [
      ...Array(4).fill({ driverId: "driver-1", booking_status: "booked" }),
      { driverId: "driver-1", booking_status: "canceled" },
    ];

    expect(evaluateActivityBadges({ offeredRides: [], bookedRides: bookings, user: {}, now })).toContain(
      "creature-of-habit"
    );
    expect(
      evaluateActivityBadges({ offeredRides: [], bookedRides: withOneCanceled, user: {}, now })
    ).not.toContain("creature-of-habit");
  });

  it("awards the-diplomat at three acknowledged ride-update notices", () => {
    const acknowledged = Array(3).fill({ ride_updated: false, update_seen: true, booking_status: "booked" });
    expect(evaluateActivityBadges({ offeredRides: [], bookedRides: acknowledged, user: {}, now })).toContain(
      "the-diplomat"
    );
  });

  it("awards on-a-roll for four departed rides on the same weekday, seven days apart", () => {
    const ride = (date) => ({ departure_date: date, ride_status: "finished" });
    const fourWeeks = [
      ride("2026-01-13"),
      ride("2026-01-20"),
      ride("2026-01-27"),
      ride("2026-02-03"),
    ];
    expect(evaluateActivityBadges({ offeredRides: fourWeeks, bookedRides: [], user: {}, now })).toContain(
      "on-a-roll"
    );
  });

  it("does not award on-a-roll when a week is skipped", () => {
    const ride = (date) => ({ departure_date: date, ride_status: "finished" });
    const skippedWeek = [ride("2026-01-13"), ride("2026-01-20"), ride("2026-02-03")];
    expect(evaluateActivityBadges({ offeredRides: skippedWeek, bookedRides: [], user: {}, now })).not.toContain(
      "on-a-roll"
    );
  });

  it("does not count a canceled ride or a still-future ride toward the streak", () => {
    const canceledWeek = [
      { departure_date: "2026-01-13", ride_status: "finished" },
      { departure_date: "2026-01-20", ride_status: "canceled" },
      { departure_date: "2026-01-27", ride_status: "finished" },
      { departure_date: "2026-02-03", ride_status: "finished" },
    ];
    expect(evaluateActivityBadges({ offeredRides: canceledWeek, bookedRides: [], user: {}, now })).not.toContain(
      "on-a-roll"
    );

    const futureRide = [
      { departure_date: "2026-01-27", ride_status: "not started" },
      { departure_date: "2026-02-03", ride_status: "not started" },
      { departure_date: "2026-02-10", ride_status: "not started" },
      { departure_date: "2026-02-17", ride_status: "not started" }, // after `now`
    ];
    expect(evaluateActivityBadges({ offeredRides: futureRide, bookedRides: [], user: {}, now })).not.toContain(
      "on-a-roll"
    );
  });

  it("awards off-the-beaten-path from a completed ride or booking with a custom location", () => {
    const customDrive = { ...completedRide, custom_departure: true };
    const customBooking = { ...completedBooking, custom_arrival: true };
    const plainDrive = { ...completedRide, custom_departure: false, custom_arrival: false };

    expect(evaluateActivityBadges({ offeredRides: [customDrive], bookedRides: [], user: {}, now })).toContain(
      "off-the-beaten-path"
    );
    expect(evaluateActivityBadges({ offeredRides: [], bookedRides: [customBooking], user: {}, now })).toContain(
      "off-the-beaten-path"
    );
    expect(evaluateActivityBadges({ offeredRides: [plainDrive], bookedRides: [], user: {}, now })).not.toContain(
      "off-the-beaten-path"
    );
  });

  it("awards auto-dexterous once rides are offered with two distinct vehicles", () => {
    const oneVehicle = [
      { driver: { vehicle_id: "veh-1" } },
      { driver: { vehicle_id: "veh-1" } },
    ];
    const twoVehicles = [
      { driver: { vehicle_id: "veh-1" } },
      { driver: { vehicle_id: "veh-2" } },
    ];

    expect(evaluateActivityBadges({ offeredRides: oneVehicle, bookedRides: [], user: {}, now })).not.toContain(
      "auto-dexterous"
    );
    expect(evaluateActivityBadges({ offeredRides: twoVehicles, bookedRides: [], user: {}, now })).toContain(
      "auto-dexterous"
    );
  });
});

describe("evaluateThemeBadges", () => {
  it("awards dark-side only when the client-supplied theme is dark", () => {
    expect(evaluateThemeBadges({ theme: "dark" })).toEqual(["dark-side"]);
    expect(evaluateThemeBadges({ theme: "light" })).toEqual([]);
    expect(evaluateThemeBadges({})).toEqual([]);
  });
});

describe("evaluateRideRequestBadges", () => {
  it("awards nothing with no history", () => {
    expect(evaluateRideRequestBadges({ rideRequests: [], offeredRides: [], bookedRides: [] })).toEqual([]);
  });

  it("awards the rider request-count milestones off the raw count of requests, regardless of status", () => {
    const requests = (n, status) => Array(n).fill({ status });

    expect(evaluateRideRequestBadges({ rideRequests: requests(1, "expired") })).toContain("first-ride-requested");
    expect(evaluateRideRequestBadges({ rideRequests: requests(5, "canceled") })).toContain("five-rides-requested");
    expect(evaluateRideRequestBadges({ rideRequests: requests(10, "fulfilled") })).toContain("ten-rides-requested");
    expect(evaluateRideRequestBadges({ rideRequests: requests(25, "open") })).toContain("needy-rider");
    expect(evaluateRideRequestBadges({ rideRequests: requests(4, "open") })).not.toContain("five-rides-requested");
  });

  it("awards mountain-mover/carpool-hero/carpool-captain off rides fulfilled from a request", () => {
    const fulfillment = { source_request_id: "req-1" };
    const plainOffer = { driverId: "me" };

    expect(
      evaluateRideRequestBadges({ offeredRides: [fulfillment, plainOffer] })
    ).toEqual(expect.arrayContaining(["mountain-mover"]));
    expect(evaluateRideRequestBadges({ offeredRides: [plainOffer] })).not.toContain("mountain-mover");
    expect(evaluateRideRequestBadges({ offeredRides: Array(5).fill(fulfillment) })).toContain("carpool-hero");
    expect(evaluateRideRequestBadges({ offeredRides: Array(10).fill(fulfillment) })).toContain("carpool-captain");
  });

  it("awards quick-draw only within 15 minutes of the request being posted", () => {
    const fast = { source_request_id: "req-1", request_response_minutes: 15 };
    const slow = { source_request_id: "req-2", request_response_minutes: 16 };

    expect(evaluateRideRequestBadges({ offeredRides: [fast] })).toContain("quick-draw");
    expect(evaluateRideRequestBadges({ offeredRides: [slow] })).not.toContain("quick-draw");
  });

  it("awards down-to-the-wire only within the last hour before expiry", () => {
    const barely = { source_request_id: "req-1", request_minutes_until_expiry: 60 };
    const early = { source_request_id: "req-2", request_minutes_until_expiry: 61 };

    expect(evaluateRideRequestBadges({ offeredRides: [barely] })).toContain("down-to-the-wire");
    expect(evaluateRideRequestBadges({ offeredRides: [early] })).not.toContain("down-to-the-wire");
  });

  it("awards rescue-squad for three distinct requesters, not three requests from one rider", () => {
    const threeDistinct = ["rider-1", "rider-2", "rider-3"].map((id) => ({
      source_request_id: `req-${id}`,
      source_requester_id: id,
    }));
    const sameRiderThrice = Array(3).fill({ source_request_id: "req-x", source_requester_id: "rider-1" });

    expect(evaluateRideRequestBadges({ offeredRides: threeDistinct })).toContain("rescue-squad");
    expect(evaluateRideRequestBadges({ offeredRides: sameRiderThrice })).not.toContain("rescue-squad");
  });

  it("awards repeat-fulfiller when the same rider is fulfilled three times", () => {
    const sameRiderThrice = Array(3).fill({ source_request_id: "req-x", source_requester_id: "rider-1" });
    const threeDistinct = ["rider-1", "rider-2", "rider-3"].map((id) => ({
      source_request_id: `req-${id}`,
      source_requester_id: id,
    }));

    expect(evaluateRideRequestBadges({ offeredRides: sameRiderThrice })).toContain("repeat-fulfiller");
    expect(evaluateRideRequestBadges({ offeredRides: threeDistinct })).not.toContain("repeat-fulfiller");
  });

  it("awards rolling-with-it when a changed fulfillment booking wasn't canceled", () => {
    const keptChanged = { request_changed: true, booking_status: "booked" };
    const canceledChanged = { request_changed: true, booking_status: "canceled" };
    const unchanged = { request_changed: false, booking_status: "booked" };

    expect(evaluateRideRequestBadges({ bookedRides: [keptChanged] })).toContain("rolling-with-it");
    expect(evaluateRideRequestBadges({ bookedRides: [canceledChanged] })).not.toContain("rolling-with-it");
    expect(evaluateRideRequestBadges({ bookedRides: [unchanged] })).not.toContain("rolling-with-it");
  });
});
