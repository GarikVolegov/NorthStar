import { useState, useRef, useCallback } from "react";

interface UseSSEStreamReturn {
  content: string;
  isStreaming: boolean;
  error: string | null;
  startStream: (url: string, options?: RequestInit) => Promise<void>;
  reset: () => void;
}

export function useSSEStream(): UseSSEStreamReturn {
  const [content, setContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setContent("");
    setIsStreaming(false);
    setError(null);
  }, []);

  const startStream = useCallback(async (url: string, options?: RequestInit) => {
    abortRef.current?.abort();
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

      // FIX #4: single decoder instance, flushed after stream ends
      const decoder = new TextDecoder();
      let buffer = "";

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
          if (chunk) setContent((prev) => prev + chunk);
        } catch {
          if (raw) setContent((prev) => prev + raw);
        }
      };

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // FIX #4: flush remaining bytes in the decoder buffer
          const tail = decoder.decode(undefined, { stream: false });
          if (tail) {
            buffer += tail;
          }
          // Process any remaining lines in the buffer
          if (buffer.trim()) {
            for (const line of buffer.split("\n")) {
              processLine(line);
            }
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          processLine(line);
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message ?? "Errore sconosciuto");
    } finally {
      setIsStreaming(false);
    }
  }, []);

  return { content, isStreaming, error, startStream, reset };
}
