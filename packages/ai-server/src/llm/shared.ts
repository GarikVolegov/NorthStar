import type { ChatWithToolsResult } from "./types";

function envMs(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Configurabili via env: i modelli free di reasoning (es. gpt-oss-120b) sono
// lenti e con 15s andavano spesso in timeout sulle chiamate con tool. Default
// più generosi, override con LLM_CHAT_TIMEOUT_MS / LLM_CHAT_ONCE_TIMEOUT_MS.
export const CHAT_TIMEOUT = envMs("LLM_CHAT_TIMEOUT_MS", 30_000);
export const CHAT_ONCE_TIMEOUT = envMs("LLM_CHAT_ONCE_TIMEOUT_MS", 22_000);

export function withTimeout<T>(
  factory: (signal: AbortSignal) => Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return factory(controller.signal)
    .catch((err: unknown) => {
      if (controller.signal.aborted) throw new Error(`${label} timeout after ${ms}ms`);
      throw err;
    })
    .finally(() => clearTimeout(timer));
}

export function normalizeFinishReason(reason: string | null | undefined): ChatWithToolsResult["finishReason"] {
  return reason === "tool_calls" || reason === "length" ? reason : "stop";
}
