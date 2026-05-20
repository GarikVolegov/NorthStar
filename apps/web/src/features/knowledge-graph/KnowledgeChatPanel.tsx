import { TYPE_META } from "@/components/knowledge-graph/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSSEStream } from "@/hooks/useSSEStream";
import { apiFetch } from "@/lib/api-fetch";
import { ChevronRight, Loader2, MessageCircleQuestion, Send, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { KNode, NodeType } from "./knowledgeGraphTypes";

const BASE = import.meta.env.BASE_URL || "/";

interface Citation {
  id: number;
  title: string;
  type: NodeType;
  score?: number;
}
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[] | undefined;
  neighbors?: Citation[] | undefined;
  status?: string | undefined;
  error?: string | undefined;
}
interface ChatPanelProps {
  nodes: KNode[];
  onClose: () => void;
  onFocusNode: (id: number) => void;
}

// ── ChatPanel — SSE via useSSEStream (regola 4.1) ────────────────────────
export function KnowledgeChatPanel({
  nodes,
  onClose,
  onFocusNode,
}: ChatPanelProps) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    isStreaming,
    reset: resetStream,
  } = useSSEStream({
    onError: () => {
      setMessages((prev) => {
        const next = prev.slice();
        const last = next[next.length - 1];
        if (last?.role === "assistant")
          next[next.length - 1] = {
            ...last,
            error: "Errore di rete",
            status: undefined,
          };
        return next;
      });
    },
  });

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const ask = useCallback(async () => {
    const q = question.trim();
    if (!q || isStreaming) return;
    setQuestion("");
    resetStream();
    const userMsg: ChatMessage = { role: "user", content: q };
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: "",
      status: "starting",
    };
    setMessages((m) => [...m, userMsg, assistantMsg]);

    // useSSEStream gestisce il fetch; per i messaggi strutturati (citations, status)
    // usiamo il pattern manuale solo per il parsing SSE semantico
    try {
      const res = await apiFetch(`${BASE}api/knowledge/ask`, {
        method: "POST",
        body: JSON.stringify({ question: q }),
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("Nessun reader");
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(part.slice(6));
            setMessages((prev) => {
              const next = prev.slice();
              const last = next[next.length - 1];
              if (!last || last.role !== "assistant") return prev;
              if (data.content)
                next[next.length - 1] = {
                  ...last,
                  content: last.content + data.content,
                  status: undefined,
                };
              else if (data.status)
                next[next.length - 1] = { ...last, status: data.status };
              else if (data.citations)
                next[next.length - 1] = {
                  ...last,
                  citations: data.citations,
                  neighbors: data.neighbors,
                };
              else if (data.error)
                next[next.length - 1] = {
                  ...last,
                  error: data.error,
                  status: undefined,
                };
              return next;
            });
          } catch {
            /* malformed sse */
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const next = prev.slice();
        const last = next[next.length - 1];
        if (last?.role === "assistant")
          next[next.length - 1] = {
            ...last,
            error: err instanceof Error ? err.message : "Errore di rete",
            status: undefined,
          };
        return next;
      });
    }
  }, [question, isStreaming, resetStream]);

  function renderAnswer(content: string, citations?: Citation[]) {
    const parts: ReactNode[] = [];
    const regex = /\[#(\d+)\]/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex)
        parts.push(content.slice(lastIndex, match.index));
      const id = Number(match[1]);
      const node = nodes.find((n) => n.id === id);
      const cite = citations?.find((c) => c.id === id);
      const label = node?.title ?? cite?.title ?? `#${id}`;
      parts.push(
        <button
          key={`c-${key++}`}
          onClick={() => onFocusNode(id)}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/20 align-baseline"
          title={`Vai all'elemento ${label}`}
        >
          {label}
        </button>,
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) parts.push(content.slice(lastIndex));
    return parts;
  }

  const suggestions = [
    "Cosa ho imparato finora?",
    "Quali competenze mi mancano per il mio obiettivo?",
    "Riassumi i miei documenti su questo argomento.",
    "Quali elementi sono pi\u00f9 connessi tra loro?",
  ];

  return (
    <aside className="w-full max-w-md border-l bg-card flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <MessageCircleQuestion className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Assistente
          </p>
          <p className="text-sm font-semibold truncate">Chiedi all'Archivio</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold mb-1">
              Interroga il tuo Archivio
            </p>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              L'AI legge tutti i tuoi elementi, considera i collegamenti e
              risponde basandosi solo su quello che hai salvato. {nodes.length}{" "}
              elementi disponibili.
            </p>
            <div className="space-y-1.5 text-left">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setQuestion(s)}
                  className="w-full text-left px-3 py-2 rounded-lg border bg-background hover:border-primary/40 hover:bg-primary/5 text-xs transition-colors flex items-center gap-2"
                >
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span>{s}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i}>
            {m.role === "user" ? (
              <div className="flex justify-end">
                <div className="max-w-[85%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3.5 py-2 text-sm">
                  {m.content}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {m.citations && m.citations.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Elementi usati
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {m.citations.map((c) => {
                        const meta = TYPE_META[c.type] ?? TYPE_META.note;
                        return (
                          <button
                            key={c.id}
                            onClick={() => onFocusNode(c.id)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] hover:opacity-80"
                            style={{
                              backgroundColor: meta.bg,
                              color: meta.color,
                              borderColor: meta.border,
                            }}
                            title={`Affinit\u00e0 ${c.score ? Math.round(c.score * 100) : 0}%`}
                          >
                            <meta.Icon className="w-2.5 h-2.5" />
                            <span className="font-medium">{c.title}</span>
                            {c.score !== undefined && (
                              <span className="opacity-70">
                                {Math.round(c.score * 100)}%
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="bg-muted/40 border rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                  {m.error ? (
                    <span className="text-destructive">{m.error}</span>
                  ) : m.content ? (
                    renderAnswer(m.content, m.citations)
                  ) : m.status ? (
                    <span className="text-muted-foreground italic flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {m.status === "embedding" &&
                        "Analizzo il contenuto\u2026"}
                      {m.status === "retrieving" &&
                        "Cerco gli elementi pi\u00f9 rilevanti\u2026"}
                      {m.status === "answering" && "Sto rispondendo\u2026"}
                      {m.status === "starting" && "Avvio\u2026"}
                    </span>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask();
              }
            }}
            placeholder="Chiedimi qualcosa sul tuo percorso\u2026"
            rows={2}
            className="rounded-xl text-sm resize-none flex-1"
            disabled={isStreaming}
          />
          <Button
            size="icon"
            className="rounded-xl h-9 w-9 shrink-0"
            disabled={isStreaming || !question.trim()}
            onClick={() => void ask()}
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          \u21b5 invia \u00b7 Shift+\u21b5 vai a capo
        </p>
      </div>
    </aside>
  );
}
