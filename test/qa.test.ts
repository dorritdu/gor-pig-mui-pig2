import { describe, expect, it } from "vitest";
import { answerFromCalendar, buildQaContext, looksLikeAgendaQuery } from "../src/qa.js";

describe("Q&A helpers", () => {
  it("detects bilingual agenda questions", () => {
    expect(looksLikeAgendaQuery("Tomorrow what special activities?")).toBe("tomorrow");
    expect(looksLikeAgendaQuery("明天帶咩")).toBe("tomorrow");
    expect(looksLikeAgendaQuery("今日有無活動")).toBe("today");
    expect(looksLikeAgendaQuery("any reply slips this week?")).toBe("slips");
    expect(looksLikeAgendaQuery("未來一星期")).toBe("week");
    expect(looksLikeAgendaQuery("when is the next school trip?")).toBeNull();
  });

  it("answers in English from saved events when the LLM is down", () => {
    const text = answerFromCalendar(
      "What does pig2 need to bring?",
      [
        {
          ymd: "2026-03-21",
          childIds: [2],
          title: "School picnic",
          time: null,
          location: "Ocean Park",
          itemsToBring: ["white shoes", "water"],
          notes: null,
          source: "event",
        },
      ],
      [],
      [{ id: 2, name: "豬2", nickname: "Pig2", grade: null }],
    );
    expect(text).toContain("School picnic");
    expect(text).toContain("white shoes");
    expect(text).not.toMatch(/不確定|我不能/);
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
    expect(context).toContain("Always reply in English");
    expect(context).not.toContain("same language as the question");
    expect(context).toContain("英文書");
    expect(context).toContain("豬2 Monday bring what?");
  });
});
