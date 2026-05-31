import { UiToolRenderer } from "@/components/wendy/UiToolRenderer";
import { WendyActionCard } from "@/components/wendy/WendyActionCard";
import type { ChatMessage as WendyMessage } from "@/hooks/useWendyChat";
import { withWendySuggestedPromptFallback } from "@/hooks/wendySuggestedPrompts";
import { cn } from "@/lib/utils";
import { WendySources } from "./WendySources";

interface WendyMessageBubbleProps {
  message: WendyMessage;
  onConfirmAction: (messageId: string, actionId: string, confirmationText?: string) => void;
  onCancelAction: (messageId: string, actionId: string) => void;
  onFollowUpPrompt?: (prompt: string, contextPrompt?: string) => void;
}

function buildFollowUpContext(message: WendyMessage, selectedLabel: string): string {
  const previousAnswer = message.content.trim().slice(0, 1200);
  const sources = message.contextSources?.length
    ? `Fonti gia usate: ${message.contextSources.join(", ")}.`
    : "";
  const reasoning = message.adaptiveReasoning
    ? `Decisione precedente: ${message.adaptiveReasoning.mode}; strategia dati: ${message.adaptiveReasoning.dataStrategy}.`
    : "";

  return [
    "L'utente ha scelto un prossimo passo cliccabile generato dalla tua risposta precedente.",
    `Prossimo passo scelto: ${selectedLabel}.`,
    previousAnswer ? `Risposta precedente Wendy:\n${previousAnswer}` : "",
    sources,
    reasoning,
    "Continua da qui: usa i tool dell'app quando servono dati o modifiche, proponi azioni implementabili e non ripartire da zero.",
  ].filter(Boolean).join("\n\n");
}

export function WendyMessageBubble({
  message,
  onConfirmAction,
  onCancelAction,
  onFollowUpPrompt,
}: WendyMessageBubbleProps) {
  if (message.role === "error") {
    const suggestedPrompts = onFollowUpPrompt
      ? withWendySuggestedPromptFallback(message.suggestedPrompts, message.content)
      : [];

    return (
      <div className="flex justify-start">
        <div className="flex items-start gap-2.5 max-w-[90%]">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive text-xs font-bold mt-0.5">
            !
          </div>
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            <div className="rounded-2xl rounded-tl-sm border border-destructive/20 bg-destructive/8 px-3.5 py-2.5 text-sm text-destructive">
              {message.content}
            </div>
            {suggestedPrompts.length > 0 && (
              <div className="mt-1.5 max-w-full space-y-2" aria-label="Prossimi passi Wendy">
                <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Continua con Wendy
                </p>
                <div className="flex max-w-full flex-wrap gap-1.5">
                  {suggestedPrompts.map((item) => (
                    <button
                      key={`${message.id}-${item.prompt}`}
                      type="button"
                      onClick={() => onFollowUpPrompt?.(item.prompt, buildFollowUpContext(message, item.label))}
                      className="inline-flex min-h-8 max-w-full items-center rounded-full border border-primary/20 bg-primary/8 px-2.5 text-left text-[11px] font-semibold text-foreground transition-colors hover:border-primary/35 hover:bg-primary/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                    >
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isUser = message.role === "user";
  const hasBody = !!message.content || !!message.uiTool;
  const suggestedPrompts = !isUser && !message.isStreaming
    ? withWendySuggestedPromptFallback(message.suggestedPrompts, message.content)
    : [];

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("flex items-end gap-2", isUser ? "flex-row-reverse" : "flex-row", "max-w-[88%]")}>
        {/* Avatar — solo per Wendy */}
        {!isUser && (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-sm mb-0.5">
            <span className="text-[10px] font-bold text-white">✦</span>
          </div>
        )}

        <div className={cn("flex flex-col gap-1.5", isUser ? "items-end" : "items-start")}>
          {hasBody && (
            <div
              className={cn(
                "px-4 py-2.5 text-sm leading-relaxed",
                isUser
                  ? "rounded-[18px] rounded-br-md bg-primary text-primary-foreground shadow-sm"
                  : "rounded-[18px] rounded-bl-md bg-muted/60 text-foreground backdrop-blur-sm border border-white/6",
                message.uiTool && "px-3 py-2",
              )}
            >
              {message.uiTool ? (
                <UiToolRenderer name={message.uiTool.name} args={message.uiTool.args} />
              ) : (
                <span className="whitespace-pre-wrap">{message.content}</span>
              )}
            </div>
          )}

          {!isUser && (
            <>
              {message.actions?.map((action) => (
                <WendyActionCard
                  key={action.id}
                  action={action}
                  onConfirm={(confirmationText) => onConfirmAction(message.id, action.id, confirmationText)}
                  onCancel={() => onCancelAction(message.id, action.id)}
                />
              ))}
              {suggestedPrompts.length > 0 && onFollowUpPrompt && (
                <div className="mt-1.5 max-w-full space-y-2" aria-label="Prossimi passi Wendy">
                  <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Continua con Wendy
                  </p>
                  <div className="flex max-w-full flex-wrap gap-1.5">
                    {suggestedPrompts.map((item) => (
                      <button
                        key={`${message.id}-${item.prompt}`}
                        type="button"
                        onClick={() => onFollowUpPrompt(item.prompt, buildFollowUpContext(message, item.label))}
                        className="inline-flex min-h-8 max-w-full items-center rounded-full border border-primary/20 bg-primary/8 px-2.5 text-left text-[11px] font-semibold text-foreground transition-colors hover:border-primary/35 hover:bg-primary/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                      >
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <WendySources message={message} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
