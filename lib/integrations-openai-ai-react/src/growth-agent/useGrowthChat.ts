/**
 * useGrowthChat — custom hook for the growth coach SSE chat.
 *
 * STATE
 * ─────
 *  messages     Full conversation (user + assistant turns)
 *  isStreaming   True while the SSE connection is open
 *  sessionId     Persisted in localStorage — survives page refresh
 *  error         Last error string (null if no error)
 *
 * FLOW
 * ─────
 *  sendMessage(text)
 *    → appends user message immediately (optimistic)
 *    → appends empty assistant message (will fill with tokens)
 *    → opens SSE via fetch() + ReadableStream
 *    → appends each token to last assistant message
 *    → on 'done' event: attaches sources to last assistant message
 *    → on 'error' event: sets error state
 *
 * ABORT
 * ─────
 *  abort() cancels mid-stream via AbortController.
 *  The partial assistant message is kept in history.
 *
 * SESSION PERSISTENCE
 * ────────────────────
 *  sessionId is stored in localStorage under 'growth_session_id'.
 *  On first load, if no sessionId exists, the server creates one and
 *  returns it in the 'done' event (future improvement: return from API).
 *  resetSession() clears both messages and the stored sessionId.
 */
import { useState, useRef, useCallback, useEffect } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ source: string; score: number }>;
  isStreaming?: boolean;
}

export interface UseGrowthChatOptions {
  /** API base URL, defaults to '/api' */
  apiBase?: string;
  /** JWT token for Authorization header */
  token: string;
  /** User context passed to the agent */
  userContext?: {
    name?: string;
    journeyType?: string;
    userMode?: string;
    objectives?: string[];
    sectorName?: string;
  };
}

const SESSION_KEY = "growth_session_id";

function uid(): string {
  return Math.random().toString(36).slice(2);
}

export function useGrowthChat(opts: UseGrowthChatOptions) {
  const { apiBase = "/api", token, userContext = {} } = opts;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number | undefined>(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    return stored ? Number(stored) : undefined;
  });

  const abortRef = useRef<AbortController | null>(null);

  // Persist sessionId to localStorage whenever it changes
  useEffect(() => {
    if (sessionId !== undefined) {
      localStorage.setItem(SESSION_KEY, String(sessionId));
    }
  }, [sessionId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      setError(null);

      // Build history for the API (exclude streaming flag)
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Optimistic: append user message immediately
      const userMsg: ChatMessage = { id: uid(), role: "user", content: text };
      // Reserve slot for assistant response
      const assistantId = uid();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      // ── Open SSE stream ──────────────────────────────────────────────────
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`${apiBase}/growth-agent/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: text,
            sessionId,
            history,
            userContext,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw || raw === "[DONE]") continue;

            try {
              const event = JSON.parse(raw) as {
                type: "token" | "done" | "error";
                value?: string;
                sources?: Array<{ source: string; score: number }>;
                message?: string;
                sessionId?: number;
              };

              if (event.type === "token" && event.value) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + event.value }
                      : m,
                  ),
                );
              } else if (event.type === "done") {
                if (event.sessionId) setSessionId(event.sessionId);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, isStreaming: false, sources: event.sources ?? [] }
                      : m,
                  ),
                );
              } else if (event.type === "error") {
                setError(event.message ?? "Errore sconosciuto");
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, isStreaming: false } : m,
                  ),
                );
              }
            } catch {
              // Malformed JSON line — skip
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // User aborted — mark message as done
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, isStreaming: false } : m,
            ),
          );
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, isStreaming: false } : m,
            ),
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [apiBase, token, userContext, messages, isStreaming, sessionId],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const resetSession = useCallback(() => {
    abort();
    setMessages([]);
    setError(null);
    setSessionId(undefined);
    localStorage.removeItem(SESSION_KEY);
  }, [abort]);

  return {
    messages,
    isStreaming,
    error,
    sessionId,
    sendMessage,
    abort,
    resetSession,
  };
}
