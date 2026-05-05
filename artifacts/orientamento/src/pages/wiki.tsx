import React, { useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useGetSector } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, Brain, Sparkles, MessageSquare, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";

const BASE = import.meta.env.BASE_URL || "/";

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
    } else if (line.startsWith("### ")) {
      elements.push(<p key={i} className="font-semibold mt-1">{formatLine(line.slice(4), i)}</p>);
    } else if (line.startsWith("## ")) {
      elements.push(<p key={i} className="font-bold text-base mt-2">{formatLine(line.slice(3), i)}</p>);
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      elements.push(
        <div key={i} className="flex gap-2 items-start">
          <span className="shrink-0 mt-2 w-1 h-1 rounded-full bg-current opacity-40" />
          <span>{formatLine(line.slice(2), i)}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1];
      elements.push(
        <div key={i} className="flex gap-2 items-start">
          <span className="shrink-0 font-mono text-[11px] opacity-50 mt-0.5 w-4">{num}.</span>
          <span>{formatLine(line.replace(/^\d+\.\s/, ""), i)}</span>
        </div>
      );
    } else {
      elements.push(<p key={i}>{formatLine(line, i)}</p>);
    }
    i++;
  }
  return <div className="space-y-1 text-sm leading-relaxed">{elements}</div>;
}

export default function Wiki() {
  const { t } = useTranslation();
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const suggestedQuestions = t("wiki.suggestedQuestions", { returnObjects: true }) as string[];

  const { data: sector, isLoading: sectorLoading } = useGetSector(id, {
    query: { enabled: !!id && !!user, queryKey: ["sector", id] },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(question: string) {
    if (!question.trim() || isStreaming) return;
    setIsStreaming(true);
    const trimmed = question.trim();
    setMessages((prev) => [
      ...prev,
      { role: "user", content: trimmed },
      { role: "assistant", content: "" },
    ]);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch(`${BASE}api/wiki/${id}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, history }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? "Servizio non disponibile. Riprova più tardi.");
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          if (part.startsWith("data: ")) {
            try {
              const data = JSON.parse(part.slice(6));
              if (data.content) {
                setMessages((prev) => {
                  const msgs = [...prev];
                  msgs[msgs.length - 1] = {
                    role: "assistant",
                    content: msgs[msgs.length - 1].content + data.content,
                  };
                  return msgs;
                });
              }
            } catch {}
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const msgs = [...prev];
        msgs[msgs.length - 1] = {
          role: "assistant",
          content: t("wiki.errorMessage"),
        };
        return msgs;
      });
    }
    setIsStreaming(false);
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-24 max-w-lg text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Brain className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-serif font-bold mb-3">{t("wiki.accessRequired")}</h2>
        <p className="text-muted-foreground mb-8">{t("wiki.accessRequiredDesc")}</p>
        <Button asChild>
          <Link href="/registra">{t("wiki.registerFree")}</Link>
        </Button>
      </div>
    );
  }

  if (sectorLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary/30" />
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 65px)" }}>
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur px-4 py-3 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 shrink-0" asChild>
          <Link href={`/settore/${id}`}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Brain className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-sm truncate">{t("wiki.title")}</h1>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/20 text-primary bg-primary/5 shrink-0">
              <Sparkles className="w-2 h-2 mr-1" />Premium
            </Badge>
          </div>
          {sector && (
            <p className="text-xs text-muted-foreground truncate">{sector.name}</p>
          )}
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground shrink-0"
            onClick={() => setMessages([])}
          >
            {t("wiki.newChat")}
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Brain className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-xl font-serif font-bold mb-2">
                {t("wiki.expertOf", { name: sector?.name })}
              </h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                {t("wiki.chatDesc")}
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {Array.isArray(suggestedQuestions) && suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="text-left px-4 py-3 rounded-xl border bg-card hover:border-primary/30 hover:bg-primary/5 transition-all text-sm text-muted-foreground hover:text-foreground group"
                >
                  <MessageSquare className="w-3.5 h-3.5 inline mr-2 opacity-40 group-hover:opacity-70 transition-opacity" />
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-5">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                    <Brain className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-card border rounded-tl-sm"
                  }`}
                >
                  {msg.role === "assistant" && !msg.content && isStreaming ? (
                    <div className="flex gap-1 py-1 items-center">
                      {[0, 150, 300].map((delay) => (
                        <span
                          key={delay}
                          className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce"
                          style={{ animationDelay: `${delay}ms` }}
                        />
                      ))}
                    </div>
                  ) : msg.role === "user" ? (
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  ) : (
                    <MessageContent content={msg.content} />
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1 text-xs font-bold uppercase">
                    {user.name?.charAt(0) ?? "U"}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t bg-background px-4 py-3 shrink-0">
        <div className="max-w-2xl mx-auto flex gap-2.5 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={(e) => {
              const target = e.currentTarget;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
            placeholder={t("wiki.askPlaceholder", { name: sector?.name ?? "…" })}
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-xl border bg-card px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 placeholder:text-muted-foreground/50 min-h-[42px] max-h-[120px] leading-relaxed"
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            size="icon"
            className="rounded-xl h-[42px] w-[42px] shrink-0"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-center text-[10px] text-muted-foreground/40 mt-1.5">
          {t("wiki.inputHint")}
        </p>
      </div>
    </div>
  );
}
