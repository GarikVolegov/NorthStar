import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCareerChat, type ChatMessage } from "@/hooks/useAIAgents";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Loader2, MessageSquare, Send, Sparkles, User, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  profile?: Record<string, unknown>;
  isPremium?: boolean;
  className?: string;
}

const STARTER_QUESTIONS = [
  "Quali professioni si adattano meglio al mio profilo?",
  "Come posso entrare nel settore che mi è stato consigliato?",
  "Quanto posso guadagnare con il mio profilo?",
  "Come prepararmi per un colloquio in questo settore?",
];

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  id: string;
}

export function CareerChat({ profile, isPremium = false, className }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: sendMessage, isPending } = useCareerChat();

  useEffect(() => {
    if (isOpen && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [displayMessages, isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const sendMsg = useCallback(
    async (text: string) => {
      if (!text.trim() || isPending) return;

      const userMsg: DisplayMessage = { role: "user", content: text, id: crypto.randomUUID() };
      setDisplayMessages((prev) => [...prev, userMsg]);

      const newHistory: ChatMessage[] = [...history, { role: "user", content: text }];
      setHistory(newHistory);
      setInput("");

      try {
        const res = await sendMessage({
          messages: newHistory,
          profile: profile ?? {},
        });

        const assistantContent = res.success && res.reply
          ? res.reply
          : "Mi dispiace, si è verificato un errore. Riprova tra poco.";

        const assistantMsg: DisplayMessage = {
          role: "assistant",
          content: assistantContent,
          id: crypto.randomUUID(),
        };
        setDisplayMessages((prev) => [...prev, assistantMsg]);
        setHistory((prev) => [...prev, { role: "assistant", content: assistantContent }]);
      } catch {
        const errorMsg: DisplayMessage = {
          role: "assistant",
          content: "Il servizio AI è temporaneamente non disponibile. Riprova tra qualche istante.",
          id: crypto.randomUUID(),
        };
        setDisplayMessages((prev) => [...prev, errorMsg]);
      }
    },
    [history, isPending, profile, sendMessage],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMsg(input);
  };

  return (
    <div className={cn("relative", className)}>
      {/* Toggle button */}
      <Button
        onClick={() => setIsOpen((o) => !o)}
        variant="outline"
        className={cn(
          "gap-2 border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100 hover:text-violet-800 transition-all",
          isOpen && "bg-violet-100",
        )}
      >
        {isOpen ? <X className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
        {isOpen ? "Chiudi chat" : "Chatta con NorthStar AI"}
        {!isOpen && (
          <Badge variant="secondary" className="bg-violet-100 text-violet-700 text-xs ml-1">
            Nuovo
          </Badge>
        )}
      </Button>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="mt-3 w-full"
          >
            <Card className="border-violet-200/70 shadow-lg overflow-hidden">
              <CardHeader className="py-3 px-4 bg-gradient-to-r from-violet-50 to-indigo-50/50 border-b border-violet-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-violet-600" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-foreground">NorthStar AI</CardTitle>
                    <p className="text-xs text-muted-foreground">Assistente orientamento professionale</p>
                  </div>
                  <Badge variant="outline" className="ml-auto border-violet-200 text-violet-700 text-xs gap-1">
                    <Sparkles className="w-3 h-3" />
                    {isPremium ? "Premium" : "AI"}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {/* Messages area */}
                <div className="h-80 overflow-y-auto p-4 space-y-3 bg-background/60">
                  {displayMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center">
                        <Bot className="w-6 h-6 text-violet-600" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">Ciao! Sono NorthStar AI</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Hai domande sul tuo profilo o sulla tua carriera?
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-sm">
                        {STARTER_QUESTIONS.map((q) => (
                          <button
                            key={q}
                            onClick={() => void sendMsg(q)}
                            className="text-xs text-left px-3 py-2 rounded-lg border border-violet-100 bg-violet-50/50 text-violet-700 hover:bg-violet-100 transition-colors leading-snug"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {displayMessages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}
                    >
                      {msg.role === "assistant" && (
                        <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="w-3 h-3 text-violet-600" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                          msg.role === "user"
                            ? "bg-violet-600 text-white rounded-tr-sm"
                            : "bg-muted/70 text-foreground rounded-tl-sm",
                        )}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      {msg.role === "user" && (
                        <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center shrink-0 mt-0.5">
                          <User className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </motion.div>
                  ))}

                  {isPending && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex gap-2 justify-start"
                    >
                      <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                        <Bot className="w-3 h-3 text-violet-600" />
                      </div>
                      <div className="bg-muted/70 rounded-2xl rounded-tl-sm px-4 py-3">
                        <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
                      </div>
                    </motion.div>
                  )}

                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-violet-100/60 bg-background/80">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Scrivi una domanda sulla tua carriera…"
                    disabled={isPending}
                    className="flex-1 text-sm px-3 py-2 rounded-xl border border-input bg-background/60 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-300 disabled:opacity-50 transition-all"
                    maxLength={1000}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={isPending || !input.trim()}
                    className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white shrink-0"
                  >
                    {isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
