import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import WendyPage from "./wendy";

const closeWendy = vi.hoisted(() => vi.fn());
const setPageContext = vi.hoisted(() => vi.fn());
const sendMessage = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en-US", resolvedLanguage: "en-US" },
  }),
}));

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: ({ key, source }: { key?: string; source: string }) =>
    key ? `dynamic:${key}` : source,
}));

vi.mock("wouter", () => ({
  Link: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/contexts/WendyProvider", () => ({
  useWendy: () => ({
    close: closeWendy,
    setPageContext,
  }),
}));

vi.mock("@/hooks/useWendyChat", () => ({
  useWendyChat: () => ({
    messages: [],
    sendMessage,
    stt: {
      isListening: false,
      transcript: "",
      interimTranscript: "",
    },
    openaiTts: { isSpeaking: false },
    tts: { speaking: false },
    thinking: { active: false },
    isStreaming: false,
  }),
}));

vi.mock("@/components/wendy/WendyConsole", () => ({
  WendyConsole: ({ starterPrompts }: { starterPrompts: Array<{ label: string }> }) => (
    <section aria-label="mock-wendy-console">
      {starterPrompts.map((prompt) => (
        <span key={prompt.label}>{prompt.label}</span>
      ))}
    </section>
  ),
  resolveWendyOrbLevel: () => 0.35,
  resolveWendyOrbState: () => "idle",
}));

vi.mock("@/components/wendy/WendyNodeStage", () => ({
  WendyNodeStage: () => <section aria-label="mock-wendy-stage" />,
  deriveWendyNodesFromMessages: () => [],
}));

vi.mock("@/components/wendy/WendyPromptSuggestions", () => ({
  WendyPromptSuggestions: ({ fallbackPrompts }: { fallbackPrompts: Array<{ label: string }> }) => (
    <section aria-label="mock-wendy-suggestions">
      {fallbackPrompts.map((prompt) => (
        <button key={prompt.label} type="button">
          {prompt.label}
        </button>
      ))}
    </section>
  ),
}));

describe("WendyPage dynamic translations", () => {
  it("renders full-screen page chrome and starter prompts through dynamic translation", () => {
    render(<WendyPage />);

    expect(screen.getByRole("button", { name: "dynamic:wendy.page.backToDashboard" })).toBeInTheDocument();
    expect(screen.getByText("dynamic:wendy.page.status.sources")).toBeInTheDocument();
    expect(screen.getByText("dynamic:wendy.page.status.views")).toBeInTheDocument();
    expect(screen.getByText("dynamic:wendy.page.activeTools")).toBeInTheDocument();
    expect(screen.getByText("dynamic:wendy.page.tools.profile.label")).toBeInTheDocument();
    expect(screen.getByText("dynamic:wendy.page.tools.memory.detail")).toBeInTheDocument();
    expect(screen.getAllByText("dynamic:wendy.page.starters.today.label").length).toBeGreaterThan(0);

    expect(screen.queryByText("Torna alla dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Strumenti attivi")).not.toBeInTheDocument();
    expect(screen.queryByText("Cosa dovrei fare oggi?")).not.toBeInTheDocument();
  });
});
