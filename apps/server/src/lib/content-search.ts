type QueryValue = string | string[] | undefined;

function firstString(value: QueryValue): string {
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return typeof value === "string" ? value.trim() : "";
}

export function readContentSearchQuery(query: Record<string, QueryValue>): string {
  return (
    firstString(query.q) ||
    firstString(query.query) ||
    firstString(query.search) ||
    firstString(query.topic)
  );
}

export function clampContentLimit(
  value: string | number | undefined,
  fallback: number,
  max: number,
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.round(parsed), max);
}
