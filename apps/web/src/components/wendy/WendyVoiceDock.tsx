import type { UseWendyChatReturn } from "@/hooks/useWendyChat";
import { cn } from "@/lib/utils";
import { ArrowUp, Mic, Radio, Square, Volume2 } from "lucide-react";
import type { FormEvent, RefObject } from "react";

interface WendyVoiceDockProps {
  value: string;
  setValue: (value: string) => void;
  onSubmit: () => void;
  chat: UseWendyChatReturn;
  voiceMode: boolean;
  setVoiceMode: (enabled: boolean) => void;
  inputRef?: RefObject<HTMLInputElement | null> | undefined;
  compact?: boolean;
}

export function WendyVoiceDock({
  value,
  setValue,
  onSubmit,
  chat,
  voiceMode,
  setVoiceMode,
  inputRef,
  compact = false,
}: WendyVoiceDockProps) {
  const hasQuery = value.trim().length >= 2;
  const isListening = chat.stt.isListening;
  const isSpeaking = chat.openaiTts.isSpeaking || chat.tts.speaking;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  function handleMicClick() {
    if (isListening) {
      chat.commitSTT();
      return;
    }
    chat.stt.start();
  }

  if (voiceMode) {
    const status = isListening
      ? "Ti ascolto..."
      : chat.isStreaming || chat.thinking.active
        ? "Wendy sta pensando..."
        : isSpeaking
          ? "Wendy sta parlando..."
          : "Modalita voce pronta";

    return (
      <div className="border-t border-white/8 bg-background/65 px-4 py-4 backdrop-blur-xl">
        <div className="flex flex-col items-center gap-3">
          <div role="status" aria-live="polite" className="text-xs font-medium text-muted-foreground">
            {status}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setVoiceMode(false)}
              className="flex h-11 min-w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              Testo
            </button>
            <button
              type="button"
              onClick={handleMicClick}
              disabled={!chat.stt.supported || chat.isStreaming}
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                isListening
                  ? "border-destructive/40 bg-destructive/20 text-destructive shadow-[0_0_36px_rgba(192,113,107,0.28)]"
                  : "border-primary/35 bg-primary/18 text-primary shadow-[0_0_36px_rgba(193,158,74,0.24)]",
                (!chat.stt.supported || chat.isStreaming) && "cursor-not-allowed opacity-50",
              )}
              aria-label={isListening ? "Invia dettatura" : "Parla con Wendy"}
            >
              <Mic className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={chat.isStreaming ? chat.stopStream : chat.toggleTts}
              className="flex h-11 min-w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              aria-label={chat.isStreaming ? "Interrompi Wendy" : "Attiva o disattiva voce Wendy"}
            >
              {chat.isStreaming ? <Square className="h-4 w-4 fill-current" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
          {!chat.stt.supported && (
            <p className="text-center text-xs text-muted-foreground">
              Il browser non supporta ancora la dettatura vocale.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "border-t border-white/8 bg-background/65 backdrop-blur-xl",
        compact ? "px-3 py-2" : "px-4 py-3",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl border border-white/10 bg-background/70 transition-colors focus-within:border-primary/45 focus-within:bg-background/90",
          compact ? "px-3 py-1.5" : "px-3.5 py-2",
        )}
      >
        {chat.stt.supported && (
          <button
            type="button"
            onClick={handleMicClick}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
              isListening
                ? "bg-destructive/18 text-destructive animate-pulse"
                : "text-muted-foreground/70 hover:bg-white/8 hover:text-foreground",
            )}
            aria-label={isListening ? "Invia dettatura" : "Detta a Wendy"}
          >
            <Mic className="h-4 w-4" />
          </button>
        )}

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Chiedi a Wendy..."
          className="min-h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
        />

        <button
          type="button"
          onClick={() => setVoiceMode(true)}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
            chat.ttsEnabled ? "text-primary hover:bg-primary/10" : "text-muted-foreground/50 hover:bg-white/8",
          )}
          aria-label="Apri modalita voce"
        >
          <Radio className="h-4 w-4" />
        </button>

        {chat.isStreaming ? (
          <button
            type="button"
            onClick={chat.stopStream}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/12 text-destructive transition-colors hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50"
            aria-label="Interrompi Wendy"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!hasQuery}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
              hasQuery
                ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                : "bg-muted text-muted-foreground/40",
            )}
            aria-label="Invia a Wendy"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </div>
    </form>
  );
}
