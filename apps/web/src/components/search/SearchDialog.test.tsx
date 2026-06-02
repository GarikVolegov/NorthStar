import { fireEvent, render, screen } from "@testing-library/react";
import type { UseWendyChatReturn } from "@/hooks/useWendyChat";
import { SearchDialog } from "./SearchDialog";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMessage = vi.hoisted(() => vi.fn());
const useWendyChatMock = vi.hoisted(() => vi.fn());
const setLocationMock = vi.hoisted(() => vi.fn());
const useDynamicTranslationMock = vi.hoisted(() => vi.fn());

vi.mock("wouter", () => ({
  useLocation: () => ["/", setLocationMock],
}));

vi.mock("@/contexts/WendyProvider", () => ({
  useWendy: () => ({
    close: vi.fn(),
    consumePendingAsk: vi.fn(() => null),
    getPageHints: vi.fn(() => ({
      quickActions: [{ label: "Analizza i miei progressi", icon: "*" }],
    })),
  }),
}));

vi.mock("@/hooks/useWendyChat", () => ({
  useWendyChat: useWendyChatMock,
}));

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: useDynamicTranslationMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (key === "search.noResults") return `Nessun risultato per "${params?.query ?? ""}"`;
      if (key === "search.placeholder") return "Cerca settori, ruoli, articoli...";
      if (key === "common.searching") return "Cerco...";
      if (key === "search.suggestions") return "Consigliati";
      if (key === "search.roles") return "Lavori";
      return key;
    },
  }),
}));

vi.mock("@/components/wendy/WendyConsole", () => ({
  WendyConsole: ({ query, onSubmit }: { query: string; onSubmit: () => void }) => (
    <section aria-label="Wendy chat">
      <div>Wendy console</div>
      <div data-testid="wendy-query">{query}</div>
      <button type="button" onClick={onSubmit}>
        Invia a Wendy
      </button>
    </section>
  ),
}));

function chatReturn(overrides: Partial<UseWendyChatReturn> = {}): UseWendyChatReturn {
  return {
    messages: [],
    thinking: { active: false, label: "", startedAt: 0 },
    isStreaming: false,
    streamError: null,
    retryState: { active: false, attempt: 0, max: 0 },
    restoredFromPersistence: false,
    sendMessage,
    sendContextualMessage: vi.fn(),
    sendFeedback: vi.fn(),
    stopStream: vi.fn(),
    clearHistory: vi.fn(),
    retryLast: vi.fn(),
    confirmAction: vi.fn(),
    cancelAction: vi.fn(),
    tts: { speaking: false } as UseWendyChatReturn["tts"],
    ttsEnabled: false,
    toggleTts: vi.fn(),
    openaiTts: { isSpeaking: false } as UseWendyChatReturn["openaiTts"],
    stt: {
      supported: false,
      isListening: false,
      transcript: "",
      interimTranscript: "",
      start: vi.fn(),
    } as unknown as UseWendyChatReturn["stt"],
    commitSTT: vi.fn(),
    ...overrides,
  };
}

function renderDialog(overrides: Partial<React.ComponentProps<typeof SearchDialog>> = {}) {
  return render(
    <SearchDialog
      query=""
      setQuery={vi.fn()}
      results={[]}
      suggestions={[]}
      route={{
        intent: "explore",
        user_mode: "exploring",
        experience_level: "beginner",
        needs_clarification: false,
        clarifying_question: null,
        ui_widget_type: "results_list",
        retrieval_strategy: "hybrid",
        confidence: 0.5,
      }}
      hasSemantic={false}
      isLoading={false}
      isOpen
      setIsOpen={vi.fn()}
      close={vi.fn()}
      trackClick={vi.fn()}
      {...overrides}
    />,
  );
}

