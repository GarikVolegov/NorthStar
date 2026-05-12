import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BrainCircuit, Plus, Trash2, Send, Loader2, MessageSquare } from "lucide-react";
import { StreamErrorBoundary } from "@/components/ErrorBoundary";

const BASE = import.meta.env.BASE_URL || "/";

interface SessionSummary {
  id: number;
  title: string;
  updatedAt: string;
}

interface FullSession {
  id: number;
  title: string;
  messages: Array<{ role: string; content: string; createdAt: string }>;
}

function formatLine(line: string, key: number) {
  const parts = line.split(/\*\*(.*?)\*\*/g);
  return (
    <span key={key}>
      {parts.map((p, i) => i % 2 === 1 ? <strong key={i}>{p}</strong> : p)}
    </span>
  );
}

function MessageContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line === "") {
      elements.push(<div key={i} className="h-1.5" />);
    } else if (line.startsWith("## ")) {
      elements.push(<p key={i} className="font-bold mt-2">{formatLine(line.slice(3), i)}</p>);
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      elements.push(
        <div key={i} className="flex gap-2 items-start">
          <span className="shrink-0 mt-2 w-1 h-1 rounded-full bg-current opacity-40" />
          <span>{formatLine(line.slice(2), i)}</span>
        </div>
      );
    } else {
      elements.push(<p key={i}>{formatLine(line, i)}</p>);
    }
    i++;
  }
  return <div className="space-y-1 text-sm leading-relaxed">{elements}</div>;
}

const QUICK_STARTS = [
  "Analizza il mio profilo e dimmi i miei punti di forza",
  "Aiutami a definire i prossimi passi nella mia carriera",
  "Preparami per un colloquio di lavoro",
  "Cosa dovrei studiare per entrare nel mio settore target?",
];

