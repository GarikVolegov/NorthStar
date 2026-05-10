import React, { useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import { StreamErrorBoundary } from "@/components/ErrorBoundary";
import { useGetSector } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Send, MessageSquare, Loader2, RefreshCw, Flag } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const BASE = import.meta.env.BASE_URL || "/";

const MAX_TURNS = 5;

interface Message {
  role: "user" | "assistant";
  content: string;
}

function formatLine(line: string, key: number) {
  const parts = line.split(/\*\*(.*?)\*\*/g);
  return (
    <span key={key}>
      {parts.map((p, i) =>
        i % 2 === 1 ? <strong key={i}>{p}</strong> : p
      )}
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
      elements.push(<div key={i} className="h-2" />);
    } else if (line.startsWith("## ")) {
      elements.push(<p key={i} className="font-bold text-base mt-2">{formatLine(line.slice(3), i)}</p>);
    } else if (line.startsWith("### ")) {
      elements.push(<p key={i} className="font-semibold mt-1">{formatLine(line.slice(4), i)}</p>);
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

export default function Colloquio() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [phase, setPhase] = useState<"question" | "evaluate" | "final">("question");
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [started, setStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: sector, isLoading: sectorLoading } = useGetSector(id, {
    query: { enabled: !!id, queryKey: ["sector", id] },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(msg: string, currentPhase = phase) {
    if (isStreaming) return;

    const userMsg: Message = { role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    let assistantContent = "";
    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch(`${BASE}api/interview/${id}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history, phase: currentPhase }),
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
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: assistantContent };
                return next;
              });
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: "Errore di connessione. Riprova." };
        return next;
      });
    }

    setIsStreaming(false);
  }

  function startInterview() {
    setStarted(true);
    sendMessage("Inizia il colloquio con la prima domanda.", "question");
  }

  function handleSubmit() {
    if (!input.trim() || isStreaming) return;
    const newTurn = turnCount + 1;
    setTurnCount(newTurn);
    const nextPhase: "question" | "evaluate" | "final" = newTurn >= MAX_TURNS ? "final" : "evaluate";
    setPhase(nextPhase);
    sendMessage(input, nextPhase);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleFinalEvaluate() {
    setPhase("final");
    setTurnCount(MAX_TURNS);
    sendMessage("Valuta il colloquio fin qui e fornisci il punteggio finale.", "final");
  }

  function resetInterview() {
    setMessages([]);
    setPhase("question");
    setTurnCount(0);
    setStarted(false);
    setInput("");
  }

  if (sectorLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!sector) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">Settore non trovato.</p>
        <Link href="/settori"><Button variant="ghost" className="mt-4"><ArrowLeft className="w-4 h-4 mr-2" />Torna ai settori</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col h-[calc(100dvh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <Link href={`/settore/${id}`}>
          <Button variant="ghost" size="icon" className="rounded-full shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-bold text-lg leading-tight">Simulatore Colloquio</h1>
            <Badge variant="outline" className="text-xs shrink-0">{sector.name}</Badge>
            {started && (
              <Badge variant={phase === "final" ? "default" : "secondary"} className="text-xs shrink-0">
                {phase === "final" ? "Valutazione finale" : `Turno ${turnCount}/${MAX_TURNS}`}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Preparati al colloquio con l'AI</p>
        </div>
        {started && (
          <Button variant="ghost" size="icon" className="rounded-full shrink-0" onClick={resetInterview} title="Nuovo colloquio">
            <RefreshCw className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Chat area */}
      <StreamErrorBoundary>
      <div className="flex-1 overflow-y-auto rounded-2xl border bg-muted/20 p-4 space-y-4 mb-4 min-h-0">
        {!started ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 gap-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center">
              <MessageSquare className="w-7 h-7 text-orange-500" />
            </div>
            <div>
              <h2 className="font-semibold text-lg mb-1">Pronto per il colloquio?</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Simula un colloquio di lavoro nel settore <strong>{sector.name}</strong>.
                L'AI farà domande, valuterà le tue risposte e darà un punteggio finale.
              </p>
            </div>
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-xl px-4 py-2.5 max-w-xs">
              <p>📋 <strong>{MAX_TURNS} domande</strong> · Feedback immediato · Punteggio /100</p>
            </div>
            <Button size="lg" className="mt-2" onClick={startInterview}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Inizia il colloquio
            </Button>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
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
                      <div className="w-5 h-5 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center shrink-0 mt-0.5">
                        <MessageSquare className="w-3 h-3 text-orange-600" />
                      </div>
                      <MessageContent content={msg.content || (isStreaming && i === messages.length - 1 ? "▌" : "")} />
                    </div>
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {isStreaming && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.content && (
              <div className="flex justify-start">
                <div className="bg-card border rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
                  <span className="text-sm text-muted-foreground">HR sta valutando…</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      </StreamErrorBoundary>

      {/* Input area */}
      {started && phase !== "final" && (
        <div className="shrink-0 space-y-2">
          {turnCount >= 3 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs border-orange-200 text-orange-700 hover:bg-orange-50"
              onClick={handleFinalEvaluate}
              disabled={isStreaming}
            >
              <Flag className="w-3.5 h-3.5 mr-1.5" />
              Termina e ottieni valutazione finale
            </Button>
          )}
          <div className="flex gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scrivi la tua risposta… (Invio per inviare)"
              rows={2}
              disabled={isStreaming}
              className="flex-1 resize-none rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
            />
            <Button
              onClick={handleSubmit}
              disabled={isStreaming || !input.trim()}
              size="icon"
              className="h-auto aspect-square rounded-xl"
            >
              {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      )}

      {phase === "final" && started && !isStreaming && (
        <div className="shrink-0 pt-2">
          <Button className="w-full" onClick={resetInterview}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Nuovo colloquio
          </Button>
        </div>
      )}
    </div>
  );
}
