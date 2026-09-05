import type { FamilyRepo } from "./repo.js";
import type { AgendaItem } from "./format.js";
import { toAgendaFromEvent } from "./format.js";
import { eventOnYmd, weekdayOfYmd } from "./time.js";
import type { CalendarEvent, Task, TimetableSlot } from "./types.js";

export async function collectAgenda(
  repo: FamilyRepo,
  fromYmd: string,
  toYmd: string,
): Promise<{ items: AgendaItem[]; events: CalendarEvent[]; tasks: Task[] }> {
  const [events, slots, tasks] = await Promise.all([
    repo.listEventsBetween(fromYmd, toYmd),
    repo.listTimetable(),
    repo.listOpenTasks(),
  ]);
  const items = [
    ...events.map(toAgendaFromEvent),
    ...expandTimetable(slots, fromYmd, toYmd),
  ].sort((a, b) => a.ymd.localeCompare(b.ymd) || (a.time ?? "").localeCompare(b.time ?? ""));
  return { items, events, tasks };
}

export function expandTimetable(slots: TimetableSlot[], fromYmd: string, toYmd: string): AgendaItem[] {
  const items: AgendaItem[] = [];
  let cursor = fromYmd;
  while (cursor <= toYmd) {
    const weekday = weekdayOfYmd(cursor);
    for (const slot of slots) {
      if (slot.weekday !== weekday) continue;
      items.push({
        ymd: cursor,
        childIds: [slot.childId],
        title: slot.title,
        time: slot.startTime,
        location: slot.location,
        itemsToBring: slot.itemsToBring,
        notes: slot.notes,
        source: "timetable",
        type: "tutorial",
      });
    }
    const [year, month, day] = cursor.split("-").map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + 1, 12));
    cursor = next.toISOString().slice(0, 10);
  }
  return items;
}

export function itemsOnDay(items: AgendaItem[], ymd: string): AgendaItem[] {
  return items.filter((item) => item.ymd === ymd);
}

export function tasksRelevantToDay(tasks: Task[], ymd: string): Task[] {
  return tasks.filter((task) => {
    if (!task.dueAt) return true;
    const due = task.dueAt.slice(0, 10);
    return due <= ymd;
  });
}

export function eventsOnDay(events: CalendarEvent[], ymd: string): CalendarEvent[] {
  return events.filter((event) => eventOnYmd(event.startAt, ymd));
}
