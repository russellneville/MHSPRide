import { describe, expect, it } from "vitest";
import {
  ARRIVAL_LOCATIONS,
  DEFAULT_DESTINATION,
  LOCATIONS,
  getLocationName,
  resolveLocation,
} from "@/lib/locations";

describe("location registry", () => {
  it("keeps Timberline Lodge as the default destination", () => {
    expect(DEFAULT_DESTINATION).toBe("timberline-lodge");
    expect(getLocationName(DEFAULT_DESTINATION)).toBe("Timberline Lodge");
  });

  it("has unique pickup location ids", () => {
    const ids = LOCATIONS.map((location) => location.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has coordinates for every configured pickup and arrival location", () => {
    for (const location of [...LOCATIONS, ...ARRIVAL_LOCATIONS]) {
      expect(location.lat).toEqual(expect.any(Number));
      expect(location.lon).toEqual(expect.any(Number));
    }
  });

  it("resolves known pickup and arrival location ids", () => {
    expect(resolveLocation("powell-butte")).toBe("Powell Butte Park & Ride");
    expect(resolveLocation("summit-pass")).toBe("Summit Pass");
  });

  it("prettifies free-text slugs as a readable fallback", () => {
    expect(resolveLocation("custom-meeting-place")).toBe("Custom Meeting Place");
    expect(resolveLocation("")).toBe("");
  });
});
