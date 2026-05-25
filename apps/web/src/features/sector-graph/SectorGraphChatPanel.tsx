import { SafeMarkdown } from "@/components/SafeMarkdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { GraphNode } from "@/pages/grafo-types";
import { Bot, Loader2, Send, User } from "lucide-react";
import type { RefObject } from "react";

export interface SectorGraphChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SectorGraphChatPanelProps {
  messages: SectorGraphChatMessage[];
  input: string;
  loading: boolean;
  allNodes: GraphNode[];
  inputRef: RefObject<HTMLTextAreaElement | null>;
  endRef: RefObject<HTMLDivElement | null>;
  onInputChange: (value: string) => void;
  onSend: () => void;
  t: (key: string) => string;
}

export function SectorGraphChatPanel({
  messages,
  input,
  loading,
  allNodes,
  inputRef,
  endRef,
  onInputChange,
  onSend,
  t,
}: SectorGraphChatPanelProps) {
  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border bg-card" style={{ height: "65vh" }}>
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center py-8 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-2xl">
              🕸️
            </div>
            <h3 className="mb-2 font-semibold text-foreground">{t("grafo.tabChat")}</h3>
            <p className="mb-6 max-w-xs text-sm text-muted-foreground">{t("grafo.chatDesc")}</p>
            <div className="flex w-full max-w-sm flex-col gap-2">
              {[t("grafo.chatQuestion1"), t("grafo.chatQuestion2"), t("grafo.chatQuestion3")].map((question) => (
                <button
                  key={question}
                  onClick={() => {
                    onInputChange(question);
                    inputRef.current?.focus();
                  }}
                  className="rounded-xl border border-border px-4 py-2.5 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}
          >
            {message.role === "assistant" && (
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                message.role === "user"
                  ? "rounded-tr-sm bg-primary text-primary-foreground"
                  : "rounded-tl-sm bg-muted text-foreground",
              )}
            >
              {message.role === "assistant" ? (
                <div className="space-y-1">
                  {message.content === "" && loading ? (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span className="text-xs">Elaborazione...</span>
                    </div>
                  ) : (
                    <SafeMarkdown content={message.content} className="space-y-1" />
                  )}
                </div>
              ) : (
                <p>{message.content}</p>
              )}
            </div>
            {message.role === "user" && (
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary">
                <User className="h-4 w-4 text-primary-foreground" />
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="border-t p-4">
        {allNodes.length === 0 && (
          <p className="mb-3 rounded-xl border border-warning-muted bg-warning-surface px-3 py-2 text-xs text-warning">
            {t("grafo.generateFirst")}
          </p>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder={t("grafo.chatPlaceholder")}
            className="max-h-[120px] min-h-[44px] resize-none rounded-xl text-sm"
            rows={1}
            disabled={loading || allNodes.length === 0}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSend();
              }
            }}
          />
          <Button
            size="icon"
            className="h-11 w-11 shrink-0 rounded-xl"
            onClick={onSend}
            disabled={!input.trim() || loading || allNodes.length === 0}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
