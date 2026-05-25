import type { AdminAssignee, AgentHealthStatus } from "./types";

export function auditActionLabel(action: string) {
  if (action === "growth_article_published") return "Pubblicato";
  if (action === "growth_article_rejected") return "Rifiutato";
  if (action === "growth_article_updated") return "Modificato";
  return action.replace(/_/g, " ");
}

export function formatLastUpdated(iso: string | null) {
  if (!iso) return "Non ancora aggiornato";
  return `Aggiornato ${new Date(iso).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function formatValue(value: unknown): string {
  if (value == null) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  return JSON.stringify(value);
}

export function humanizeKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function payloadEntries(payload: Record<string, unknown> | null) {
  if (!payload) return [];
  const hidden = new Set([
    "before",
    "after",
    "changes",
    "diff",
    "raw",
    "metadata",
  ]);
  return Object.entries(payload)
    .filter(
      ([key, value]) =>
        !hidden.has(key) && value != null && typeof value !== "object",
    )
    .slice(0, 8);
}

export function payloadDiffs(payload: Record<string, unknown> | null) {
  if (!payload) return [];
  const before =
    typeof payload.before === "object" && payload.before
      ? (payload.before as Record<string, unknown>)
      : null;
  const after =
    typeof payload.after === "object" && payload.after
      ? (payload.after as Record<string, unknown>)
      : null;
  if (before && after) {
    return Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
      .filter((key) => formatValue(before[key]) !== formatValue(after[key]))
      .slice(0, 8)
      .map((key) => ({ key, before: before[key], after: after[key] }));
  }

  const changes = Array.isArray(payload.changes)
    ? payload.changes
    : Array.isArray(payload.diff)
      ? payload.diff
      : [];
  return changes
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    )
    .slice(0, 8)
    .map((item, index) => ({
      key: String(item.field ?? item.key ?? `Cambio ${index + 1}`),
      before: item.before ?? item.oldValue ?? item.from,
      after: item.after ?? item.newValue ?? item.to ?? item.value,
    }));
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtShortDate(iso: string) {
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function assigneeLabel(
  assignees: AdminAssignee[],
  id: number | null | undefined,
) {
  if (!id) return "Non assegnato";
  const assignee = assignees.find((item) => item.id === id);
  return assignee ? assignee.name || assignee.email : `Admin #${id}`;
}

export function fmtDuration(ms: number | null | undefined) {
  if (ms == null) return "N/D";
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

export function fmtUsd(value: number | null | undefined) {
  const amount = Number(value) || 0;
  return `$${amount < 1 ? amount.toFixed(4) : amount.toFixed(2)}`;
}

export function fmtPct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "N/D";
  return `${Math.round(value * 100)}%`;
}

export function fmtScore(value: number | null | undefined) {
  return fmtPct(value);
}

export function agentStatusLabel(status: AgentHealthStatus) {
  if (status === "healthy") return "Stabile";
  if (status === "degraded") return "Degradato";
  return "Critico";
}

export function agentStatusClass(status: AgentHealthStatus) {
  if (status === "healthy")
    return "border-success-muted bg-success-surface text-success";
  if (status === "degraded")
    return "border-warning-muted bg-warning-surface text-warning";
  return "border-danger-muted bg-danger-surface text-danger";
}

export function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function arrayRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

export function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item)).filter(Boolean)
    : [];
}
