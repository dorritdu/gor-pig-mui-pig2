import { describe, expect, it } from "vitest";
import { handleScheduled, handleUpdate } from "../src/handlers.js";
import { PICNIC_NOTICE_TEXT } from "./fixtures/picnic-notice.js";
import { callbackUpdate, photoUpdate, testDeps, textUpdate } from "./helpers.js";

describe("end-to-end bilingual notice", () => {
  it("photo → confirm 豬2 → ask tomorrow → helper pack reminder", async () => {
    const now = new Date("2026-03-20T04:00:00Z"); // 20 Mar 12:00 HKT
    const { deps, repo, telegram } = testDeps({ now });

    await handleUpdate(deps, photoUpdate(111, "circular.jpg"));
    const draftId = [...repo.drafts.keys()][0];
    expect(telegram.texts().some((text) => /旅行|Picnic/.test(text))).toBe(true);

    await handleUpdate(deps, callbackUpdate(111, `k:${draftId}:2`));
    await handleUpdate(deps, callbackUpdate(111, `s:${draftId}`));
    expect(telegram.lastText()).toMatch(/Saved 1 event/);

    await handleUpdate(deps, textUpdate(111, "/tomorrow"));
    expect(telegram.lastText()).toContain("學校旅行");
    expect(telegram.lastText()).toContain("白鞋");

    await handleUpdate(deps, textUpdate(222, "豬2 tomorrow bring what?"));
    expect(telegram.lastText()).toMatch(/白鞋|Ocean Park|picnic/i);

    telegram.sent = [];
    const morning = testDeps({
      now: new Date("2026-03-20T23:00:00Z"),
      gemini: deps.gemini,
    });
    morning.repo.events = repo.events;
    morning.repo.tasks = repo.tasks;
    morning.repo.children = repo.children;
    await handleScheduled(morning.deps, "0 23 * * *");
    const helperNote = morning.telegram.sent.find((item) => item.chatId === 333);
    expect(helperNote?.text).toContain("白鞋");
    expect(helperNote?.text).toContain("豬2");
    expect(helperNote?.text).not.toContain("交 $120");
  });

  it("pasted circular text goes through extract + confirm, not Q&A", async () => {
    const { deps, repo, telegram } = testDeps();
    await handleUpdate(deps, textUpdate(111, PICNIC_NOTICE_TEXT));
    expect(repo.drafts.size).toBe(1);
    expect(telegram.texts().some((text) => /Save|豬2|Ocean Park|旅行/.test(text))).toBe(true);
    const draftId = [...repo.drafts.keys()][0];
    await handleUpdate(deps, callbackUpdate(111, `k:${draftId}:2`));
    await handleUpdate(deps, callbackUpdate(111, `s:${draftId}`));
    const notice = await repo.getNotice(1);
    expect(notice?.rawText).toContain("Ocean Park");
    expect(notice?.source).toBe("text");
  });
});
