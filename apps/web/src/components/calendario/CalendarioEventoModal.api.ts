import { getJson, requestJson } from "@/lib/apiClient";

export interface Sector {
  id: number;
  name: string;
  icon: string;
}

export interface Objective {
  id: number;
  text: string;
  category: string;
  completed: boolean;
}

export type CalendarSaveErrorCode = "FREE_LIMIT_REACHED" | "PREMIUM_REQUIRED";

type CalendarQuota = { isPremium: boolean; eventCount: number; eventLimit: number | null };

export async function fetchCalendarQuota(base: string): Promise<Partial<CalendarQuota>> {
  try {
    return await getJson<CalendarQuota>(`${base}api/calendar/quota`);
  } catch {
    return { isPremium: false };
  }
}

export async function fetchSectors(base: string): Promise<Sector[]> {
  try {
    return await getJson<Sector[]>(`${base}api/sectors`);
  } catch {
    return [];
  }
}

export async function fetchObjectives(base: string): Promise<Objective[]> {
  try {
    return await getJson<Objective[]>(`${base}api/objectives/me`);
  } catch {
    return [];
  }
}

export function saveCalendarEvent(baseUrl: string, method: "PATCH" | "POST", payload: Record<string, unknown>) {
  return requestJson<unknown>(baseUrl, {
    method,
    body: JSON.stringify(payload),
  });
}

export function getCalendarErrorCode(body: unknown): CalendarSaveErrorCode | null {
  if (!body || typeof body !== "object") return null;
  const value = (body as Record<string, unknown>).code;
  return value === "FREE_LIMIT_REACHED" || value === "PREMIUM_REQUIRED" ? value : null;
}

export function getCalendarErrorText(body: unknown, field: "message" | "error"): string | null {
  if (!body || typeof body !== "object") return null;
  const value = (body as Record<string, unknown>)[field];
  return typeof value === "string" ? value : null;
}