describe("SearchDialog", () => {
  beforeEach(() => {
    window.innerWidth = 1024;
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    sendMessage.mockReset();
    setLocationMock.mockReset();
    useWendyChatMock.mockReset();
    useDynamicTranslationMock.mockReset();
    useDynamicTranslationMock.mockImplementation(({ source }: { source: string }) => source);
    useWendyChatMock.mockReturnValue(chatReturn());
  });

  it("labels global search separately from the Wendy chat surface", () => {
    useWendyChatMock.mockReturnValue(chatReturn({
      messages: [{ id: "m1", role: "assistant", content: "Ciao", timestamp: 1 }],
    }));

    renderDialog({
      query: "design",
      results: [{ id: 1, type: "role", title: "UX Designer", description: "Design role", url: "/roles/ux", icon: "x", color: "blue" }],
    });

    expect(screen.getByText("Ricerca globale")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Chat Wendy" })).toBeInTheDocument();
  });

  it("shows a clear empty search state that suggests asking Wendy", () => {
    renderDialog({ query: "zzzz" });

    expect(screen.getByText('Nessun risultato globale per "zzzz"')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Chiedi a Wendy/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Chiedi a Wendy/i }));

    expect(sendMessage).toHaveBeenCalledWith("zzzz");
  });

  it("shows a recoverable global search error without hiding Wendy", () => {
    renderDialog({ query: "design", isError: true });

    expect(screen.getByText("La ricerca globale non e disponibile adesso.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Chiedi a Wendy/i })).toBeInTheDocument();
  });

  it("keeps mobile search results and Wendy chat inside one reachable sheet layout", () => {
    window.innerWidth = 390;
    useWendyChatMock.mockReturnValue(chatReturn({
      messages: [{ id: "m1", role: "assistant", content: "Ciao", timestamp: 1 }],
    }));

    const { container } = renderDialog({
      query: "design",
      results: [{ id: 1, type: "role", title: "UX Designer", description: "Design role", url: "/roles/ux", icon: "x", color: "blue" }],
    });

    const commandList = container.querySelector("[cmdk-list]");
    const chatRegion = screen.getByRole("region", { name: "Chat Wendy" });

    expect(commandList).toHaveClass("min-h-0", "flex-1", "max-h-none");
    expect(commandList).not.toHaveClass("max-h-[60vh]");
    expect(chatRegion).toHaveClass("max-h-[52dvh]", "shrink-0", "overflow-hidden");
  });

  it("uses dynamic translations for the search shell copy", () => {
    useDynamicTranslationMock.mockImplementation(({ key, source }: { key?: string; source: string }) =>
      key ? `dynamic:${key}` : source,
    );

    renderDialog({ query: "zzzz" });

    expect(screen.getByText("dynamic:search.global.title")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("dynamic:search.placeholder")).toBeInTheDocument();
    expect(screen.getByText("dynamic:search.empty.title")).toBeInTheDocument();
    expect(screen.getByText("dynamic:search.empty.hint")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dynamic:search.askWendyCurrent" })).toBeInTheDocument();
  });

  it("uses dynamic translations for default suggestions and result type headings", () => {
    useDynamicTranslationMock.mockImplementation(({ key, source }: { key?: string; source: string }) =>
      key ? `dynamic:${key}` : source,
    );

    renderDialog({
      results: [{ id: 1, type: "role", title: "UX Designer", description: "Design role", url: "/roles/ux", icon: "x", color: "blue" }],
    });

    expect(screen.getAllByText("dynamic:search.suggestions.exploreSectors.title").length).toBeGreaterThan(0);
    expect(screen.getByText("dynamic:search.suggestions.takeTest.description")).toBeInTheDocument();
    expect(screen.getByText("dynamic:search.type.role")).toBeInTheDocument();
  });

  it("renders discovery source and reasons for search results", () => {
    renderDialog({
      query: "focus",
      results: [{
        id: 1,
        type: "article",
        title: "Focus profondo",
        description: "Tecniche pratiche per proteggere l'attenzione.",
        url: "/growth/focus",
        icon: "x",
        color: "blue",
        sourceLabel: "Biblioteca crescita",
        personalization: "profile",
        reasonLabels: ["Profilo: Investigativo", "Tema: focus"],
      }],
    });

    expect(screen.getByText("Biblioteca crescita")).toBeInTheDocument();
    expect(screen.getByText("Personalizzato")).toBeInTheDocument();
    expect(screen.getByText("Profilo: Investigativo")).toBeInTheDocument();
  });

  it("shows degraded index state in the result shell", () => {
    renderDialog({
      query: "focus",
      searchMode: "hybrid",
      indexStatus: "degraded",
      route: {
        intent: "explore",
        user_mode: "exploring",
        experience_level: "beginner",
        needs_clarification: false,
        clarifying_question: null,
        ui_widget_type: "results_list",
        retrieval_strategy: "hybrid",
        confidence: 0.75,
      },
      results: [{
        id: 1,
        type: "article",
        title: "Focus profondo",
        description: "Tecniche pratiche per proteggere l'attenzione.",
        url: "/growth/focus",
        icon: "x",
        color: "blue",
      }],
    });

    expect(screen.getByText("indice degraded")).toBeInTheDocument();
  });
});
