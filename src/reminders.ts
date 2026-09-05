import type { FamilyRepo } from "./repo.js";
import { collectAgenda, itemsOnDay, tasksRelevantToDay } from "./agenda.js";
import { formatAgenda, formatWeekList } from "./format.js";
import { addDays, todayAndRange } from "./time.js";
import type { AppConfig, Role } from "./types.js";
import { parentRecipientIds } from "./allowlist.js";

export type ReminderKind = "parent_evening" | "helper_morning" | "week_ahead";

export function reminderKindFromCron(cron: string): ReminderKind | null {
  if (cron === "0 12 * * *") return "parent_evening";
  if (cron === "0 23 * * *") return "helper_morning";
  if (cron === "0 0 * * 0") return "week_ahead";
  return null;
}

export function recipientsFor(kind: ReminderKind, config: AppConfig): number[] {
  if (kind === "helper_morning") return config.helperIds;
  return parentRecipientIds(config);
}

export async function buildReminderMessage(
  repo: FamilyRepo,
  kind: ReminderKind,
  now: Date,
  timezone: string,
): Promise<string> {
  const range = todayAndRange(now, timezone);
  const children = await repo.listChildren();

  if (kind === "parent_evening") {
    const { items, tasks } = await collectAgenda(repo, range.tomorrow, range.tomorrow);
    return formatAgenda(
      `Tomorrow ${range.tomorrow}`,
      itemsOnDay(items, range.tomorrow),
      tasksRelevantToDay(tasks, range.tomorrow),
      children,
      "parent",
    );
  }

  if (kind === "helper_morning") {
    const { items, tasks } = await collectAgenda(repo, range.today, range.today);
    return formatAgenda(
      `Today pack list ${range.today}`,
      itemsOnDay(items, range.today),
      tasksRelevantToDay(tasks, range.today).filter((task) => task.assigneeRole === "helper"),
      children,
      "helper",
    );
  }

  const { items } = await collectAgenda(repo, range.today, addDays(range.today, 6));
  return formatWeekList(items, children);
}

export function reminderLogKey(kind: ReminderKind, now: Date, timezone: string): { kind: string; sentOn: string } {
  const range = todayAndRange(now, timezone);
  if (kind === "parent_evening") return { kind, sentOn: range.today };
  if (kind === "helper_morning") return { kind, sentOn: range.today };
  return { kind, sentOn: range.today };
}

export function audienceLabel(kind: ReminderKind): Role | "parent" | "helper" {
  return kind === "helper_morning" ? "helper" : "parent";
}
