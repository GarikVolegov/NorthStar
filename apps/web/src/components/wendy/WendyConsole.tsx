import { WendyThinkingIndicator } from "@/components/WendyThinkingIndicator";
import { WendyMessageBubble } from "@/components/search/WendyMessageBubble";
import type { UseWendyChatReturn } from "@/hooks/useWendyChat";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { WendyEmptyState } from "./WendyEmptyState";
import { WendyOrb, type WendyOrbState } from "./WendyOrb";
import { WendyPromptSuggestions } from "./WendyPromptSuggestions";
import { WendyVoiceDock } from "./WendyVoiceDock";

interface StarterPrompt {
  label: string;
  icon?: string;
}

interface WendyConsoleProps {
  chat: UseWendyChatReturn;
  query: string;
  setQuery: (value: string) => void;
  onSubmit: () => void;
  starterPrompts: StarterPrompt[];
  inputRef?: RefObject<HTMLInputElement | null>;
  compact?: boolean;
  showOrb?: boolean;
  showSuggestions?: boolean;
  className?: string;
}

export function resolveWendyOrbState(chat: UseWendyChatReturn): WendyOrbState {
  if (chat.openaiTts.isSpeaking || chat.tts.speaking) return "speaking";
  if (chat.thinking.active || chat.isStreaming) return "thinking";
  if (chat.stt.isListening) return "listening";
  return "idle";
}

export function resolveWendyOrbLevel(chat: UseWendyChatReturn): number {
  if (chat.openaiTts.isSpeaking || chat.tts.speaking) return 0.85;
  if (chat.stt.isListening) return 0.7;
  if (chat.thinking.active) return 0.6;
  return 0.35;
}

export function WendyConsole({
  chat,
  query,
  setQuery,
  onSubmit,
  starterPrompts,
  inputRef,
  compact = false,
  showOrb = true,
  showSuggestions = true,
  className,
}: WendyConsoleProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const wasSpeakingRef = useRef(false);
  const [slowThinking, setSlowThinking] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const orbState = resolveWendyOrbState(chat);

  const hasConversation = chat.messages.length > 0 || chat.thinking.active || !!chat.streamError;
  const voiceLevel = useMemo(() => resolveWendyOrbLevel(chat), [chat]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.messages, chat.thinking.active, chat.streamError]);

  useEffect(() => {
    if (!chat.thinking.active) {
      setSlowThinking(false);
      return;
    }
    const timeout = window.setTimeout(() => setSlowThinking(true), 9_000);
    return () => window.clearTimeout(timeout);
  }, [chat.thinking.active, chat.thinking.startedAt]);

  useEffect(() => {
    if (!voiceMode) return;
    const isSpeaking = chat.openaiTts.isSpeaking || chat.tts.speaking;
    if (
      wasSpeakingRef.current &&
      !isSpeaking &&
      !chat.isStreaming &&
      !chat.stt.isListening
    ) {
      chat.stt.start();
    }
    wasSpeakingRef.current = isSpeaking;
  }, [chat, chat.isStreaming, chat.openaiTts.isSpeaking, chat.stt.isListening, chat.tts.speaking, voiceMode]);

  function handlePromptSelect(prompt: string, contextPrompt?: string) {
    setQuery(prompt);
    if (contextPrompt?.trim()) {
      void chat.sendContextualMessage({
        id: `wendy-follow-up-${Date.now()}`,
        label: prompt,
        prompt,
        contextPrompt,
        isPredefined: true,
      });
      return;
    }
    void chat.sendMessage(prompt);
  }

  return (
    <div className={cn("flex h-full min-h-[360px] flex-col overflow-hidden", className)}>
      <div className={cn("border-b border-white/8", compact ? "px-3 py-3" : "px-4 py-4")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Wendy</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              AI Career Coach
            </p>
          </div>
          {chat.messages.length > 0 && (
            <button
              type="button"
              onClick={chat.clearHistory}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              aria-label="Nuova conversazione"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {showOrb ? (
          <WendyOrb
            state={orbState}
            level={voiceLevel}
            size={compact ? 132 : 176}
            className={compact ? "my-2" : "my-1"}
          />
        ) : null}

        {showSuggestions ? (
          <WendyPromptSuggestions
            fallbackPrompts={starterPrompts}
            onPromptSelect={handlePromptSelect}
            compact={compact}
          />
        ) : null}
      </div>

      <div
        ref={scrollRef}
        className={cn("flex-1 space-y-3 overflow-y-auto", compact ? "px-3 py-3" : "px-4 py-4")}
      >
        {!hasConversation && (
          <WendyEmptyState
            starterPrompts={starterPrompts}
            onPromptSelect={handlePromptSelect}
            compact={compact}
          />
        )}

        {chat.messages.map((message) => (
          <WendyMessageBubble
            key={message.id}
            message={message}
            onConfirmAction={(messageId, actionId, confirmationText) =>
              void chat.confirmAction(messageId, actionId, confirmationText)
            }
            onCancelAction={(messageId, actionId) => chat.cancelAction(messageId, actionId)}
            onFollowUpPrompt={handlePromptSelect}
          />
        ))}

        <WendyThinkingIndicator thinking={chat.thinking} />

        {chat.retryState.active && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-primary">
            <span>
              Riprovo a connettere... ({chat.retryState.attempt}/{chat.retryState.max})
            </span>
            <button
              type="button"
              onClick={chat.stopStream}
              className="font-semibold underline underline-offset-2"
            >
              Annulla
            </button>
          </div>
        )}

        {slowThinking && chat.thinking.active && !chat.retryState.active && (
          <div className="rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-primary">
            Wendy sta ancora lavorando. Puoi interrompere e riprovare con una domanda piu breve.
          </div>
        )}

        {chat.streamError && !chat.retryState.active && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <span>
              {chat.streamError.message === "SSE_TIMEOUT"
                ? "La risposta e andata in timeout."
                : "Wendy non ha risposto correttamente."}
            </span>
            <button
              type="button"
              onClick={() => void chat.retryLast()}
              className="font-semibold underline underline-offset-2"
            >
              Riprova
            </button>
          </div>
        )}
      </div>

      <WendyVoiceDock
        value={query}
        setValue={setQuery}
        onSubmit={onSubmit}
        chat={chat}
        voiceMode={voiceMode}
        setVoiceMode={setVoiceMode}
        inputRef={inputRef}
        compact={compact}
      />
    </div>
  );
}
