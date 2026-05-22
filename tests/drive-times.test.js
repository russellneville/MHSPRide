import { describe, expect, it } from "vitest";
import { estimateArrival, getDriveMinutes } from "@/lib/drive-times";

describe("drive time estimates", () => {
  it("returns configured drive minutes for known pickup and destination pairs", () => {
    expect(getDriveMinutes("powell-butte", "timberline")).toBe(69);
    expect(getDriveMinutes("buzz-bowman-center", "buzz-bowman")).toBe(0);
  });

  it("returns null for unknown routes instead of guessing", () => {
    expect(getDriveMinutes("unknown", "timberline")).toBeNull();
    expect(getDriveMinutes("powell-butte", "unknown")).toBeNull();
  });

  it("estimates arrival time using the static drive-time matrix", () => {
    expect(estimateArrival("06:00", "powell-butte", "timberline")).toBe("07:09");
    expect(estimateArrival("23:30", "sandy-fred-meyer", "timberline")).toBe("00:14");
  });

  it("does not estimate when the route or departure time is missing", () => {
    expect(estimateArrival("", "powell-butte", "timberline")).toBeNull();
    expect(estimateArrival("06:00", "powell-butte", "unknown")).toBeNull();
  });
});