export default function Coach() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessages, setStreamingMessages] = useState<Array<{ role: string; content: string }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [streamingMessages]);

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <BrainCircuit className="w-12 h-12 text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Consulente di carriera</h1>
        <p className="text-muted-foreground mb-6">Accedi per iniziare a usare il tuo coach personale.</p>
        <Button onClick={() => setLocation("/registra")}>Accedi o registrati</Button>
      </div>
    );
  }

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<SessionSummary[]>({
    queryKey: ["coach-sessions"],
    queryFn: async () => {
      const res = await fetch(`${BASE}api/coach/sessions`, { credentials: "include" });
      if (!res.ok) throw new Error("Errore");
      return res.json();
    },
  });

  const { data: activeSession, isLoading: sessionLoading } = useQuery<FullSession>({
    queryKey: ["coach-session", activeSessionId],
    queryFn: async () => {
      const res = await fetch(`${BASE}api/coach/sessions/${activeSessionId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Errore");
      return res.json();
    },
    enabled: !!activeSessionId,
  });

  useEffect(() => {
    if (activeSession) {
      setStreamingMessages(activeSession.messages);
    }
  }, [activeSession]);

  const createSession = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}api/coach/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Errore");
      return res.json() as Promise<FullSession>;
    },
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ["coach-sessions"] });
      setActiveSessionId(session.id);
      setStreamingMessages([]);
    },
  });

  const deleteSession = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${BASE}api/coach/sessions/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["coach-sessions"] });
      if (activeSessionId === id) {
        setActiveSessionId(null);
        setStreamingMessages([]);
      }
    },
  });

  async function sendMessage(msg: string) {
    if (!activeSessionId || isStreaming || !msg.trim()) return;
    setInput("");
    setIsStreaming(true);

    const userMsg = { role: "user", content: msg, createdAt: new Date().toISOString() };
    const assistantMsg = { role: "assistant", content: "", createdAt: new Date().toISOString() };
    setStreamingMessages((prev) => [...prev, userMsg, assistantMsg]);

    let assistantContent = "";

    try {
      const res = await fetch(`${BASE}api/coach/sessions/${activeSessionId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
        credentials: "include",
      });

      if (!res.ok || !res.body) throw new Error("Errore rete");

      const reader = res.body.getReader();
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
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              assistantContent += data.content;
              setStreamingMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { ...assistantMsg, content: assistantContent };
                return next;
              });
            }
          } catch { /* skip */ }
        }
      }
    } catch {
      setStreamingMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { ...assistantMsg, content: "Errore di connessione. Riprova." };
        return next;
      });
    }

    setIsStreaming(false);
    queryClient.invalidateQueries({ queryKey: ["coach-sessions"] });
    queryClient.invalidateQueries({ queryKey: ["coach-session", activeSessionId] });
  }

  async function handleQuickStart(msg: string) {
    if (!activeSessionId) {
      const session = await createSession.mutateAsync();
      setActiveSessionId(session.id);
      setTimeout(() => sendMessage(msg), 100);
    } else {
      sendMessage(msg);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (activeSessionId) {
        sendMessage(input);
      }
    }
  }

  const displayMessages = activeSessionId ? streamingMessages : [];

  return (
    <div className="flex h-[calc(100dvh-4rem)] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-muted/20 flex flex-col shrink-0 hidden md:flex">
        <div className="p-4 border-b flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-primary" />
          <span className="font-semibold text-sm">Consulente AI</span>
          <Badge variant="outline" className="ml-auto text-xs">Beta</Badge>
        </div>

        <div className="p-3">
          <Button
            className="w-full"
            size="sm"
            onClick={() => createSession.mutate()}
            disabled={createSession.isPending}
          >
            {createSession.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Plus className="w-3.5 h-3.5 mr-2" />}
            Nuova sessione
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
          {sessionsLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)
          ) : sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6 px-3">
              Nessuna sessione ancora. Creane una nuova!
            </p>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                className={`group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                  activeSessionId === s.id ? "bg-primary/10 text-primary" : "hover:bg-muted/60"
                }`}
                onClick={() => { setActiveSessionId(s.id); setStreamingMessages([]); }}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" />
                <span className="flex-1 text-xs font-medium truncate">{s.title}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); deleteSession.mutate(s.id); }}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main chat */}
      <StreamErrorBoundary>
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-3 border-b flex items-center gap-3 shrink-0">
          <BrainCircuit className="w-5 h-5 text-primary md:hidden" />
          <h1 className="font-semibold">Il tuo Consulente di carriera</h1>
          <Badge variant="outline" className="text-xs">Beta</Badge>
          {/* Mobile new session */}
          <Button size="sm" variant="outline" className="ml-auto md:hidden" onClick={() => createSession.mutate()} disabled={createSession.isPending}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-4">
          {!activeSessionId ? (
            /* Welcome screen */
            <div className="max-w-lg mx-auto pt-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <BrainCircuit className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold mb-2">Cosa posso fare per te oggi?</h2>
                <p className="text-sm text-muted-foreground">
                  Sono il tuo consulente personale. Conosco il tuo profilo, i tuoi obiettivi e il mercato del lavoro italiano.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {QUICK_STARTS.map((q) => (
                  <Card
                    key={q}
                    className="cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all"
                    onClick={() => handleQuickStart(q)}
                  >
                    <CardContent className="p-4">
                      <p className="text-sm">{q}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : sessionLoading && displayMessages.length === 0 ? (
            <div className="space-y-4 max-w-2xl mx-auto">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className={`h-16 w-${i % 2 === 0 ? "3/4" : "full"} rounded-2xl`} />
              ))}
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-4 w-full">
              {displayMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-card border rounded-bl-sm"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <BrainCircuit className="w-3 h-3 text-primary" />
                        </div>
                        <MessageContent content={msg.content || (isStreaming && i === displayMessages.length - 1 ? "▌" : "")} />
                      </div>
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {isStreaming && displayMessages[displayMessages.length - 1]?.role === "assistant" && !displayMessages[displayMessages.length - 1]?.content && (
                <div className="flex justify-start">
                  <div className="bg-card border rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Coach sta scrivendo…</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        {activeSessionId && (
          <div className="border-t px-4 md:px-8 py-4 shrink-0">
            <div className="max-w-2xl mx-auto flex gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Scrivi un messaggio al tuo consulente… (Invio per inviare)"
                rows={2}
                disabled={isStreaming}
                className="flex-1 resize-none rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              />
              <Button
                onClick={() => sendMessage(input)}
                disabled={isStreaming || !input.trim()}
                size="icon"
                className="h-auto aspect-square rounded-xl"
              >
                {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}
      </main>
      </StreamErrorBoundary>
    </div>
  );
}
