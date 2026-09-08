import { describe, expect, it } from "vitest";
import { buildExtractPrompt, looksLikeNotice, matchOrganisation, parseExtractJson } from "../src/extract.js";
import { PICNIC_EXTRACT_JSON, PICNIC_NOTICE_TEXT } from "./fixtures/picnic-notice.js";

describe("extract JSON parsing", () => {
  it("parses fenced Gemini JSON from a bilingual picnic circular", () => {
    const result = parseExtractJson(`Here you go:\n\`\`\`json\n${PICNIC_EXTRACT_JSON}\n\`\`\``);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.title).toMatch(/旅行|Picnic/);
    expect(result.events[0]?.startDate).toBe("2026-03-21");
    expect(result.events[0]?.itemsToBring).toContain("白鞋");
    expect(result.events[0]?.tasks.map((task) => task.title).join(" ")).toMatch(/120|回條/);
  });

  it("rejects non-JSON", () => {
    expect(() => parseExtractJson("sorry I cannot")).toThrow(/JSON/);
  });

  it("matches organisation names", () => {
    const orgs = [
      { id: 3, name: "學校 C", type: "school" as const, notes: null },
      { id: 5, name: "英文補習", type: "tutorial" as const, notes: null },
    ];
    expect(matchOrganisation("學校 C", orgs)).toBe(3);
    expect(matchOrganisation("英文", orgs)).toBe(5);
    expect(matchOrganisation("unknown", orgs)).toBeNull();
  });

  it("treats bilingual circulars as notices, not short questions", () => {
    expect(looksLikeNotice(PICNIC_NOTICE_TEXT)).toBe(true);
    expect(looksLikeNotice("豬2 tomorrow bring what?")).toBe(false);
    expect(looksLikeNotice("any reply slips this week?")).toBe(false);
  });

  it("includes family kids in the extract prompt", () => {
    const prompt = buildExtractPrompt(
      [{ id: 1, name: "豬1", nickname: "Pig1", grade: null }],
      [{ id: 1, name: "學校 A", type: "school", notes: null }],
    );
    expect(prompt).toContain("豬1");
    expect(prompt).toContain("學校 A");
    expect(prompt).toContain("MUST be English");
  });
});
