import type { UseWendyChatReturn } from "@/hooks/useWendyChat";
import { useDynamicTranslation } from "@/lib/dynamic-translation";
import { cn } from "@/lib/utils";
import { ArrowUp, Mic, Radio, Square, Volume2 } from "lucide-react";
import type { FormEvent, RefObject } from "react";
import { useTranslation } from "react-i18next";

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

type VoiceText = {
  key: string;
  source: string;
};

function sttErrorText(error: string | null): VoiceText | null {
  if (!error) return null;
  if (error === "not-allowed" || error === "service-not-allowed") {
    return {
      key: "wendy.voice.errors.notAllowed",
      source: "Permesso microfono negato. Abilita il microfono nel browser e riprova.",
    };
  }
  if (error === "audio-capture") {
    return {
      key: "wendy.voice.errors.audioCapture",
      source: "Microfono non disponibile. Controlla il dispositivo di input e riprova.",
    };
  }
  if (error === "network") {
    return {
      key: "wendy.voice.errors.network",
      source: "Connessione instabile durante la dettatura. Riprova tra un attimo.",
    };
  }
  if (error === "no-speech") {
    return {
      key: "wendy.voice.errors.noSpeech",
      source: "Non ho rilevato voce. Avvicinati al microfono e riprova.",
    };
  }
  return {
    key: "wendy.voice.errors.unavailable",
    source: "Dettatura non disponibile. Riprova o passa alla scrittura.",
  };
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
  const { i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? "it").slice(0, 2);
  const hasQuery = value.trim().length >= 2;
  const isListening = chat.stt.isListening;
  const isSpeaking = chat.openaiTts.isSpeaking || chat.tts.speaking;
  const sttError = sttErrorText(chat.stt.error);
  const voicePlaybackError = chat.openaiTts.error;
  const translatedSttError = useDynamicTranslation({
    locale,
    key: sttError?.key ?? "wendy.voice.errors.none",
    source: sttError?.source ?? "",
    context: "Wendy voice speech-to-text error shown to the user",
  });
  const translatedPlaybackError = useDynamicTranslation({
    locale,
    key: "wendy.voice.errors.playback",
    source: voicePlaybackError ?? "",
    context: "Wendy OpenAI text-to-speech playback error shown to the user",
  });
  const voiceError = sttError ? translatedSttError : voicePlaybackError ? translatedPlaybackError : null;
  const textModeLabel = useDynamicTranslation({
    locale,
    key: "wendy.voice.textMode",
    source: "Testo",
    context: "Wendy voice dock button to return to text mode",
  });
  const listeningStatus = useDynamicTranslation({
    locale,
    key: "wendy.voice.status.listening",
    source: "Ti ascolto...",
    context: "Wendy voice mode status while microphone is listening",
  });
  const thinkingStatus = useDynamicTranslation({
    locale,
    key: "wendy.voice.status.thinking",
    source: "Wendy sta pensando...",
    context: "Wendy voice mode status while generating a response",
  });
  const speakingStatus = useDynamicTranslation({
    locale,
    key: "wendy.voice.status.speaking",
    source: "Wendy sta parlando...",
    context: "Wendy voice mode status while audio playback is active",
  });
  const readyStatus = useDynamicTranslation({
    locale,
    key: "wendy.voice.status.ready",
    source: "Modalita voce pronta",
    context: "Wendy voice mode ready status",
  });
  const sendDictationLabel = useDynamicTranslation({
    locale,
    key: "wendy.voice.sendDictation",
    source: "Invia dettatura",
    context: "Wendy voice dock microphone button while listening",
  });
  const speakWithWendyLabel = useDynamicTranslation({
    locale,
    key: "wendy.voice.speakWithWendy",
    source: "Parla con Wendy",
    context: "Wendy voice mode microphone button",
  });
  const interruptWendyLabel = useDynamicTranslation({
    locale,
    key: "wendy.voice.interruptWendy",
    source: "Interrompi Wendy",
    context: "Wendy voice dock stop streaming button",
  });
  const toggleWendyVoiceLabel = useDynamicTranslation({
    locale,
    key: "wendy.voice.toggleWendyVoice",
    source: "Attiva o disattiva voce Wendy",
    context: "Wendy voice dock TTS toggle button",
  });
  const unsupportedLabel = useDynamicTranslation({
    locale,
    key: "wendy.voice.unsupported",
    source: "Il browser non supporta ancora la dettatura vocale.",
    context: "Wendy voice dock unsupported speech recognition message",
  });
  const dictateToWendyLabel = useDynamicTranslation({
    locale,
    key: "wendy.voice.dictateToWendy",
    source: "Detta a Wendy",
    context: "Wendy text mode microphone button",
  });
  const inputPlaceholder = useDynamicTranslation({
    locale,
    key: "wendy.voice.inputPlaceholder",
    source: "Chiedi a Wendy...",
    context: "Wendy text input placeholder",
  });
  const openVoiceModeLabel = useDynamicTranslation({
    locale,
    key: "wendy.voice.openVoiceMode",
    source: "Apri modalita voce",
    context: "Wendy text mode button to open voice mode",
  });
  const sendToWendyLabel = useDynamicTranslation({
    locale,
    key: "wendy.voice.sendToWendy",
    source: "Invia a Wendy",
    context: "Wendy text mode submit button",
  });

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
      ? listeningStatus
      : chat.isStreaming || chat.thinking.active
        ? thinkingStatus
        : isSpeaking
          ? speakingStatus
          : readyStatus;

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
              {textModeLabel}
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
              aria-label={isListening ? sendDictationLabel : speakWithWendyLabel}
            >
              <Mic className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={chat.isStreaming ? chat.stopStream : chat.toggleTts}
              className="flex h-11 min-w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              aria-label={chat.isStreaming ? interruptWendyLabel : toggleWendyVoiceLabel}
            >
              {chat.isStreaming ? <Square className="h-4 w-4 fill-current" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
          {!chat.stt.supported && (
            <p className="text-center text-xs text-muted-foreground">
              {unsupportedLabel}
            </p>
          )}
          {voiceError && (
            <p role="alert" className="max-w-xs text-center text-xs font-medium text-destructive">
              {voiceError}
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
          "flex min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-background/70 transition-colors focus-within:border-primary/45 focus-within:bg-background/90",
          compact ? "px-3 py-1.5" : "px-3.5 py-2",
        )}
      >
        {chat.stt.supported && (
          <button
            type="button"
            onClick={handleMicClick}
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
              isListening
                ? "bg-destructive/18 text-destructive animate-pulse"
                : "text-muted-foreground/70 hover:bg-white/8 hover:text-foreground",
            )}
            aria-label={isListening ? sendDictationLabel : dictateToWendyLabel}
          >
            <Mic className="h-4 w-4" />
          </button>
        )}

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={inputPlaceholder}
          className="min-h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
        />

        <button
          type="button"
          onClick={() => setVoiceMode(true)}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
            chat.ttsEnabled ? "text-primary hover:bg-primary/10" : "text-muted-foreground/50 hover:bg-white/8",
          )}
          aria-label={openVoiceModeLabel}
        >
          <Radio className="h-4 w-4" />
        </button>

        {chat.isStreaming ? (
          <button
            type="button"
            onClick={chat.stopStream}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-destructive/12 text-destructive transition-colors hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50"
            aria-label={interruptWendyLabel}
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!hasQuery}
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
              hasQuery
                ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                : "bg-muted text-muted-foreground/40",
            )}
            aria-label={sendToWendyLabel}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </div>
      {voiceError && (
        <p role="alert" className="mt-2 px-1 text-xs font-medium text-destructive">
          {voiceError}
        </p>
      )}
    </form>
  );
}
