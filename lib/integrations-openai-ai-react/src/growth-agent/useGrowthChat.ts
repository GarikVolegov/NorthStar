/**
 * useGrowthChat v4 — handles 'status' SSE events.
 *
 * NOVITÀ v4
 * ─────────
 * - Nuovo state: `statusMessage` (string | null)
 *   Contiene l'ultimo messaggio di stato ricevuto dal server durante
 *   l'elaborazione (es. "🔍 Cerco nella knowledge base...").
 * - Viene azzerato a null quando arriva il primo 'token' o 'done'.
 *   In questo modo il frontend può mostrarlo SOLO mentre il buffer è vuoto
 *   e nasconderlo non appena il testo inizia a comparire.
 * - Retrocompatibile: tutto il comportamento v3 è invariato.
 */
import { useState, useRef, useCallback, useEffect } from "react";

export type ConfidenceLevel = "high" | "medium" | "low";
export type Domain = "career" | "habits" | "mindset" | "general";

export interface SupervisorInfo {
  pass: boolean;
  score: number;
  rewritten: boolean;
  reasons: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ source: string; score: number }>;
  isStreaming?: boolean;
  evalScore?: number;
  evalLevel?: ConfidenceLevel;
  domain?: Domain;
  supervisorResult?: SupervisorInfo;
}

export interface UseGrowthChatOptions {
  apiBase?: string;
  token: string;
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

  const [messages,      setMessages]      = useState<ChatMessage[]>([]);
  const [isStreaming,   setIsStreaming]   = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null); // ← NEW v4
  const [sessionId,     setSessionId]     = useState<number | undefined>(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    return stored ? Number(stored) : undefined;
  });

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (sessionId !== undefined) localStorage.setItem(SESSION_KEY, String(sessionId));
  }, [sessionId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;
      setError(null);
      setStatusMessage(null);

      const history    = messages.map((m) => ({ role: m.role, content: m.content }));
      const userMsg: ChatMessage    = { id: uid(), role: "user",      content: text };
      const assistantId = uid();
      const assistantMsg: ChatMessage = { id: assistantId, role: "assistant", content: "", isStreaming: true };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`${apiBase}/growth-agent/chat`, {
          method:  "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ message: text, sessionId, history, userContext }),
          signal:  controller.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

        const reader  = res.body!.getReader();
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
                type: "token" | "status" | "done" | "error";   // ← status added
                value?: string;
                sources?: Array<{ source: string; score: number }>;
                message?: string;
                sessionId?: number;
                evalResult?: { score: number; level: ConfidenceLevel };
                routeDecision?: { domain: Domain; intent: string; confidence: number; threshold: number };
                supervisorResult?: SupervisorInfo;
              };

              if (event.type === "status" && event.value) {
                // Show status only while content is still empty
                setStatusMessage(event.value);

              } else if (event.type === "token" && event.value) {
                setStatusMessage(null); // clear status as soon as tokens arrive
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: m.content + event.value } : m,
                  ),
                );

              } else if (event.type === "done") {
                setStatusMessage(null);
                if (event.sessionId) setSessionId(event.sessionId);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          isStreaming:     false,
                          sources:         event.sources ?? [],
                          evalScore:       event.evalResult?.score,
                          evalLevel:       event.evalResult?.level,
                          domain:          event.routeDecision?.domain,
                          supervisorResult: event.supervisorResult
                            ? {
                                pass:      event.supervisorResult.pass,
                                score:     event.supervisorResult.score,
                                rewritten: event.supervisorResult.rewritten,
                                reasons:   event.supervisorResult.reasons,
                              }
                            : undefined,
                        }
                      : m,
                  ),
                );

              } else if (event.type === "error") {
                setStatusMessage(null);
                setError(event.message ?? "Errore sconosciuto");
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, isStreaming: false } : m,
                  ),
                );
              }
            } catch { /* skip malformed SSE lines */ }
          }
        }
      } catch (err) {
        setStatusMessage(null);
        if ((err as Error).name === "AbortError") {
          setMessages((prev) =>
            prev.map((m) => m.id === assistantId ? { ...m, isStreaming: false } : m),
          );
        } else {
          setError(err instanceof Error ? err.message : String(err));
          setMessages((prev) =>
            prev.map((m) => m.id === assistantId ? { ...m, isStreaming: false } : m),
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [apiBase, token, userContext, messages, isStreaming, sessionId],
  );

  const abort = useCallback(() => { abortRef.current?.abort(); }, []);

  const resetSession = useCallback(() => {
    abort();
    setMessages([]);
    setError(null);
    setStatusMessage(null);
    setSessionId(undefined);
    localStorage.removeItem(SESSION_KEY);
  }, [abort]);

  // statusMessage is exposed so the UI can show contextual loading text
  return { messages, isStreaming, error, statusMessage, sessionId, sendMessage, abort, resetSession };
}
