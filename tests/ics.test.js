import { describe, expect, it } from "vitest";
import { buildIcsCalendar, googleCalendarUrl } from "@/lib/ics";

const baseEvent = {
  uid: "ride-abc123@mhspride.com",
  title: "MHSPRide: Sandy → Timberline",
  description: "Driver: Jamie\nBring a shovel, please",
  location: "Sandy Park & Ride",
  start: new Date("2026-02-10T06:00:00.000Z"),
  end: new Date("2026-02-10T16:00:00.000Z"),
};

describe("buildIcsCalendar", () => {
  it("produces a well-formed VEVENT with the expected fields", () => {
    const ics = buildIcsCalendar(baseEvent);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:ride-abc123@mhspride.com");
    expect(ics).toContain("DTSTART:20260210T060000Z");
    expect(ics).toContain("DTEND:20260210T160000Z");
    expect(ics).toContain("SUMMARY:MHSPRide: Sandy → Timberline");
    expect(ics).toContain("LOCATION:Sandy Park & Ride");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("escapes commas, semicolons, and newlines in free text", () => {
    const ics = buildIcsCalendar({
      ...baseEvent,
      description: "Line one\nLine two; with a comma, here",
    });
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two\\; with a comma\\, here");
  });

  it("omits DESCRIPTION and LOCATION lines when not provided", () => {
    const ics = buildIcsCalendar({ ...baseEvent, description: "", location: "" });
    expect(ics).not.toContain("DESCRIPTION:");
    expect(ics).not.toContain("LOCATION:");
  });

  it("folds lines longer than 75 octets with a leading space continuation", () => {
    const longSummary = "A".repeat(120);
    const ics = buildIcsCalendar({ ...baseEvent, title: longSummary });
    const rawLines = ics.split("\r\n");
    const summaryLine = rawLines.find(l => l.startsWith("SUMMARY:"));
    const continuationLine = rawLines[rawLines.indexOf(summaryLine) + 1];
    expect(summaryLine.length).toBeLessThanOrEqual(75);
    expect(continuationLine.startsWith(" ")).toBe(true);
  });
});

describe("googleCalendarUrl", () => {
  it("builds a calendar.google.com render link with UTC dates", () => {
    const url = googleCalendarUrl(baseEvent);
    expect(url.startsWith("https://calendar.google.com/calendar/render?")).toBe(true);
    const params = new URL(url).searchParams;
    expect(params.get("action")).toBe("TEMPLATE");
    expect(params.get("text")).toBe(baseEvent.title);
    expect(params.get("dates")).toBe("20260210T060000Z/20260210T160000Z");
    expect(params.get("location")).toBe(baseEvent.location);
  });
});
