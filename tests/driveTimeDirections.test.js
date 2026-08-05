import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { estimateDriveMinutes } from "@/lib/driveTimeDirections";

describe("estimateDriveMinutes", () => {
  const originalKey = process.env.GOOGLE_MAPS_API_KEY;

  beforeEach(() => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.GOOGLE_MAPS_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  it("throws when GOOGLE_MAPS_API_KEY is not set", async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    await expect(estimateDriveMinutes({ lat: 1, lng: 2 }, { lat: 3, lng: 4 })).rejects.toThrow(
      "GOOGLE_MAPS_API_KEY is not set"
    );
  });

  it("returns rounded minutes from a successful route", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: "OK",
        routes: [{ legs: [{ duration: { value: 4130 } }] }], // 68.8 minutes
      }),
    })));
    const minutes = await estimateDriveMinutes({ lat: 45.5, lng: -122.6 }, { lat: 45.3, lng: -121.7 });
    expect(minutes).toBe(69);
  });

  it("returns null (not an error) when there's no drivable route", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: "ZERO_RESULTS", routes: [] }),
    })));
    const minutes = await estimateDriveMinutes({ lat: 45.5, lng: -122.6 }, { lat: 0, lng: 0 });
    expect(minutes).toBeNull();
  });

  it("throws for a real API failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: "REQUEST_DENIED" }),
    })));
    await expect(estimateDriveMinutes({ lat: 1, lng: 2 }, { lat: 3, lng: 4 })).rejects.toThrow(
      /REQUEST_DENIED/
    );
  });
});
