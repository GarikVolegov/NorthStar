export const SECTOR_TRENDS = ["declining", "stable", "growing", "booming"] as const;
export const CALENDAR_CATEGORIES = ["study", "training", "interview", "deadline", "task", "follow-up"] as const;
export const WEAK_SIGNAL_STATUSES = ["emerging", "confirmed", "mainstream", "faded"] as const;

export type SectorTrend = (typeof SECTOR_TRENDS)[number];
export type WeakSignalStatus = (typeof WEAK_SIGNAL_STATUSES)[number];
export type CalendarCategory = (typeof CALENDAR_CATEGORIES)[number];

export function isOneOf<const T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

export function typedArgs<T extends object>(args: Record<string, unknown>): T {
  return args as T;
}

export function numberArg(
  args: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = args[key];
  return typeof value === "number" ? value : undefined;
}

export function stringArg(
  args: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = args[key];
  return typeof value === "string" ? value : undefined;
}

export function readSectorTrend(value: unknown): SectorTrend | undefined {
  return isOneOf(SECTOR_TRENDS, value) ? value : undefined;
}

export function readCalendarCategory(value: unknown): CalendarCategory {
  return isOneOf(CALENDAR_CATEGORIES, value) ? value : "task";
}

export function readWeakSignalStatus(value: unknown): WeakSignalStatus {
  return isOneOf(WEAK_SIGNAL_STATUSES, value) ? value : "confirmed";
}
