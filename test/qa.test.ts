import { describe, expect, it } from "vitest";
import { buildQaContext, looksLikeAgendaQuery } from "../src/qa.js";

describe("Q&A helpers", () => {
  it("detects bilingual agenda questions", () => {
    expect(looksLikeAgendaQuery("Tomorrow what special activities?")).toBe("tomorrow");
    expect(looksLikeAgendaQuery("明天帶咩")).toBe("tomorrow");
    expect(looksLikeAgendaQuery("今日有無活動")).toBe("today");
    expect(looksLikeAgendaQuery("any reply slips this week?")).toBe("slips");
    expect(looksLikeAgendaQuery("未來一星期")).toBe("week");
    expect(looksLikeAgendaQuery("when is the next school trip?")).toBeNull();
  });

  it("grounds the model in stored events only", () => {
    const context = buildQaContext(
      "豬2 Monday bring what?",
      [
        {
          ymd: "2026-03-23",
          childIds: [2],
          title: "英文補習",
          time: "16:30",
          location: "英文補習",
          itemsToBring: ["英文書"],
          notes: null,
          source: "timetable",
        },
      ],
      [],
      [{ id: 2, name: "豬2", nickname: "Pig2", grade: null }],
      [],
    );
    expect(context).toContain("Answer only from this family calendar");
    expect(context).toContain("英文書");
    expect(context).toContain("豬2 Monday bring what?");
  });
});
