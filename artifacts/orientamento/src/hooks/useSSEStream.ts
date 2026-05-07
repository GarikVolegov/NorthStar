import { useState, useRef, useCallback, useTransition } from "react";

// §4.1 FRONTEND_RULES — hook canonico per SSE streaming.
// Unico modo autorizzato nel progetto per consumare stream SSE.
// Rinominato startStream → start, aggiunto stop() esplicito,
// error tipato come Error|null (non string), aggiunte options §12.3.

interface UseSSEStreamOptions {
  onComplete?: (finalContent: string) => void;
  onError?: (error: Error) => void;
  flushIntervalMs?: number; // default 50ms
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
  const { onComplete, onError, flushIntervalMs = 50 } = options;

  const [content, setContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isPending, startTransition] = useTransition();

  const abortRef = useRef<AbortController | null>(null);
  const bufferRef = useRef("");
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setIsStreaming(false);
  }, []);

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
      bufferRef.current = "";

      const controller = new AbortController();
      abortRef.current = controller;

      setContent("");
      setError(null);
      setIsStreaming(true);

      try {
        const res = await fetch(url, { ...options, signal: controller.signal });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            (errData as { error?: string }).error ?? `Errore ${res.status}`,
          );
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
            const parsed = JSON.parse(raw) as {
              choices?: Array<{ delta?: { content?: string } }>;
              content?: string;
              text?: string;
            };
            const chunk =
              parsed.choices?.[0]?.delta?.content ??
              parsed.content ??
              parsed.text ??
              "";
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
          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop() ?? "";
          for (const line of lines) processLine(line);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
      } finally {
        setIsStreaming(false);
      }
    },
    [scheduleFlush, onComplete, onError],
  );

  return { content, isStreaming, isPending, error, start, stop, reset };
}
