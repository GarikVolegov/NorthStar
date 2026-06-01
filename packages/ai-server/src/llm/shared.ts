import type { ChatWithToolsResult } from "./types";

export const CHAT_TIMEOUT = 30_000;
export const CHAT_ONCE_TIMEOUT = 15_000;

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
