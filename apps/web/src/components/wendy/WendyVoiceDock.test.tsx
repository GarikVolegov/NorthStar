import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { UseWendyChatReturn } from "@/hooks/useWendyChat";
import { WendyVoiceDock } from "./WendyVoiceDock";

function chatWithSttError(error: string | null): UseWendyChatReturn {
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
      error: null,
      play: vi.fn(),
      stop: vi.fn(),
    },
    stt: {
      transcript: "",
      interimTranscript: "",
      isListening: false,
      error,
      supported: true,
      start: vi.fn(),
      stop: vi.fn(),
      reset: vi.fn(),
      toggle: vi.fn(),
    },
    commitSTT: vi.fn(),
  } as unknown as UseWendyChatReturn;
}

describe("WendyVoiceDock", () => {
  it("shows an actionable microphone permission error in voice mode", () => {
    render(
      <WendyVoiceDock
        value=""
        setValue={vi.fn()}
        onSubmit={vi.fn()}
        chat={chatWithSttError("not-allowed")}
        voiceMode
        setVoiceMode={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/microfono/i);
    expect(screen.getByRole("alert")).toHaveTextContent(/permesso/i);
  });
});
