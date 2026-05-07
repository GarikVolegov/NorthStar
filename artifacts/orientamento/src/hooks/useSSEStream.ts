import { useState, useRef, useCallback, useTransition } from "react";

interface UseSSEStreamReturn {
  content: string;
  isStreaming: boolean;
  isPending: boolean;
  error: string | null;
  startStream: (url: string, options?: RequestInit) => Promise<void>;
  reset: () => void;
}

/**
 * Batched SSE stream hook.
 *
 * Instead of calling setState on every chunk (which causes hundreds of
 * synchronous re-renders and blocks user input during AI generation),
 * chunks are accumulated in a ref-buffer and flushed every 50ms via
 * useTransition — marking the update as non-urgent so the browser can
 * interleave higher-priority input events between frames.
 */
export function useSSEStream(): UseSSEStreamReturn {
  const [content, setContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const abortRef = useRef<AbortController | null>(null);
  const bufferRef = useRef("");
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current !== null) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      const snapshot = bufferRef.current;
      startTransition(() => {
        setContent(snapshot);
      });
    }, 50);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    if (flushTimerRef.current !== null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    bufferRef.current = "";
    setContent("");
    setIsStreaming(false);
    setError(null);
  }, []);

  const startStream = useCallback(async (url: string, options?: RequestInit) => {
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
        throw new Error((errData as { error?: string }).error ?? `Errore ${res.status}`);
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
          // Final flush — force immediate sync to show complete content
          if (flushTimerRef.current !== null) {
            clearTimeout(flushTimerRef.current);
            flushTimerRef.current = null;
          }
          const finalContent = bufferRef.current;
          startTransition(() => setContent(finalContent));
          break;
        }

        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() ?? "";

        for (const line of lines) processLine(line);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message ?? "Errore sconosciuto");
    } finally {
      setIsStreaming(false);
    }
  }, [scheduleFlush]);

  return { content, isStreaming, isPending, error, startStream, reset };
}
