import { describe, expect, it } from "vitest";
import {
  canCancelBooking,
  computeRideStatus,
  getAvailableSeatsAfterBooking,
  getBookedSeatCount,
  hasActiveSameDayBooking,
  isCanceledStatus,
  normalizeStatus,
} from "@/lib/rides";

const baseRide = {
  departure_date: "2026-02-10",
  departure_time: "06:00",
  arrival_time: "07:15",
  available_seats: 2,
  total_seats: 4,
  ride_status: "not started",
};

describe("ride status rules", () => {
  it("normalizes legacy canceled status spelling", () => {
    expect(normalizeStatus("cancled")).toBe("canceled");
    expect(isCanceledStatus("cancled")).toBe(true);
    expect(isCanceledStatus("booked")).toBe(false);
  });

  it("marks future rides open while seats remain", () => {
    expect(computeRideStatus(baseRide, new Date("2026-02-10T05:59:00"))).toBe("open");
  });

  it("marks future rides full when no seats remain", () => {
    expect(
      computeRideStatus(
        { ...baseRide, available_seats: 0 },
        new Date("2026-02-10T05:59:00")
      )
    ).toBe("full");
  });

  it("marks rides in progress between departure and arrival", () => {
    expect(computeRideStatus(baseRide, new Date("2026-02-10T06:30:00"))).toBe("in_progress");
  });

  it("marks rides completed after arrival", () => {
    expect(computeRideStatus(baseRide, new Date("2026-02-10T07:16:00"))).toBe("completed");
  });

  it("uses a four-hour fallback window when arrival time is missing", () => {
    const ride = { ...baseRide, arrival_time: "" };
    expect(computeRideStatus(ride, new Date("2026-02-10T09:59:00"))).toBe("in_progress");
    expect(computeRideStatus(ride, new Date("2026-02-10T10:01:00"))).toBe("completed");
  });

  it("keeps canceled rides canceled regardless of time or seats", () => {
    const ride = { ...baseRide, ride_status: "canceled", available_seats: 4 };
    expect(computeRideStatus(ride, new Date("2026-02-10T05:00:00"))).toBe("canceled");
  });

  it("stays in progress past the outbound arrival for round trips, until the return departure", () => {
    const ride = { ...baseRide, one_way: false, return_departure_time: "16:00" };
    expect(computeRideStatus(ride, new Date("2026-02-10T07:16:00"))).toBe("in_progress");
    expect(computeRideStatus(ride, new Date("2026-02-10T15:59:00"))).toBe("in_progress");
    expect(computeRideStatus(ride, new Date("2026-02-10T16:01:00"))).toBe("completed");
  });

  it("uses arrival time (not return departure) for one-way rides", () => {
    const ride = { ...baseRide, one_way: true, return_departure_time: "16:00" };
    expect(computeRideStatus(ride, new Date("2026-02-10T07:16:00"))).toBe("completed");
  });
});

describe("booking safety helpers", () => {
  it("detects same-day active booking conflicts and ignores canceled bookings", () => {
    const bookings = [
      { departure_date: "2026-02-10", booking_status: "canceled" },
      { departure_date: "2026-02-11", booking_status: "booked" },
    ];

    expect(hasActiveSameDayBooking(bookings, "2026-02-10")).toBe(false);
    expect(hasActiveSameDayBooking(bookings, "2026-02-11")).toBe(true);
  });

  it("calculates booked and remaining seats without writing external data", () => {
    expect(getBookedSeatCount(baseRide)).toBe(2);
    expect(getAvailableSeatsAfterBooking(baseRide, 2)).toBe(0);
  });
});

describe("passenger self-cancel cutoff", () => {
  const booking = {
    departure_date: "2026-02-10",
    departure_time: "18:00",
    booking_status: "booked",
  };

  it("allows cancellation well before the 12h cutoff", () => {
    expect(canCancelBooking(booking, new Date("2026-02-10T05:00:00"))).toBe(true);
  });

  it("blocks cancellation inside the 12h cutoff window", () => {
    expect(canCancelBooking(booking, new Date("2026-02-10T07:00:00"))).toBe(false);
  });

  it("treats exactly 12h before departure as the cutoff boundary", () => {
    expect(canCancelBooking(booking, new Date("2026-02-10T06:00:00"))).toBe(false);
    expect(canCancelBooking(booking, new Date("2026-02-10T05:59:59"))).toBe(true);
  });

  it("blocks cancellation for an already-canceled booking", () => {
    expect(
      canCancelBooking({ ...booking, booking_status: "canceled" }, new Date("2026-02-10T05:00:00"))
    ).toBe(false);
  });

  it("blocks cancellation when departure_date is missing", () => {
    expect(canCancelBooking({ booking_status: "booked" })).toBe(false);
  });
});
