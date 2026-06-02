import { fireEvent, render, screen, within } from "@testing-library/react";
import type { UseWendyChatReturn } from "@/hooks/useWendyChat";
import { SearchDialog } from "./SearchDialog";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMessage = vi.hoisted(() => vi.fn());
const useWendyChatMock = vi.hoisted(() => vi.fn());
const setLocationMock = vi.hoisted(() => vi.fn());

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

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en-US", resolvedLanguage: "en-US" },
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

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: ({ key, source }: { key?: string; source: string }) =>
    key ? `dynamic:${key}` : source,
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

    expect(screen.getByText("dynamic:search.dialog.globalTitle")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "dynamic:search.dialog.wendyChatLabel" })).toBeInTheDocument();
  });

  it("renders search and Wendy chrome through dynamic translation", () => {
    useWendyChatMock.mockReturnValue(chatReturn({
      messages: [{ id: "m1", role: "assistant", content: "Ciao", timestamp: 1 }],
    }));

    renderDialog({
      query: "design",
      isError: true,
      results: [],
    });

    expect(screen.getByText("dynamic:search.dialog.globalTitle")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "dynamic:search.dialog.wendyChatLabel" })).toBeInTheDocument();
    expect(screen.getByText("dynamic:search.dialog.errorTitle")).toBeInTheDocument();
    expect(screen.queryByText("Ricerca globale")).not.toBeInTheDocument();
    expect(screen.queryByText("La ricerca globale non e disponibile adesso.")).not.toBeInTheDocument();
  });

  it("shows a clear empty search state that suggests asking Wendy", () => {
    renderDialog({ query: "zzzz" });

    expect(screen.getByText("dynamic:search.dialog.emptyTitle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dynamic:search.dialog.askWendyCurrent" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "dynamic:search.dialog.askWendyCurrent" }));

    expect(sendMessage).toHaveBeenCalledWith("zzzz");
  });

  it("shows a recoverable global search error without hiding Wendy", () => {
    renderDialog({ query: "design", isError: true });

    expect(screen.getByText("dynamic:search.dialog.errorTitle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dynamic:search.dialog.askWendyCurrent" })).toBeInTheDocument();
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
    const chatRegion = screen.getByRole("region", { name: "dynamic:search.dialog.wendyChatLabel" });

    expect(commandList).toHaveClass("min-h-0", "flex-1", "max-h-none");
    expect(commandList).not.toHaveClass("max-h-[60vh]");
    expect(chatRegion).toHaveClass("max-h-[52dvh]", "shrink-0", "overflow-hidden");
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

  it("renders discovery metadata in compact side results when Wendy is active", () => {
    useWendyChatMock.mockReturnValue(chatReturn({
      messages: [{ id: "m1", role: "assistant", content: "Ciao", timestamp: 1 }],
    }));

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

    const sideResults = screen.getByRole("region", { name: "dynamic:search.dialog.globalTitle" });

    expect(within(sideResults).getByText("Biblioteca crescita")).toBeInTheDocument();
    expect(within(sideResults).getByText("Personalizzato")).toBeInTheDocument();
    expect(within(sideResults).getByText("Profilo: Investigativo")).toBeInTheDocument();
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

    expect(screen.getByText("dynamic:search.dialog.indexStatus")).toBeInTheDocument();
  });

  it("shows degraded index state with the default router confidence", () => {
    renderDialog({
      query: "focus",
      searchMode: "hybrid",
      indexStatus: "degraded",
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

    expect(screen.getByText("dynamic:search.dialog.indexStatus")).toBeInTheDocument();
  });
});
