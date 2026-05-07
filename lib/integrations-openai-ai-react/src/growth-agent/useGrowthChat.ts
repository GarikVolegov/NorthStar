/**
 * useGrowthChat v3 — aggiunge domain e supervisorResult al ChatMessage.
 *
 * NOVITÀ v3
 * ─────────
 * - ChatMessage ora include `domain` (agente specialista che ha risposto)
 *   e `supervisorResult` (esito del SupervisorAgent: pass/fail/rewrite).
 * - Il parser SSE legge i nuovi campi dall'evento `done`.
 * - Retrocompatibile: i campi sono opzionali, il comportamento v2 è invariato.
 */
import { useState, useRef, useCallback, useEffect } from "react";

export type ConfidenceLevel = "high" | "medium" | "low";
export type Domain = "career" | "habits" | "mindset" | "general";

export interface SupervisorInfo {
  pass: boolean;
  score: number;      // 0-1
  rewritten: boolean; // true se il supervisor ha riscritto la risposta
  reasons: string[];  // motivazioni del fail (vuoto se pass)
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ source: string; score: number }>;
  isStreaming?: boolean;
  evalScore?: number;
  evalLevel?: ConfidenceLevel;
  // ── NUOVI CAMPI v3 ──
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

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number | undefined>(() => {
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

      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const userMsg: ChatMessage = { id: uid(), role: "user", content: text };
      const assistantId = uid();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`${apiBase}/growth-agent/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ message: text, sessionId, history, userContext }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

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
                evalResult?: { score: number; level: ConfidenceLevel };
                // ── NUOVI CAMPI v3 ──
                routeDecision?: { domain: Domain; intent: string; confidence: number };
                supervisorResult?: {
                  pass: boolean;
                  score: number;
                  rewritten: boolean;
                  reasons: string[];
                };
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
                      ? {
                          ...m,
                          isStreaming: false,
                          sources: event.sources ?? [],
                          evalScore: event.evalResult?.score,
                          evalLevel: event.evalResult?.level,
                          // ── v3: domain e supervisorResult ──
                          domain: event.routeDecision?.domain,
                          supervisorResult: event.supervisorResult
                            ? {
                                pass: event.supervisorResult.pass,
                                score: event.supervisorResult.score,
                                rewritten: event.supervisorResult.rewritten,
                                reasons: event.supervisorResult.reasons,
                              }
                            : undefined,
                        }
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
              /* skip malformed SSE lines */
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, isStreaming: false } : m,
            ),
          );
        } else {
          setError(err instanceof Error ? err.message : String(err));
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

  return { messages, isStreaming, error, sessionId, sendMessage, abort, resetSession };
}
