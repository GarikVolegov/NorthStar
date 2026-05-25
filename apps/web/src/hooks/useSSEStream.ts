import { useCallback, useRef, useState, useTransition } from "react";

// §4.1 FRONTEND_RULES — hook canonico per SSE streaming.
// Unico modo autorizzato nel progetto per consumare stream SSE.
// Rinominato startStream → start, aggiunto stop() esplicito,
// error tipato come Error|null (non string), aggiunte options §12.3.

interface UseSSEStreamOptions {
  onComplete?: (finalContent: string) => void;
  onRawChunk?: (raw: string) => boolean;
  onError?: (error: Error) => void;
  flushIntervalMs?: number; // default 50ms
  /** Hard timeout on the whole stream (ms). Aborts with Error('SSE_TIMEOUT') if exceeded. 0 disables. */
  timeoutMs?: number;
  /** If true, the timeout window is reset whenever a chunk is received. Default true. */
  resetTimeoutOnChunk?: boolean;
}

type StreamEventPayload = {
  type?: unknown;
  value?: unknown;
  content?: unknown;
  text?: unknown;
  choices?: Array<{ delta?: { content?: unknown } }>;
};

function readErrorMessage(value: unknown, fallback: string): string {
  if (value && typeof value === "object" && "error" in value) {
    const error = (value as { error?: unknown }).error;
    if (typeof error === "string") return error;
  }
  return fallback;
}

function readTokenChunk(parsed: StreamEventPayload, eventType: string | undefined): string {
  const providerChunk = parsed.choices?.[0]?.delta?.content;
  if (typeof providerChunk === "string") return providerChunk;
  if (eventType !== "token") return "";
  if (typeof parsed.value === "string") return parsed.value;
  if (typeof parsed.content === "string") return parsed.content;
  if (typeof parsed.text === "string") return parsed.text;
  return "";
}

export interface UseSSEStreamReturn {
  content: string;
  isStreaming: boolean;
  isPending: boolean;
  error: Error | null;
  start: (url: string, options?: RequestInit) => Promise<void>;
  stop: () => void;
  reset: () => void;
}

/**
 * Batched SSE stream hook — §4.1 FRONTEND_RULES.
 *
 * Chunks sono accumulati in un ref-buffer e flushati ogni `flushIntervalMs`
 * tramite useTransition (aggiornamento non-urgente, non blocca l'input).
 * Il flush finale è sincrono per mostrare il contenuto completo.
 */
export function useSSEStream(options: UseSSEStreamOptions = {}): UseSSEStreamReturn {
  const {
    onComplete,
    onRawChunk,
    onError,
    flushIntervalMs = 50,
    timeoutMs = 0,
    resetTimeoutOnChunk = true,
  } = options;

  const [content, setContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isPending, startTransition] = useTransition();

  const abortRef = useRef<AbortController | null>(null);
  const bufferRef = useRef("");
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutHitRef = useRef(false);

  const clearTimeoutTimer = useCallback(() => {
    if (timeoutTimerRef.current !== null) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
  }, []);

  const armTimeout = useCallback(() => {
    if (!timeoutMs || timeoutMs <= 0) return;
    clearTimeoutTimer();
    timeoutTimerRef.current = setTimeout(() => {
      timeoutHitRef.current = true;
      abortRef.current?.abort();
    }, timeoutMs);
  }, [timeoutMs, clearTimeoutTimer]);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current !== null) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      const snapshot = bufferRef.current;
      startTransition(() => setContent(snapshot));
    }, flushIntervalMs);
  }, [flushIntervalMs]);

  // §4.1 — stop() esplicito con abort del controller
  const stop = useCallback(() => {
    abortRef.current?.abort();
    if (flushTimerRef.current !== null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    clearTimeoutTimer();
    setIsStreaming(false);
  }, [clearTimeoutTimer]);

  const reset = useCallback(() => {
    stop();
    bufferRef.current = "";
    startTransition(() => setContent(""));
    setError(null);
  }, [stop]);

  // §4.1 — rinominato startStream → start per allineamento interfaccia canonica
  const start = useCallback(
    async (url: string, options?: RequestInit) => {
      abortRef.current?.abort();
      if (flushTimerRef.current !== null) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      clearTimeoutTimer();
      timeoutHitRef.current = false;
      bufferRef.current = "";

      const controller = new AbortController();
      abortRef.current = controller;

      setContent("");
      setError(null);
      setIsStreaming(true);
      armTimeout();

      try {
        const res = await fetch(url, { ...options, signal: controller.signal });

        if (!res.ok) {
          const errData = (await res.json().catch(() => ({}))) as unknown;
          throw new Error(readErrorMessage(errData, `Errore ${res.status}`));
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("Stream non disponibile");

        const decoder = new TextDecoder();
        let lineBuffer = "";

        const processLine = (line: string) => {
          if (!line.startsWith("data: ")) return;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") return;
          try {
            const parsed = JSON.parse(raw) as StreamEventPayload;
            // Custom event types (ui_tool, status, rag_citations, token, etc.)
            // and provider-style deltas can be observed by callers. Returning
            // false keeps the canonical streamed-content buffer active.
            if (onRawChunk?.(raw)) {
              return;
            }
            const eventType = typeof parsed.type === "string" ? parsed.type : undefined;
            if (eventType && eventType !== "token") {
              return;
            }
            const chunk = readTokenChunk(parsed, eventType);
            if (chunk) {
              bufferRef.current += chunk;
              scheduleFlush();
            }
          } catch {
            // Chunk non-JSON (es: heartbeat) — ignorare silenziosamente
            if (raw) {
              bufferRef.current += raw;
              scheduleFlush();
            }
          }
        };

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            const tail = decoder.decode(undefined, { stream: false });
            if (tail) lineBuffer += tail;
            if (lineBuffer.trim()) {
              for (const line of lineBuffer.split("\n")) processLine(line);
            }
            // Flush finale sincrono — mostra il contenuto completo
            if (flushTimerRef.current !== null) {
              clearTimeout(flushTimerRef.current);
              flushTimerRef.current = null;
            }
            const finalContent = bufferRef.current;
            startTransition(() => setContent(finalContent));
            onComplete?.(finalContent);
            break;
          }

          lineBuffer += decoder.decode(value, { stream: true });
          if (resetTimeoutOnChunk) armTimeout();
          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop() ?? "";
          for (const line of lines) processLine(line);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          if (timeoutHitRef.current) {
            const timeoutError = new Error("SSE_TIMEOUT");
            setError(timeoutError);
            onError?.(timeoutError);
          }
          return;
        }
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
      } finally {
        clearTimeoutTimer();
        setIsStreaming(false);
      }
    },
    [scheduleFlush, onComplete, onError, onRawChunk, armTimeout, clearTimeoutTimer, resetTimeoutOnChunk],
  );

  return { content, isStreaming, isPending, error, start, stop, reset };
}
