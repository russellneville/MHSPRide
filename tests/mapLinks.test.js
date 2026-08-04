import { describe, expect, it } from "vitest";
import { mapsPinUrl, mapsDirectionsUrl, staticMapPreviewUrl } from "@/lib/mapLinks";

describe("mapsPinUrl", () => {
  it("builds a pin link from lat/lng when present", () => {
    expect(mapsPinUrl({ lat: 45.5, lng: -122.6 })).toBe(
      "https://www.google.com/maps/search/?api=1&query=45.5%2C-122.6"
    );
  });

  it("falls back to the address string when coords are missing", () => {
    expect(mapsPinUrl({ address: "123 Main St, Portland, OR" })).toBe(
      "https://www.google.com/maps/search/?api=1&query=123%20Main%20St%2C%20Portland%2C%20OR"
    );
  });

  it("prefers coords over address when both are present", () => {
    expect(mapsPinUrl({ lat: 1, lng: 2, address: "ignored" })).toContain("query=1%2C2");
  });

  it("returns null when there's nothing to link to", () => {
    expect(mapsPinUrl({})).toBeNull();
    expect(mapsPinUrl()).toBeNull();
  });
});

describe("mapsDirectionsUrl", () => {
  it("builds an origin+destination driving directions link from coords", () => {
    const url = mapsDirectionsUrl({ lat: 45.5, lng: -122.6 }, { lat: 45.3, lng: -121.7 });
    expect(url).toBe(
      "https://www.google.com/maps/dir/?api=1&origin=45.5%2C-122.6&destination=45.3%2C-121.7&travelmode=driving"
    );
  });

  it("falls back to address strings when coords are missing on either side", () => {
    const url = mapsDirectionsUrl({ address: "Origin Ave" }, { lat: 1, lng: 2 });
    expect(url).toContain("origin=Origin%20Ave");
    expect(url).toContain("destination=1%2C2");
  });

  it("returns null when either endpoint has nothing to link to", () => {
    expect(mapsDirectionsUrl({}, { lat: 1, lng: 2 })).toBeNull();
    expect(mapsDirectionsUrl({ lat: 1, lng: 2 }, {})).toBeNull();
  });
});

describe("staticMapPreviewUrl", () => {
  it("returns null with no origin coords — nothing to render", () => {
    expect(staticMapPreviewUrl({})).toBeNull();
    expect(staticMapPreviewUrl()).toBeNull();
    expect(staticMapPreviewUrl({ origin: { address: "no coords" } })).toBeNull();
  });

  it("builds an origin-only preview URL (pin thumbnail) — never includes destination params", () => {
    const url = staticMapPreviewUrl({ origin: { lat: 45.5, lng: -122.6 }, destination: { lat: 45.3, lng: -121.7 } });
    const params = new URLSearchParams(url.split("?")[1]);
    expect(url.startsWith("/api/static-map?")).toBe(true);
    expect(params.get("originLat")).toBe("45.5");
    expect(params.get("originLng")).toBe("-122.6");
    expect(params.has("destLat")).toBe(false);
    expect(params.has("destLng")).toBe(false);
    expect(params.get("width")).toBe("320");
    expect(params.get("height")).toBe("160");
  });

  it("respects custom width/height", () => {
    const url = staticMapPreviewUrl({ origin: { lat: 45.5, lng: -122.6 }, width: 600, height: 300 });
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("width")).toBe("600");
    expect(params.get("height")).toBe("300");
  });
});
