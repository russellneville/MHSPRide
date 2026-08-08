import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

vi.mock("@/lib/firebaseClient", () => ({
  auth: { currentUser: { getIdToken: async () => "test-token" } },
}));

const getDriveMinutesMock = vi.fn();
vi.mock("@/lib/drive-times", async () => {
  const actual = await vi.importActual("@/lib/drive-times");
  return { ...actual, getDriveMinutes: (...args) => getDriveMinutesMock(...args) };
});

async function loadHook(departureTime, origin, destination) {
  const { useEstimatedArrival } = await import("@/hooks/use-estimated-arrival");
  return renderHook(({ t, o, d }) => useEstimatedArrival(t, o, d), {
    initialProps: { t: departureTime, o: origin, d: destination },
  });
}

describe("useEstimatedArrival", () => {
  beforeEach(() => {
    vi.resetModules();
    getDriveMinutesMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("does not fetch when either endpoint is missing", async () => {
    const { result } = await loadHook("06:00", {}, { locationId: "timberline" });
    expect(result.current.arrivalTime).toBeNull();
    expect(getDriveMinutesMock).not.toHaveBeenCalled();
  });

  it("fetches drive time even without a departure time, but leaves arrivalTime null until one is set", async () => {
    getDriveMinutesMock.mockResolvedValue(69);

    const { result } = await loadHook("", { locationId: "powell-butte" }, { locationId: "timberline" });

    await waitFor(() => expect(result.current.driveMinutes).toBe(69));
    expect(result.current.arrivalTime).toBeNull();
  });

  it("uses the precomputed Firestore lookup for a predefined-to-predefined pair, without calling the live API", async () => {
    getDriveMinutesMock.mockResolvedValue(69);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { result } = await loadHook(
      "06:00",
      { locationId: "powell-butte", coords: { lat: 45.49, lng: -122.5 } },
      { locationId: "timberline", coords: { lat: 45.33, lng: -121.71 } }
    );

    await waitFor(() => expect(result.current.arrivalTime).toBe("07:09"));
    expect(getDriveMinutesMock).toHaveBeenCalledWith("powell-butte", "timberline");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("calls the live Directions API when either side is free text (has coords, no locationId)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ minutes: 69 }),
    })));

    const { result } = await loadHook(
      "06:00",
      { locationId: "powell-butte", coords: { lat: 45.49, lng: -122.5 } },
      { locationId: null, coords: { lat: 45.33, lng: -121.71 } }
    );

    await waitFor(() => expect(result.current.arrivalTime).toBe("07:09"));
    expect(getDriveMinutesMock).not.toHaveBeenCalled();
    expect(result.current.estimating).toBe(false);
  });

  it("sets estimating true while the live call is in flight", async () => {
    let resolveFetch;
    vi.stubGlobal("fetch", vi.fn(() => new Promise(resolve => { resolveFetch = resolve; })));

    const { result } = await loadHook(
      "06:00",
      { locationId: null, coords: { lat: 45.49, lng: -122.5 } },
      { locationId: null, coords: { lat: 45.33, lng: -121.71 } }
    );

    await waitFor(() => expect(result.current.estimating).toBe(true));
    resolveFetch({ ok: true, json: async () => ({ minutes: 30 }) });
    await waitFor(() => expect(result.current.estimating).toBe(false));
    expect(result.current.arrivalTime).toBe("06:30");
  });

  it("leaves arrival time unset (not an error) when there's no route", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ minutes: null }),
    })));

    const { result } = await loadHook(
      "06:00",
      { locationId: null, coords: { lat: 45.49, lng: -122.5 } },
      { locationId: null, coords: { lat: 0, lng: 0 } }
    );

    await waitFor(() => expect(result.current.estimating).toBe(false));
    expect(result.current.arrivalTime).toBeNull();
  });

  it("does not attempt an estimate when coords are missing on one side (e.g. a predefined location without lat/lon)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { result } = await loadHook(
      "06:00",
      { locationId: "some-location", coords: null },
      { locationId: null, coords: { lat: 45.33, lng: -121.71 } }
    );

    await waitFor(() => expect(result.current.arrivalTime).toBeNull());
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getDriveMinutesMock).not.toHaveBeenCalled();
  });

  it("retries a failed live call after a delay, then succeeds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("network blip"))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ minutes: 15 }) });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = await loadHook(
      "06:00",
      { locationId: null, coords: { lat: 45.49, lng: -122.5 } },
      { locationId: null, coords: { lat: 45.33, lng: -121.71 } }
    );

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(result.current.arrivalTime).toBe("06:15"));
  });
});
