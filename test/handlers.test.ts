import { describe, expect, it } from "vitest";
import { handleScheduled, handleUpdate } from "../src/handlers.js";
import { callbackUpdate, photoUpdate, testDeps, textUpdate } from "./helpers.js";

describe("telegram handlers", () => {
  it("answers /whoami even for strangers", async () => {
    const { deps, telegram } = testDeps();
    await handleUpdate(deps, textUpdate(999, "/whoami"));
    expect(telegram.lastText()).toContain("999");
  });

  it("rejects unknown users for other commands", async () => {
    const { deps, telegram } = testDeps();
    await handleUpdate(deps, textUpdate(999, "/today"));
    expect(telegram.lastText()).toMatch(/private|allowlist/i);
  });

  it("lists kids and timetable", async () => {
    const { deps, telegram } = testDeps();
    await handleUpdate(deps, textUpdate(111, "/kids"));
    expect(telegram.lastText()).toContain("豬1");
    await handleUpdate(deps, textUpdate(111, "/timetable"));
    expect(telegram.lastText()).toContain("數學補習");
  });

  it("adds a school with button flow", async () => {
    const { deps, repo, telegram } = testDeps();
    await handleUpdate(deps, textUpdate(111, "/addschool 黃埔數學"));
    expect(telegram.lastText()).toContain("黃埔數學");
    await handleUpdate(deps, callbackUpdate(111, "as:tutorial"));
    await handleUpdate(deps, callbackUpdate(111, "ak:1"));
    const orgs = await repo.listOrganisations();
    expect(orgs.some((org) => org.name === "黃埔數學" && org.type === "tutorial")).toBe(true);
  });

  it("ingests a photo, tags 豬2, and saves events", async () => {
    const { deps, repo, telegram } = testDeps();
    await handleUpdate(deps, photoUpdate(111));
    const draftId = [...repo.drafts.keys()][0];
    expect(draftId).toBeTruthy();
    expect(telegram.texts().join("\n")).toContain("Ocean Park");
    await handleUpdate(deps, callbackUpdate(111, `k:${draftId}:2`));
    await handleUpdate(deps, callbackUpdate(111, `s:${draftId}`));
    const events = await repo.listEventsBetween("2026-03-21", "2026-03-21");
    expect(events).toHaveLength(1);
    expect(events[0]?.childIds).toEqual([2]);
    expect(events[0]?.itemsToBring).toContain("白鞋");
    const tasks = await repo.listOpenTasks();
    expect(tasks.length).toBeGreaterThanOrEqual(2);
  });

  it("marks a slip done from /slips", async () => {
    const { deps, repo, telegram } = testDeps();
    await repo.createTask(
      { eventId: null, title: "簽回條", dueAt: "2026-03-20T00:00:00+08:00", assigneeRole: "parent" },
      "2026-03-01T00:00:00Z",
    );
    await handleUpdate(deps, textUpdate(111, "/slips"));
    expect(telegram.lastText()).toContain("簽回條");
    await handleUpdate(deps, callbackUpdate(111, "t:1"));
    expect((await repo.listOpenTasks()).length).toBe(0);
  });

  it("sends scheduled parent digest only once per day", async () => {
    const { deps, repo, telegram } = testDeps({ now: new Date("2026-03-20T04:00:00Z") });
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
    await handleScheduled(deps, "0 12 * * *");
    await handleScheduled(deps, "0 12 * * *");
    const parentMessages = telegram.sent.filter((item) => item.chatId === 111 || item.chatId === 222);
    expect(parentMessages.length).toBe(2); // admin + partner, not doubled
    expect(parentMessages[0]?.text).toContain("學校旅行");
  });
});
