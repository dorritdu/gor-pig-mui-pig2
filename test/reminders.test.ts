import { describe, expect, it } from "vitest";
import { MemoryRepo } from "../src/memory-repo.js";
import { buildReminderMessage, reminderKindFromCron, recipientsFor } from "../src/reminders.js";

describe("reminders", () => {
  it("maps UTC cron expressions to reminder kinds", () => {
    expect(reminderKindFromCron("0 12 * * *")).toBe("parent_evening");
    expect(reminderKindFromCron("0 23 * * *")).toBe("helper_morning");
    expect(reminderKindFromCron("0 0 * * 0")).toBe("week_ahead");
    expect(reminderKindFromCron("0 1 * * *")).toBeNull();
  });

  it("routes helper morning only to helpers", () => {
    const config = { timezone: "Asia/Hong_Kong", adminIds: [1], parentIds: [1, 2], helperIds: [9] };
    expect(recipientsFor("helper_morning", config)).toEqual([9]);
    expect(recipientsFor("parent_evening", config)).toEqual([1, 2]);
  });

  it("builds a parent tomorrow digest with items to bring and tasks", async () => {
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
        itemsToBring: ["白鞋", "水"],
        uniform: null,
        notes: "交 $120",
        childIds: [2],
      },
      "2026-03-01T00:00:00Z",
    );
    await repo.createTask(
      { eventId: 1, title: "簽回條", dueAt: "2026-03-20T00:00:00+08:00", assigneeRole: "parent" },
      "2026-03-01T00:00:00Z",
    );

    // 20 Mar 2026 12:00 HKT = 20 Mar 04:00 UTC, so "tomorrow" is 21 Mar.
    const message = await buildReminderMessage(
      repo,
      "parent_evening",
      new Date("2026-03-20T04:00:00Z"),
      "Asia/Hong_Kong",
    );
    expect(message).toContain("Tomorrow");
    expect(message).toContain("學校旅行");
    expect(message).toContain("白鞋");
    expect(message).toContain("簽回條");
  });

  it("keeps helper morning operational and omits parent fees", async () => {
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
        notes: "pay $120",
        childIds: [2],
      },
      "2026-03-01T00:00:00Z",
    );
    await repo.createTask(
      { eventId: 1, title: "交 $120", dueAt: "2026-03-20T00:00:00+08:00", assigneeRole: "parent" },
      "2026-03-01T00:00:00Z",
    );
    const message = await buildReminderMessage(
      repo,
      "helper_morning",
      new Date("2026-03-20T23:00:00Z"), // 21 Mar 07:00 HKT
      "Asia/Hong_Kong",
    );
    expect(message).toContain("Today pack list");
    expect(message).toContain("白鞋");
    expect(message).not.toContain("交 $120");
  });
});
