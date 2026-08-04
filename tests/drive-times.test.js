import { describe, expect, it, vi, beforeEach } from "vitest";

const driveTimeDocs = {
  "powell-butte": { timberline: 69 },
  "buzz-bowman-center": { "buzz-bowman": 0 },
  "sandy-fred-meyer": { timberline: 44 },
};

vi.mock("@/lib/firebaseClient", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  doc: (_db, _collection, id) => ({ id }),
  getDoc: async (ref) => ({
    exists: () => ref.id in driveTimeDocs,
    data: () => driveTimeDocs[ref.id],
  }),
}));

describe("drive time estimates", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns configured drive minutes for known pickup and destination pairs", async () => {
    const { getDriveMinutes } = await import("@/lib/drive-times");
    expect(await getDriveMinutes("powell-butte", "timberline")).toBe(69);
    expect(await getDriveMinutes("buzz-bowman-center", "buzz-bowman")).toBe(0);
  });

  it("returns null for unknown routes instead of guessing", async () => {
    const { getDriveMinutes } = await import("@/lib/drive-times");
    expect(await getDriveMinutes("unknown", "timberline")).toBeNull();
    expect(await getDriveMinutes("powell-butte", "unknown")).toBeNull();
  });

  it("estimates arrival time using the fetched drive-time entry", async () => {
    const { estimateArrival } = await import("@/lib/drive-times");
    expect(await estimateArrival("06:00", "powell-butte", "timberline")).toBe("07:09");
    expect(await estimateArrival("23:30", "sandy-fred-meyer", "timberline")).toBe("00:14");
  });

  it("does not estimate when the route or departure time is missing", async () => {
    const { estimateArrival } = await import("@/lib/drive-times");
    expect(await estimateArrival("", "powell-butte", "timberline")).toBeNull();
    expect(await estimateArrival("06:00", "powell-butte", "unknown")).toBeNull();
  });
});

describe("addMinutesToTime", () => {
  it("adds minutes within the same day", async () => {
    const { addMinutesToTime } = await import("@/lib/drive-times");
    expect(addMinutesToTime("06:00", 69)).toBe("07:09");
  });

  it("wraps past midnight", async () => {
    const { addMinutesToTime } = await import("@/lib/drive-times");
    expect(addMinutesToTime("23:30", 44)).toBe("00:14");
  });

  it("returns null when time or minutes is missing", async () => {
    const { addMinutesToTime } = await import("@/lib/drive-times");
    expect(addMinutesToTime("", 44)).toBeNull();
    expect(addMinutesToTime("06:00", null)).toBeNull();
  });
});
