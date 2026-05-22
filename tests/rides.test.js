import { describe, expect, it } from "vitest";
import {
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
