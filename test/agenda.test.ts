import { describe, expect, it } from "vitest";
import { collectAgenda, expandTimetable } from "../src/agenda.js";
import { MemoryRepo } from "../src/memory-repo.js";

describe("agenda", () => {
  it("expands standing timetable onto matching weekdays", () => {
    const slots = [
      {
        id: 1,
        childId: 1,
        organisationId: 4,
        title: "數學補習",
        weekday: 1,
        startTime: "16:30",
        endTime: "18:00",
        location: "數學補習",
        itemsToBring: ["功課冊"],
        notes: null,
      },
    ];
    // 23 Mar 2026 is Monday
    const items = expandTimetable(slots, "2026-03-23", "2026-03-29");
    expect(items).toHaveLength(1);
    expect(items[0]?.ymd).toBe("2026-03-23");
    expect(items[0]?.itemsToBring).toContain("功課冊");
  });

  it("merges saved events with timetable", async () => {
    const repo = new MemoryRepo();
    repo.seedDemoFamily();
    await repo.createEvent(
      {
        noticeId: null,
        organisationId: 3,
        title: "學校旅行",
        startAt: "2026-03-21T00:00:00+08:00",
        endAt: null,
        location: "海洋公園",
        type: "trip",
        itemsToBring: ["白鞋"],
        uniform: null,
        notes: null,
        childIds: [2],
      },
      "2026-03-01T00:00:00Z",
    );
    const { items } = await collectAgenda(repo, "2026-03-21", "2026-03-23");
    expect(items.some((item) => item.title.includes("旅行"))).toBe(true);
    expect(items.some((item) => item.title.includes("數學補習") && item.ymd === "2026-03-23")).toBe(true);
  });
});
