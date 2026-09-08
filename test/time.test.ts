import { describe, expect, it } from "vitest";
import { addDays, combineDateTime, hkWeekday, hkYmd, weekdayOfYmd } from "../src/time.js";

describe("Hong Kong time helpers", () => {
  it("formats a known UTC instant as the HK calendar date", () => {
    // 20 Mar 2026 18:00 UTC is already 21 Mar 2026 02:00 HKT
    const date = new Date("2026-03-20T18:00:00Z");
    expect(hkYmd(date)).toBe("2026-03-21");
    expect(hkWeekday(date)).toBe(6);
  });

  it("adds calendar days", () => {
    expect(addDays("2026-03-20", 1)).toBe("2026-03-21");
    expect(addDays("2026-03-31", 1)).toBe("2026-04-01");
  });

  it("reports weekday for a ymd as UTC noon", () => {
    expect(weekdayOfYmd("2026-03-21")).toBe(6);
    expect(weekdayOfYmd("2026-03-23")).toBe(1);
  });

  it("combines HK date and time", () => {
    expect(combineDateTime("2026-03-21", "16:30")).toBe("2026-03-21T16:30:00+08:00");
    expect(combineDateTime("2026-03-21", null)).toBe("2026-03-21T00:00:00+08:00");
    expect(combineDateTime(null, "16:30")).toBeNull();
  });
});
