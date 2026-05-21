import type { SQL } from "drizzle-orm";

export type CatalogPayload = Record<string, unknown>;

export const CATALOG_ENUMS = {
  riasec: ["R", "I", "A", "S", "E", "C"],
  automationRisk: ["low", "medium", "high"],
  scalability: ["low", "medium", "high"],
  trend: ["declining", "stable", "growing", "booming"],
  workMode: ["dipendente", "autonomo", "ibrido"],
  educationType: ["universitario", "professionale", "online", "bootcamp"],
  articleStatus: ["draft", "pending", "published", "rejected", "archived"],
  difficulty: ["base", "intermedio", "avanzato"],
} as const;

export function asRecord(value: unknown): CatalogPayload {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

export function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

export function numberValue(value: unknown, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function integerValue(value: unknown, fallback = 0) {
  const n = Math.round(numberValue(value, fallback));
  return Number.isFinite(n) ? n : fallback;
}

export function booleanValue(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (value === "false") return false;
  if (value === "true") return true;
  return fallback;
}

export function arrayValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean)),
    );
  }
  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
  }
  return [];
}

export function numberArrayValue(value: unknown): number[] {
  return Array.isArray(value)
    ? value.map((id) => integerValue(id)).filter((id) => id > 0)
    : [];
}

export function enumValue<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number],
) {
  const normalized = stringValue(value, fallback);
  return allowed.includes(normalized) ? normalized : fallback;
}

export function hasInvalidEnumValues(
  values: string[],
  allowed: readonly string[],
) {
  return values.some((value) => !allowed.includes(value));
}

export function isSql(condition: SQL | undefined): condition is SQL {
  return condition !== undefined;
}

export function isAllowed<T extends readonly string[]>(
  value: string,
  allowed: T,
): value is T[number] {
  return allowed.includes(value);
}

export function normalizeSteps(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const row = asRecord(item);
      return {
        step: integerValue(row.step, index + 1),
        title: stringValue(row.title),
        description: stringValue(row.description),
      };
    })
    .filter((step) => step.title && step.description);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}
