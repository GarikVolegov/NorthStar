/**
 * useGrowthChat v5 — intermediate metadata in 'done' SSE event.
 *
 * NEW v5 fields on ChatMessage:
 * - toolUsed?: string          — tool called during generation
 * - parallelDomains?: string[] — ["career","mindset"] if parallel handoff ran
 * - fusionApplied?: boolean    — true if GPT-4o-mini fusion was used
 */
import { useState, useRef, useCallback, useEffect } from "react";

export type ConfidenceLevel = "high" | "medium" | "low";
export type Domain = "career" | "habits" | "mindset" | "trading" | "general";

export interface SupervisorInfo {
  pass: boolean; score: number; rewritten: boolean; reasons: string[];
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
  toolUsed?: string;
  parallelDomains?: string[];
  fusionApplied?: boolean;
}

export interface UseGrowthChatOptions {
  apiBase?: string;
  token: string;
  userContext?: {
    name?: string; journeyType?: string; userMode?: string;
    objectives?: string[]; sectorName?: string;
  };
}

const SESSION_KEY = "growth_session_id";
function uid() { return Math.random().toString(36).slice(2); }
function parseParallelDomains(ctx?: string): string[] | undefined {
  if (!ctx?.startsWith("parallel:")) return undefined;
  return ctx.slice(9).split("+").filter(Boolean);
}

export function useGrowthChat(opts: UseGrowthChatOptions) {
  const { apiBase = "/api", token, userContext = {} } = opts;
  const [messages, setMessages]          = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming]     = useState(false);
  const [error, setError]                = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [sessionId, setSessionId]         = useState<number | undefined>(() => {
    const s = localStorage.getItem(SESSION_KEY);
    return s ? Number(s) : undefined;
  });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (sessionId !== undefined) localStorage.setItem(SESSION_KEY, String(sessionId));
  }, [sessionId]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;
    setError(null); setStatusMessage(null);
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    const userMsg: ChatMessage      = { id: uid(), role: "user",      content: text };
    const assistantId = uid();
    const assistantMsg: ChatMessage = { id: assistantId, role: "assistant", content: "", isStreaming: true };
    setMessages((p) => [...p, userMsg, assistantMsg]);
    setIsStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch(`${apiBase}/growth-agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text, sessionId, history, userContext }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const reader = res.body!.getReader();
      const dec    = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === "[DONE]") continue;
          try {
            const ev = JSON.parse(raw) as {
              type: "token" | "status" | "done" | "error";
              value?: string;
              sources?: Array<{ source: string; score: number }>;
              message?: string;
              sessionId?: number;
              evalResult?: { score: number; level: ConfidenceLevel };
              routeDecision?: {
                domain: Domain; intent: string;
                confidence: number; threshold: number;
                handoffContext?: string;
              };
              supervisorResult?: SupervisorInfo;
              toolUsed?: string;
            };
            if (ev.type === "status" && ev.value) {
              setStatusMessage(ev.value);
            } else if (ev.type === "token" && ev.value) {
              setStatusMessage(null);
              setMessages((p) => p.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + ev.value } : m
              ));
            } else if (ev.type === "done") {
              setStatusMessage(null);
              if (ev.sessionId) setSessionId(ev.sessionId);
              const parallelDomains = parseParallelDomains(ev.routeDecision?.handoffContext);
              const fusionApplied   = (parallelDomains?.length ?? 0) >= 2;
              setMessages((p) => p.map((m) =>
                m.id === assistantId ? {
                  ...m, isStreaming: false,
                  sources:          ev.sources ?? [],
                  evalScore:        ev.evalResult?.score,
                  evalLevel:        ev.evalResult?.level,
                  domain:           ev.routeDecision?.domain,
                  supervisorResult: ev.supervisorResult ? {
                    pass:      ev.supervisorResult.pass,
                    score:     ev.supervisorResult.score,
                    rewritten: ev.supervisorResult.rewritten,
                    reasons:   ev.supervisorResult.reasons,
                  } : undefined,
                  toolUsed:        ev.toolUsed,
                  parallelDomains,
                  fusionApplied,
                } : m
              ));
            } else if (ev.type === "error") {
              setStatusMessage(null); setError(ev.message ?? "Errore sconosciuto");
              setMessages((p) => p.map((m) =>
                m.id === assistantId ? { ...m, isStreaming: false } : m
              ));
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      setStatusMessage(null);
      if ((err as Error).name === "AbortError") {
        setMessages((p) => p.map((m) => m.id === assistantId ? { ...m, isStreaming: false } : m));
      } else {
        setError(err instanceof Error ? err.message : String(err));
        setMessages((p) => p.map((m) => m.id === assistantId ? { ...m, isStreaming: false } : m));
      }
    } finally { setIsStreaming(false); abortRef.current = null; }
  }, [apiBase, token, userContext, messages, isStreaming, sessionId]);

  const abort = useCallback(() => { abortRef.current?.abort(); }, []);
  const resetSession = useCallback(() => {
    abort(); setMessages([]); setError(null); setStatusMessage(null);
    setSessionId(undefined); localStorage.removeItem(SESSION_KEY);
  }, [abort]);

  return { messages, isStreaming, error, statusMessage, sessionId, sendMessage, abort, resetSession };
}
