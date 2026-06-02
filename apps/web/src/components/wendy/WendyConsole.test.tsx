import { act, render, screen } from "@testing-library/react";
import type { UseWendyChatReturn } from "@/hooks/useWendyChat";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { WendyConsole } from "./WendyConsole";

const useDynamicTranslationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: useDynamicTranslationMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: {
      resolvedLanguage: "en-US",
      language: "it",
    },
  }),
}));

vi.mock("@/components/WendyThinkingIndicator", () => ({
  WendyThinkingIndicator: ({ thinking }: { thinking: { active: boolean; label: string } }) => (
    thinking.active ? <div data-testid="thinking">{thinking.label}</div> : null
  ),
}));

vi.mock("@/components/search/WendyMessageBubble", () => ({
  WendyMessageBubble: ({ message }: { message: { content: string } }) => (
    <div data-testid="message">{message.content}</div>
  ),
}));

vi.mock("./WendyEmptyState", () => ({
  WendyEmptyState: () => <div data-testid="empty-state" />,
}));

vi.mock("./WendyOrb", () => ({
  WendyOrb: () => <div data-testid="orb" />,
}));

vi.mock("./WendyPromptSuggestions", () => ({
  WendyPromptSuggestions: () => <div data-testid="suggestions" />,
}));

vi.mock("./WendyVoiceDock", () => ({
  WendyVoiceDock: () => <div data-testid="voice-dock" />,
}));

function chatFixture(overrides: Partial<UseWendyChatReturn> = {}): UseWendyChatReturn {
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
      error: null,
      supported: true,
      start: vi.fn(),
      stop: vi.fn(),
      reset: vi.fn(),
      toggle: vi.fn(),
    },
    commitSTT: vi.fn(),
    ...overrides,
  } as unknown as UseWendyChatReturn;
}

describe("WendyConsole", () => {
  beforeAll(() => {
    window.HTMLElement.prototype.scrollTo = vi.fn();
  });

  beforeEach(() => {
    vi.useRealTimers();
    useDynamicTranslationMock.mockReset();
    useDynamicTranslationMock.mockImplementation(
      ({ key, source }: { key?: string; source: string }) => (key ? `dynamic:${key}` : source),
    );
  });

  it("translates header and clear-conversation chrome with the active locale", () => {
    const chat = chatFixture({
      messages: [{ id: "m-1", role: "user", content: "Come miglioro il CV?", timestamp: 1 }],
    });

    render(
      <WendyConsole
        chat={chat}
        query=""
        setQuery={() => undefined}
        onSubmit={() => undefined}
        starterPrompts={[]}
      />,
    );

    expect(screen.getByText("Wendy")).toBeInTheDocument();
    expect(screen.getByText("dynamic:wendy.console.subtitle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dynamic:wendy.console.newConversation" })).toBeInTheDocument();
    expect(screen.getByText("Come miglioro il CV?")).toBeInTheDocument();

    expect(useDynamicTranslationMock).toHaveBeenCalledWith(expect.objectContaining({
      key: "wendy.console.subtitle",
      locale: "en",
      source: "AI Career Coach",
    }));
  });

  it("translates retry, slow-thinking, and error helper copy without translating stream error data", () => {
    vi.useFakeTimers();
    const chat = chatFixture({
      thinking: { active: true, label: "Sto analizzando", startedAt: 1 },
      streamError: new Error("BACKEND_DOWN"),
      retryState: { active: true, attempt: 1, max: 2 },
    });

    const { rerender } = render(
      <WendyConsole
        chat={chat}
        query="Domanda utente"
        setQuery={() => undefined}
        onSubmit={() => undefined}
        starterPrompts={[]}
      />,
    );

    expect(screen.getByText("dynamic:wendy.console.retrying")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dynamic:wendy.console.cancel" })).toBeInTheDocument();

    rerender(
      <WendyConsole
        chat={{ ...chat, retryState: { active: false, attempt: 1, max: 2 } }}
        query="Domanda utente"
        setQuery={() => undefined}
        onSubmit={() => undefined}
        starterPrompts={[]}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(9_000);
    });

    expect(screen.getByText("dynamic:wendy.console.slowThinking")).toBeInTheDocument();
    expect(screen.getByText("dynamic:wendy.console.genericError")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dynamic:wendy.console.retry" })).toBeInTheDocument();
    expect(screen.queryByText("BACKEND_DOWN")).not.toBeInTheDocument();
    expect(useDynamicTranslationMock).not.toHaveBeenCalledWith(expect.objectContaining({
      source: "BACKEND_DOWN",
    }));
  });
});
