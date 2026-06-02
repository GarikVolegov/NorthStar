import { UiToolRenderer } from "@/components/wendy/UiToolRenderer";
import { WendyActionCard } from "@/components/wendy/WendyActionCard";
import type { ChatMessage as WendyMessage } from "@/hooks/useWendyChat";
import { withWendySuggestedPromptFallback } from "@/hooks/wendySuggestedPrompts";
import type { WendySuggestedPrompt } from "@/hooks/useWendyChatSse";
import { useDynamicTranslation } from "@/lib/dynamic-translation";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
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

function useWendyMessageLocale(): string {
  const { i18n } = useTranslation();
  return (i18n.resolvedLanguage ?? i18n.language ?? "it").slice(0, 2);
}

function WendySuggestedPromptList({
  message,
  suggestedPrompts,
  onFollowUpPrompt,
}: {
  message: WendyMessage;
  suggestedPrompts: WendySuggestedPrompt[];
  onFollowUpPrompt: (prompt: string, contextPrompt?: string) => void;
}) {
  const locale = useWendyMessageLocale();
  const ariaLabel = useDynamicTranslation({
    locale,
    key: "wendy.message.followUps.ariaLabel",
    source: "Prossimi passi Wendy",
    context: "ARIA label for Wendy follow-up suggested prompt chips",
  });
  const heading = useDynamicTranslation({
    locale,
    key: "wendy.message.followUps.heading",
    source: "Continua con Wendy",
    context: "Small heading above Wendy follow-up suggested prompt chips",
  });

  return (
    <div className="mt-1.5 max-w-full space-y-2" aria-label={ariaLabel}>
      <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {heading}
      </p>
      <div className="flex max-w-full flex-wrap gap-1.5">
        {suggestedPrompts.map((item) => (
          <WendySuggestedPromptButton
            key={`${message.id}-${item.prompt}`}
            message={message}
            prompt={item}
            onFollowUpPrompt={onFollowUpPrompt}
          />
        ))}
      </div>
    </div>
  );
}

function WendySuggestedPromptButton({
  message,
  prompt,
  onFollowUpPrompt,
}: {
  message: WendyMessage;
  prompt: WendySuggestedPrompt;
  onFollowUpPrompt: (prompt: string, contextPrompt?: string) => void;
}) {
  const locale = useWendyMessageLocale();
  const label = useDynamicTranslation({
    locale,
    source: prompt.labelTranslation?.source ?? prompt.label,
    context: prompt.labelTranslation?.context ?? "Wendy follow-up suggested prompt button label",
    ...(prompt.labelTranslation?.key ? { key: prompt.labelTranslation.key } : {}),
  });
  const promptText = useDynamicTranslation({
    locale,
    source: prompt.promptTranslation?.source ?? prompt.prompt,
    context: prompt.promptTranslation?.context ?? "Prompt sent to Wendy when the user clicks a follow-up chip",
    ...(prompt.promptTranslation?.key ? { key: prompt.promptTranslation.key } : {}),
  });

  return (
    <button
      type="button"
      onClick={() => onFollowUpPrompt(promptText, buildFollowUpContext(message, label))}
      className="inline-flex min-h-8 max-w-full items-center rounded-full border border-primary/20 bg-primary/8 px-2.5 text-left text-[11px] font-semibold text-foreground transition-colors hover:border-primary/35 hover:bg-primary/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
    >
      <span className="truncate">{label}</span>
    </button>
  );
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
            {suggestedPrompts.length > 0 && onFollowUpPrompt && (
              <WendySuggestedPromptList
                message={message}
                suggestedPrompts={suggestedPrompts}
                onFollowUpPrompt={onFollowUpPrompt}
              />
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
                <WendySuggestedPromptList
                  message={message}
                  suggestedPrompts={suggestedPrompts}
                  onFollowUpPrompt={onFollowUpPrompt}
                />
              )}
              <WendySources message={message} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
