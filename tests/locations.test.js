import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { LocationsProvider, useLocations } from "@/context/LocationsContext";

const fixtureDocs = [
  { id: "powell-butte", name: "Powell Butte Park & Ride", role: "origin", lat: 45.4947932, lon: -122.4966988 },
  { id: "summit-pass",  name: "Summit Pass",               role: "destination", lat: 45.3029059, lon: -121.7458283 },
];

vi.mock("@/lib/firebaseClient", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: (_db, name) => ({ name }),
  getDocs: async () => ({
    docs: fixtureDocs.map((d) => ({ id: d.id, data: () => d })),
  }),
}));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { uid: "test-uid" }, isLoading: false }),
}));

async function renderLocations() {
  const { result } = renderHook(() => useLocations(), { wrapper: LocationsProvider });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  return result;
}

describe("location registry", () => {
  it("splits fetched locations into origins and destinations", async () => {
    const result = await renderLocations();
    expect(result.current.origins.map((l) => l.id)).toEqual(["powell-butte"]);
    expect(result.current.destinations.map((l) => l.id)).toEqual(["summit-pass"]);
  });

  it("has coordinates for every fetched location", async () => {
    const result = await renderLocations();
    for (const location of [...result.current.origins, ...result.current.destinations]) {
      expect(location.lat).toEqual(expect.any(Number));
      expect(location.lon).toEqual(expect.any(Number));
    }
  });

  it("resolves known location ids to their names", async () => {
    const result = await renderLocations();
    expect(result.current.resolveLocation("powell-butte")).toBe("Powell Butte Park & Ride");
    expect(result.current.resolveLocation("summit-pass")).toBe("Summit Pass");
  });

  it("prettifies free-text slugs as a readable fallback", async () => {
    const result = await renderLocations();
    expect(result.current.resolveLocation("custom-meeting-place")).toBe("Custom Meeting Place");
    expect(result.current.resolveLocation("")).toBe("");
  });
});
