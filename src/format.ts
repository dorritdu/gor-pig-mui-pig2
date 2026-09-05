import type { CalendarEvent, Child, ChildTag, DraftPayload, ExtractedEvent, Role, Task } from "./types.js";
import { formatYmdHuman, weekdayName } from "./time.js";

export function childLabel(child: Child): string {
  return `${child.name} / ${child.nickname}`;
}

export function childIdsFromTag(tag: ChildTag | null, guess: ExtractedEvent["childGuess"]): number[] {
  const mapped = tag ?? guessToTag(guess);
  if (mapped === "1") return [1];
  if (mapped === "2") return [2];
  if (mapped === "both") return [1, 2];
  return [];
}

export function guessToTag(guess: ExtractedEvent["childGuess"]): ChildTag | null {
  if (guess === "pig1") return "1";
  if (guess === "pig2") return "2";
  if (guess === "both") return "both";
  return null;
}

export function namesForChildIds(ids: number[], children: Child[]): string {
  if (!ids.length) return "unassigned";
  return ids
    .map((id) => children.find((child) => child.id === id))
    .filter((child): child is Child => Boolean(child))
    .map((child) => child.name)
    .join(" + ");
}

export function formatExtractedEvent(event: ExtractedEvent, index: number): string {
  const when = [event.startDate, event.startTime].filter(Boolean).join(" ");
  const lines = [
    `${index + 1}. ${event.title}${when ? ` — ${when}` : ""}`,
    event.location ? `   地點 / Place: ${event.location}` : null,
    event.itemsToBring.length ? `   要帶 / Bring: ${event.itemsToBring.join("、")}` : null,
    event.uniform ? `   校服 / Uniform: ${event.uniform}` : null,
    event.notes ? `   備註 / Notes: ${event.notes}` : null,
    event.tasks.length ? `   家長事項 / Parent tasks: ${event.tasks.map((task) => task.title).join("；")}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

export function formatDraftCard(payload: DraftPayload, children: Child[]): string {
  const tag = payload.childOverride;
  const childLine = tag
    ? `Child tag: ${tag === "both" ? "豬1 + 豬2" : tag === "1" ? "豬1" : "豬2"}`
    : "Child tag: not set (guess shown per event)";
  const events = payload.events.length
    ? payload.events.map((event, index) => formatExtractedEvent(event, index)).join("\n\n")
    : "No events found. You can discard this.";
  return [
    "I read this notice as:",
    payload.summary,
    "",
    childLine,
    "",
    events,
    "",
    "Tap a child, then Save — or Discard if this is not an event.",
  ].join("\n");
}

export interface AgendaItem {
  ymd: string;
  childIds: number[];
  title: string;
  time: string | null;
  location: string | null;
  itemsToBring: string[];
  notes: string | null;
  source: "event" | "timetable";
  type?: string;
}

export function formatAgenda(
  title: string,
  items: AgendaItem[],
  tasks: Task[],
  children: Child[],
  audience: Role | "parent" | "helper",
): string {
  if (!items.length && !tasks.length) {
    return `${title}\n\nNothing on the list.`;
  }
  const byChild = new Map<number, AgendaItem[]>();
  const unassigned: AgendaItem[] = [];
  for (const item of items) {
    if (!item.childIds.length) {
      unassigned.push(item);
      continue;
    }
    for (const childId of item.childIds) {
      const list = byChild.get(childId) ?? [];
      list.push(item);
      byChild.set(childId, list);
    }
  }

  const blocks: string[] = [title, ""];
  for (const child of children) {
    const rows = byChild.get(child.id) ?? [];
    if (!rows.length) continue;
    blocks.push(`${child.name} / ${child.nickname}`);
    for (const row of uniqueItems(rows)) {
      blocks.push(formatAgendaLine(row, audience));
    }
    blocks.push("");
  }
  if (unassigned.length) {
    blocks.push("Unassigned");
    for (const row of unassigned) blocks.push(formatAgendaLine(row, audience));
    blocks.push("");
  }

  const visibleTasks =
    audience === "helper"
      ? tasks.filter((task) => task.assigneeRole === "helper" || !task.assigneeRole)
      : tasks;
  if (visibleTasks.length && audience !== "helper") {
    blocks.push("Open tasks / 待辦");
    for (const task of visibleTasks) {
      const due = task.dueAt ? ` (due ${task.dueAt.slice(0, 10)})` : "";
      blocks.push(`• ${task.title}${due}`);
    }
  }
  return blocks.join("\n").trim();
}

function uniqueItems(items: AgendaItem[]): AgendaItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.ymd}|${item.title}|${item.time}|${item.location}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatAgendaLine(item: AgendaItem, audience: Role | "parent" | "helper"): string {
  const time = item.time ? ` ${item.time}` : "";
  const place = item.location ? ` @ ${item.location}` : "";
  const bring = item.itemsToBring.length ? ` — bring ${item.itemsToBring.join("、")}` : "";
  const extra = audience === "helper" ? "" : item.notes ? ` (${item.notes})` : "";
  return `• ${item.ymd}${time} ${item.title}${place}${bring}${extra}`;
}

export function formatWeekList(items: AgendaItem[], children: Child[]): string {
  if (!items.length) return "Nothing in the next 7 days.";
  const lines = ["Next 7 days / 未來一星期", ""];
  const days = [...new Set(items.map((item) => item.ymd))].sort();
  for (const ymd of days) {
    lines.push(formatYmdHuman(ymd));
    for (const item of items.filter((row) => row.ymd === ymd)) {
      lines.push(`  ${namesForChildIds(item.childIds, children)}: ${item.time ?? ""} ${item.title}`.replace(/\s+/g, " ").trim());
      if (item.itemsToBring.length) lines.push(`    bring: ${item.itemsToBring.join("、")}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

export function formatKids(children: Child[]): string {
  return ["Kids / 小朋友", ...children.map((child) => `• ${child.id}. ${childLabel(child)}${child.grade ? ` (${child.grade})` : ""}`)].join(
    "\n",
  );
}

export function formatTimetable(slots: import("./types.js").TimetableSlot[], children: Child[]): string {
  if (!slots.length) return "No standing timetable yet. Add weekly tutorials with /timetable.";
  const lines = ["Standing timetable / 固定時間表", ""];
  for (const slot of [...slots].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime))) {
    const child = children.find((item) => item.id === slot.childId);
    const bring = slot.itemsToBring.length ? ` — bring ${slot.itemsToBring.join("、")}` : "";
    lines.push(
      `• ${weekdayName(slot.weekday)} ${slot.startTime} ${child?.name ?? "?"} ${slot.title}${slot.location ? ` @ ${slot.location}` : ""}${bring}`,
    );
  }
  return lines.join("\n");
}

export function formatHelp(role: Role | null): string {
  const common = [
    "/today — today by child",
    "/tomorrow — tomorrow + what to bring",
    "/week — next 7 days",
    "/kids — list children",
    "/timetable — weekly tutorials / PE",
    "/whoami — your Telegram id",
    "/notice — paste a circular as text if it is not auto-detected",
    "Send a photo, PDF, or pasted notice to extract events.",
    "Then ask: “豬2 Monday bring what?”",
  ];
  if (role === "admin" || role === "parent") {
    common.push("/addschool <name> — add a school or tutorial centre");
    common.push("/slips — open reply-slip / payment tasks");
    common.push("/remind parent|helper|week — send a digest now");
  }
  return ["Family notice bot", "", ...common].join("\n");
}

export function toAgendaFromEvent(event: CalendarEvent): AgendaItem {
  return {
    ymd: event.startAt ? event.startAt.slice(0, 10) : "undated",
    childIds: event.childIds,
    title: event.title,
    time: event.startAt && event.startAt.includes("T") ? event.startAt.slice(11, 16) : null,
    location: event.location,
    itemsToBring: event.itemsToBring,
    notes: event.notes,
    source: "event",
    type: event.type,
  };
}
