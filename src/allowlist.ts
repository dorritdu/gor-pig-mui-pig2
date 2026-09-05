import type { AppConfig, Role } from "./types.js";

export function parseIdList(value: string | undefined): number[] {
  if (!value) return [];
  return value
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number(part))
    .filter((id) => Number.isFinite(id) && id > 0);
}

export function configFromEnv(env: {
  TIMEZONE?: string;
  ADMIN_TELEGRAM_IDS?: string;
  PARENT_TELEGRAM_IDS?: string;
  HELPER_TELEGRAM_IDS?: string;
}): AppConfig {
  const adminIds = parseIdList(env.ADMIN_TELEGRAM_IDS);
  const parentIds = uniqueIds([...adminIds, ...parseIdList(env.PARENT_TELEGRAM_IDS)]);
  const helperIds = parseIdList(env.HELPER_TELEGRAM_IDS);
  return {
    timezone: env.TIMEZONE || "Asia/Hong_Kong",
    adminIds,
    parentIds,
    helperIds,
  };
}

export function uniqueIds(ids: number[]): number[] {
  return [...new Set(ids)];
}

export function allowedIds(config: AppConfig): number[] {
  return uniqueIds([...config.adminIds, ...config.parentIds, ...config.helperIds]);
}

export function isAllowed(config: AppConfig, telegramId: number): boolean {
  return allowedIds(config).includes(telegramId);
}

export function roleFor(config: AppConfig, telegramId: number): Role | null {
  if (config.adminIds.includes(telegramId)) return "admin";
  if (config.parentIds.includes(telegramId)) return "parent";
  if (config.helperIds.includes(telegramId)) return "helper";
  return null;
}

export function parentRecipientIds(config: AppConfig): number[] {
  return uniqueIds([...config.adminIds, ...config.parentIds]);
}
