export const HK_TZ = "Asia/Hong_Kong";

export function hkYmd(date: Date, timeZone = HK_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function hkWeekday(date: Date, timeZone = HK_TZ): number {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[day] ?? 0;
}

export function parseYmd(ymd: string): { year: number; month: number; day: number } {
  const [year, month, day] = ymd.split("-").map((part) => Number(part));
  if (!year || !month || !day) {
    throw new Error(`Invalid ymd: ${ymd}`);
  }
  return { year, month, day };
}

/** Add calendar days to a YYYY-MM-DD string using a noon UTC anchor. */
export function addDays(ymd: string, days: number): string {
  const { year, month, day } = parseYmd(ymd);
  const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function weekdayOfYmd(ymd: string): number {
  const { year, month, day } = parseYmd(ymd);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

export function weekdayName(weekday: number, locale: "en" | "zh" = "en"): string {
  const en = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const zh = ["日", "一", "二", "三", "四", "五", "六"];
  return locale === "zh" ? `星期${zh[weekday] ?? "?"}` : (en[weekday] ?? "?");
}

export function formatYmdHuman(ymd: string): string {
  return `${ymd} (${weekdayName(weekdayOfYmd(ymd), "en")} / ${weekdayName(weekdayOfYmd(ymd), "zh")})`;
}

export function combineDateTime(date: string | null, time: string | null): string | null {
  if (!date) return null;
  if (!time) return `${date}T00:00:00+08:00`;
  return `${date}T${time.length === 5 ? `${time}:00` : time}+08:00`;
}

export function eventOnYmd(startAt: string | null, ymd: string): boolean {
  if (!startAt) return false;
  return startAt.slice(0, 10) === ymd;
}

export function eventInRange(startAt: string | null, fromYmd: string, toYmd: string): boolean {
  if (!startAt) return false;
  const day = startAt.slice(0, 10);
  return day >= fromYmd && day <= toYmd;
}

export function taskDueOnOrBefore(dueAt: string | null, ymd: string): boolean {
  if (!dueAt) return false;
  return dueAt.slice(0, 10) <= ymd;
}

export function todayAndRange(now: Date, timeZone = HK_TZ): {
  today: string;
  tomorrow: string;
  weekEnd: string;
} {
  const today = hkYmd(now, timeZone);
  return {
    today,
    tomorrow: addDays(today, 1),
    weekEnd: addDays(today, 6),
  };
}
