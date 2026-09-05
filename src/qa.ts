import type { AgendaItem } from "./format.js";
import { namesForChildIds } from "./format.js";
import type { Child, Task } from "./types.js";

export function buildQaContext(
  question: string,
  items: AgendaItem[],
  tasks: Task[],
  children: Child[],
  noticeSnippets: string[],
): string {
  const agendaLines = items.slice(0, 40).map((item) => {
    const kids = namesForChildIds(item.childIds, children);
    const bring = item.itemsToBring.length ? `; bring ${item.itemsToBring.join(", ")}` : "";
    return `- ${item.ymd} ${item.time ?? ""} ${kids}: ${item.title}${item.location ? ` @ ${item.location}` : ""}${bring}`;
  });
  const taskLines = tasks.slice(0, 20).map((task) => `- ${task.title}${task.dueAt ? ` due ${task.dueAt.slice(0, 10)}` : ""}`);
  const notices = noticeSnippets.filter(Boolean).slice(0, 5);
  return [
    "Answer only from this family calendar. If it is not here, say exactly: I'm not sure.",
    "Always reply in English, even if the question or notice is Chinese.",
    "Read Traditional Chinese and Cantonese notices; translate names, dates, and items into English.",
    "Keep it short. Do not reply in Chinese.",
    "",
    `Question: ${question}`,
    "",
    "Upcoming items:",
    agendaLines.join("\n") || "- none",
    "",
    "Open tasks:",
    taskLines.join("\n") || "- none",
    notices.length ? `\nNotice text:\n${notices.join("\n---\n")}` : "",
  ].join("\n");
}

export function looksLikeAgendaQuery(text: string): "today" | "tomorrow" | "week" | "slips" | null {
  const t = text.toLowerCase();
  if (/slip|回條|payment|交錢|交費/.test(t)) return "slips";
  if (/tomorrow|聽日|明天|翌日/.test(t)) return "tomorrow";
  if (/today|今日|今天/.test(t)) return "today";
  if (/week|今個星期|本週|未來一星期|七日/.test(t)) return "week";
  return null;
}
