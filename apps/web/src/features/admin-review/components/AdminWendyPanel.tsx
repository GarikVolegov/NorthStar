import { WendyThinkingIndicator } from "@/components/WendyThinkingIndicator";
import { Button } from "@/components/ui/button";
import { WendyMessageBubble } from "@/components/search/WendyMessageBubble";
import { useWendyChat } from "@/hooks/useWendyChat";
import { cn } from "@/lib/utils";
import { RotateCcw, Send, X } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";

type AdminWendyPanelProps = {
  open: boolean;
  section: string;
  onClose: () => void;
  selectedEntity?: Record<string, unknown> | undefined;
  filters?: Record<string, unknown> | undefined;
  visibleState?: Record<string, unknown> | undefined;
};

export function AdminWendyPanel({
  open,
  section,
  onClose,
  selectedEntity,
  filters,
  visibleState,
}: AdminWendyPanelProps) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const chat = useWendyChat({
    apiUrl: "/api/admin/wendy",
    restorePersisted: false,
    ttsEnabled: false,
    maxRetries: 0,
    buildRequestBody: (body) => {
      const nextBody = { ...body };
      delete nextBody.pageContext;
      return {
        ...nextBody,
        adminContext: {
          section,
          ...(selectedEntity ? { selectedEntity } : {}),
          ...(filters ? { filters } : {}),
          ...(visibleState ? { visibleState } : {}),
        },
      };
    },
  });

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chat.messages, chat.thinking.active]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || chat.isStreaming) return;
    setDraft("");
    void chat.sendMessage(text);
  }

  if (!open) return null;

  return (
    <aside
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 flex max-h-[82dvh] flex-col border-t bg-card shadow-2xl md:static md:z-auto md:h-screen md:max-h-none md:w-[390px] md:shrink-0 md:border-l md:border-t-0",
      )}
      aria-label="Wendy Admin"
    >
      <header className="flex min-h-16 items-center justify-between gap-3 border-b px-4">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-foreground">Wendy Admin</h2>
          <p className="truncate text-xs text-muted-foreground">{section}</p>
        </div>
        <div className="flex items-center gap-1">
          {chat.messages.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={chat.clearHistory}
              aria-label="Nuova chat Wendy Admin"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={onClose}
            aria-label="Chiudi Wendy Admin"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {chat.messages.length === 0 && !chat.thinking.active && (
          <div className="rounded-md border bg-background px-3 py-3 text-sm text-muted-foreground">
            Chiedimi stato operativo, salute agenti, code admin o azioni da preparare con conferma.
          </div>
        )}
        {chat.messages.map((message) => (
          <WendyMessageBubble
            key={message.id}
            message={message}
            onConfirmAction={(messageId, actionId, confirmationText) =>
              void chat.confirmAction(messageId, actionId, confirmationText)
            }
            onCancelAction={(messageId, actionId) => chat.cancelAction(messageId, actionId)}
            onFollowUpPrompt={(prompt, contextPrompt) =>
              contextPrompt?.trim()
                ? void chat.sendContextualMessage({
                    id: `admin-follow-up-${Date.now()}`,
                    label: prompt,
                    prompt,
                    contextPrompt,
                    isPredefined: true,
                  })
                : void chat.sendMessage(prompt)
            }
          />
        ))}
        <WendyThinkingIndicator thinking={chat.thinking} />
        {chat.streamError && (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Wendy Admin non ha risposto correttamente.
          </div>
        )}
      </div>

      <form onSubmit={submit} className="border-t p-3">
        <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-primary/30">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Chiedi a Wendy Admin..."
            className="min-h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <Button
            type={chat.isStreaming ? "button" : "submit"}
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={!chat.isStreaming && draft.trim().length < 2}
            onClick={chat.isStreaming ? chat.stopStream : undefined}
            aria-label={chat.isStreaming ? "Interrompi Wendy Admin" : "Invia a Wendy Admin"}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </aside>
  );
}
