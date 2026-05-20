/**
 * WendyFocusMode — interfaccia full-screen per sessioni di research approfondita.
 *
 * Differenze rispetto alla chat normale:
 *   - Full-screen overlay con layout document-style
 *   - Risposte più lunghe (maxTokens: 2000 lato server)
 *   - Citazioni RAG visualizzate inline con badge fonte
 *   - Export della risposta in Markdown (clipboard)
 *   - Richiede piano Pro (gate lato server + client)
 */
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UpgradeGate } from "@/components/ui/UpgradeGate";
import { useSubscription } from "@/hooks/useSubscription";
import { stream } from "@/lib/apiClient";
import { TOKEN_STORAGE_KEY } from "@/lib/storage-keys";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Check,
  Copy,
  Loader2,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useRef, useState } from "react";

interface WendyFocusModeProps {
  onClose: () => void;
}

interface FocusMessage {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}

export function WendyFocusMode({ onClose }: WendyFocusModeProps) {
  useSubscription();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<FocusMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");

  async function handleSend() {
    if (!input.trim() || streaming) return;

    const userMsg: FocusMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let accumulated = "";
    const sources: string[] = [];

    const assistantMsg: FocusMessage = {
      role: "assistant",
      content: "",
      sources: [],
    };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const token =
        sessionStorage.getItem(TOKEN_STORAGE_KEY) ??
        localStorage.getItem(TOKEN_STORAGE_KEY) ??
        sessionStorage.getItem("ns_token") ??
        localStorage.getItem("ns_token") ??
        "";
      const res = await stream("/api/ai/wendy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMsg.content,
          locale: "it",
          focusMode: true, // hint al server per maxTokens più alto
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error("Risposta non valida");

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
            const event = JSON.parse(line.slice(6));
            if (event.type === "token") {
              accumulated += event.value;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (!last) return prev;
                if (last.role !== "assistant") return prev;
                return [
                  ...prev.slice(0, -1),
                  { ...last, content: accumulated },
                ];
              });
            }
            if (event.type === "done" && event.ragSourcesUsed?.length) {
              sources.push(...event.ragSourcesUsed);
            }
          } catch {
            /* skip */
          }
        }
      }

      // Aggiorna con sorgenti finali
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (!last) return prev;
        if (last.role !== "assistant") return prev;
        return [
          ...prev.slice(0, -1),
          { ...last, content: accumulated, sources },
        ];
      });
    } catch (e: unknown) {
      if ((e as Error).name !== "AbortError") {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            role: "assistant",
            content: "Qualcosa è andato storto. Riprova tra poco.",
          },
        ]);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      setTimeout(
        () => bodyRef.current?.scrollTo({ top: 99999, behavior: "smooth" }),
        100,
      );
    }
  }

  function handleCopy() {
    if (!lastAssistant) return;
    navigator.clipboard.writeText(lastAssistant.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleAbort() {
    abortRef.current?.abort();
    setStreaming(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="font-bold text-sm text-foreground">
              Wendy Focus
            </span>
            <span className="ml-2 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5">
              Pro
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastAssistant && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-1.5 text-xs"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copiato" : "Copia"}
            </Button>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body — contenuto scrollabile */}
      <div
        ref={bodyRef}
        className="flex-1 overflow-y-auto px-6 py-6 max-w-3xl w-full mx-auto space-y-6"
      >
        {messages.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Sparkles className="h-10 w-10 text-primary/30 mx-auto mb-4" />
            <p className="text-base font-semibold text-foreground mb-2">
              Modalità Focus
            </p>
            <p className="text-sm max-w-sm mx-auto">
              Fai una domanda approfondita — Wendy analizzerà il knowledge base,
              citerà le fonti e produrrà una risposta strutturata.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {[
                "Analizza il mercato del lavoro nell'AI per il 2025",
                "Quali skill emergenti stanno crescendo in Italia?",
                "Piano di carriera per diventare Data Engineer in 12 mesi",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            {msg.role === "user" ? (
              <div className="flex justify-end">
                <div className="max-w-lg rounded-2xl bg-primary/10 border border-primary/20 px-4 py-3 text-sm text-foreground">
                  {msg.content}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="max-w-none text-foreground leading-relaxed text-sm whitespace-pre-wrap font-[inherit]">
                  {msg.content || "…"}
                </div>
                {/* Fonti RAG */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Fonti:
                    </span>
                    {msg.sources.map((src, j) => (
                      <span
                        key={j}
                        className="text-xs bg-muted/50 border border-border rounded px-2 py-0.5"
                      >
                        {src}
                      </span>
                    ))}
                  </div>
                )}
                {/* Streaming indicator */}
                {streaming && i === messages.length - 1 && (
                  <span className="inline-block w-1.5 h-4 bg-primary/60 rounded-full animate-pulse ml-1" />
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="px-6 pb-6 pt-4 border-t border-border shrink-0 max-w-3xl w-full mx-auto">
        <div className="flex gap-3 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Fai una domanda approfondita… (Invio per inviare, Shift+Invio per andare a capo)"
            className="resize-none min-h-[56px] max-h-[160px] text-sm"
            rows={2}
          />
          {streaming ? (
            <Button
              variant="outline"
              onClick={handleAbort}
              className="shrink-0 gap-2"
            >
              <Loader2 className="h-4 w-4 animate-spin" /> Stop
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={!input.trim()}
              className="shrink-0 gap-2"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * WendyFocusTrigger — pulsante che apre Focus Mode, con gate automatico.
 */
export function WendyFocusTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <UpgradeGate feature="wendy_focus_mode" plan="pro" compact>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs"
          onClick={() => setOpen(true)}
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Modalità Focus
        </Button>
      </UpgradeGate>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <WendyFocusMode onClose={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
