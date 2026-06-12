import { describe, it, expect } from "vitest";
import { timeToMinutes, overlaps } from "../services/todayPreDayAfterDay";

describe("timeToMinutes", () => {
  it("converts 00:00 to 0", () => {
    expect(timeToMinutes("00:00")).toBe(0);
  });

  it("converts 09:00 to 540", () => {
    expect(timeToMinutes("09:00")).toBe(540);
  });

  it("converts 23:59 to 1439", () => {
    expect(timeToMinutes("23:59")).toBe(1439);
  });

  it("converts 12:30 to 750", () => {
    expect(timeToMinutes("12:30")).toBe(750);
  });
});

describe("overlaps", () => {
  // Intervals are half-open: [start, start+est)

  it("detects direct overlap", () => {
    // A: 540–600, B: 570–630 — overlap at 570–600
    expect(overlaps(540, 60, 570, 60)).toBe(true);
  });

  it("detects B fully contained in A", () => {
    // A: 540–660, B: 560–580
    expect(overlaps(540, 120, 560, 20)).toBe(true);
  });

  it("detects adjacent (A ends where B starts) as non-overlapping", () => {
    // A: 540–600, B: 600–660 — touching edges do not overlap
    expect(overlaps(540, 60, 600, 60)).toBe(false);
  });

  it("detects non-overlapping intervals before", () => {
    // A: 540–600, B: 480–540
    expect(overlaps(540, 60, 480, 60)).toBe(false);
  });

  it("detects non-overlapping intervals after", () => {
    // A: 540–600, B: 620–680
    expect(overlaps(540, 60, 620, 60)).toBe(false);
  });

  it("detects same start time as overlap", () => {
    expect(overlaps(540, 30, 540, 30)).toBe(true);
  });
});
