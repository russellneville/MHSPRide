import { describe, expect, it } from "vitest";
import { cn, formatTime, toLocalDateStr } from "@/lib/utils";

describe("utility formatting", () => {
  it("formats empty time values with the app placeholder", () => {
    expect(formatTime("")).toBe("—");
    expect(formatTime(null)).toBe("—");
  });

  it("formats 24-hour times as lowercase am/pm labels", () => {
    expect(formatTime("00:00")).toBe("12:00 am");
    expect(formatTime("09:05")).toBe("9:05 am");
    expect(formatTime("12:30")).toBe("12:30 pm");
    expect(formatTime("23:59")).toBe("11:59 pm");
  });

  it("converts dates to local YYYY-MM-DD without UTC shifting", () => {
    expect(toLocalDateStr(new Date(2026, 0, 2, 23, 30))).toBe("2026-01-02");
    expect(toLocalDateStr(null)).toBe("");
  });

  it("merges tailwind classes with later conflicting values winning", () => {
    expect(cn("px-2 text-sm", false && "hidden", "px-4")).toContain("px-4");
    expect(cn("px-2 text-sm", "px-4")).not.toContain("px-2");
  });
});
