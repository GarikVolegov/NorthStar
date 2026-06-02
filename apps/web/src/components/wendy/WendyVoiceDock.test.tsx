import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseWendyChatReturn } from "@/hooks/useWendyChat";
import { WendyVoiceDock } from "./WendyVoiceDock";

const useDynamicTranslationMock = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en-US", resolvedLanguage: "en-US" },
  }),
}));

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: useDynamicTranslationMock,
}));

function chatWithErrors({
  sttError = null,
  openaiTtsError = null,
  sttSupported = true,
  isListening = false,
}: {
  sttError?: string | null;
  openaiTtsError?: string | null;
  sttSupported?: boolean;
  isListening?: boolean;
}): UseWendyChatReturn {
  return {
    messages: [],
    thinking: { active: false, label: "", startedAt: 0 },
    isStreaming: false,
    streamError: null,
    retryState: { active: false, attempt: 0, max: 0 },
    restoredFromPersistence: false,
    sendMessage: vi.fn(),
    sendContextualMessage: vi.fn(),
    sendFeedback: vi.fn(),
    stopStream: vi.fn(),
    clearHistory: vi.fn(),
    retryLast: vi.fn(),
    confirmAction: vi.fn(),
    cancelAction: vi.fn(),
    tts: {
      supported: true,
      speaking: false,
      paused: false,
      error: null,
      speak: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      voices: [],
      selectedVoiceURI: null,
      setSelectedVoiceURI: vi.fn(),
      rate: 1,
      setRate: vi.fn(),
      pitch: 1,
      setPitch: vi.fn(),
    },
    ttsEnabled: true,
    toggleTts: vi.fn(),
    openaiTts: {
      isSpeaking: false,
      error: openaiTtsError,
      play: vi.fn(),
      stop: vi.fn(),
    },
    stt: {
      transcript: "",
      interimTranscript: "",
      isListening,
      error: sttError,
      supported: sttSupported,
      start: vi.fn(),
      stop: vi.fn(),
      reset: vi.fn(),
      toggle: vi.fn(),
    },
    commitSTT: vi.fn(),
  } as unknown as UseWendyChatReturn;
}

describe("WendyVoiceDock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDynamicTranslationMock.mockImplementation(
      ({ key, source }: { key?: string; source: string }) => key ? `dynamic:${key}` : source,
    );
  });

  it("shows an actionable microphone permission error in voice mode", () => {
    render(
      <WendyVoiceDock
        value=""
        setValue={vi.fn()}
        onSubmit={vi.fn()}
        chat={chatWithErrors({ sttError: "not-allowed" })}
        voiceMode
        setVoiceMode={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("dynamic:wendy.voice.errors.notAllowed");
    expect(useDynamicTranslationMock).toHaveBeenCalledWith(expect.objectContaining({
      key: "wendy.voice.errors.notAllowed",
      source: "Permesso microfono negato. Abilita il microfono nel browser e riprova.",
    }));
  });

  it("shows a voice playback error when OpenAI TTS fails", () => {
    render(
      <WendyVoiceDock
        value=""
        setValue={vi.fn()}
        onSubmit={vi.fn()}
        chat={chatWithErrors({ openaiTtsError: "Voce Wendy non disponibile" })}
        voiceMode
        setVoiceMode={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("dynamic:wendy.voice.errors.playback");
  });

  it("uses dynamic translations for text mode input and controls", () => {
    render(
      <WendyVoiceDock
        value=""
        setValue={vi.fn()}
        onSubmit={vi.fn()}
        chat={chatWithErrors({})}
        voiceMode={false}
        setVoiceMode={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText("dynamic:wendy.voice.inputPlaceholder")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dynamic:wendy.voice.dictateToWendy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dynamic:wendy.voice.openVoiceMode" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dynamic:wendy.voice.sendToWendy" })).toBeInTheDocument();
  });

  it("uses dynamic translations for voice mode status and controls", () => {
    render(
      <WendyVoiceDock
        value=""
        setValue={vi.fn()}
        onSubmit={vi.fn()}
        chat={chatWithErrors({ isListening: true })}
        voiceMode
        setVoiceMode={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("dynamic:wendy.voice.status.listening");
    expect(screen.getByRole("button", { name: "dynamic:wendy.voice.sendDictation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dynamic:wendy.voice.toggleWendyVoice" })).toBeInTheDocument();
  });
});
