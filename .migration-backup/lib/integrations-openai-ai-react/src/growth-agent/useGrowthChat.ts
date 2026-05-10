/**
 * useGrowthChat v8 — Generative UI support.
 *
 * CHANGES vs v7:
 * - ChatMessage gains optional `uiTool: { name: UiToolName; args: UiToolArgs }`.
 *   When set, content is empty and GrowthChatMessage renders WendyUIRenderer.
 * - SSE event type 'ui_tool' is handled: creates an assistant message with
 *   uiTool set and isStreaming=false immediately (no streaming for UI tools).
 *
 * All other behaviour unchanged.
 */
import { useState, useRef, useCallback, useEffect } from "react";

export type ConfidenceLevel = "high" | "medium" | "low";
export type Domain = "career" | "habits" | "mindset" | "trading" | "general";

export interface SupervisorInfo {
  pass: boolean; score: number; rewritten: boolean; reasons: string[];
}

export interface UiToolPayload {
  name: string;
  args: Record<string, unknown>;
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
  voiceMode?: boolean;
  /** v8: set when Wendy renders a UI component instead of text */
  uiTool?: UiToolPayload;
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
    pageContext?: Record<string, unknown>;
  };
}

export interface SendMessageOptions {
  voiceMode?: boolean;
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

  const sendMessage = useCallback(async (
    text: string,
    { voiceMode = false }: SendMessageOptions = {}
  ) => {
    if (!text.trim() || isStreaming) return;
    setError(null); setStatusMessage(null);
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    const userMsg: ChatMessage      = { id: uid(), role: "user",      content: text, voiceMode };
    const assistantId = uid();
    const assistantMsg: ChatMessage = { id: assistantId, role: "assistant", content: "", isStreaming: true, voiceMode };
    setMessages((p) => [...p, userMsg, assistantMsg]);
    setIsStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch(`${apiBase}/growth-agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text, sessionId, history, userContext, voiceMode }),
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
              type: "token" | "status" | "done" | "error" | "ui_tool";
              value?: string;
              name?: string;
              args?: Record<string, unknown>;
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

            } else if (ev.type === "ui_tool" && ev.name) {
              // v8: replace the streaming placeholder with a UI tool message
              setStatusMessage(null);
              setMessages((p) => p.map((m) =>
                m.id === assistantId ? {
                  ...m,
                  content:    "",
                  isStreaming: false,
                  uiTool: { name: ev.name!, args: ev.args ?? {} },
                } : m
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
