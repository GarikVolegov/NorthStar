import type { ToolCall } from "./client";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseArguments(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function readToolCalls(calls: readonly unknown[] | undefined): ToolCall[] {
  return (calls ?? []).map((call) => {
    const record = isRecord(call) ? call : {};
    const fn = isRecord(record.function) ? record.function : {};
    return {
      id: typeof record.id === "string" ? record.id : "",
      name: typeof fn.name === "string" ? fn.name : "",
      arguments: parseArguments(fn.arguments),
    };
  });
}
