import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/hooks/useWendyChat";
import { WendySources } from "./WendySources";

const useDynamicTranslationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: useDynamicTranslationMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en-US", resolvedLanguage: "en-US" },
  }),
}));

function message(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: "msg-1",
    role: "assistant",
    content: "Risposta Wendy",
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("WendySources", () => {
  beforeEach(() => {
    useDynamicTranslationMock.mockReset();
    useDynamicTranslationMock.mockImplementation(({ source }: { source: string }) => source);
  });

  it("surfaces adaptive reasoning when Wendy used profile and market data", () => {
    render(
      <WendySources
        message={message({
          adaptiveReasoning: {
            mode: "tool_action",
            reasoningDepth: "grounded",
            dataStrategy: "profile_market",
            executionMode: "tool_augmented_chat",
            selfCheck: ["grounded_sources", "specific_next_step"],
          },
        })}
      />,
    );

    expect(screen.getByText("Profilo + mercato")).toBeInTheDocument();
    expect(screen.getByText("Ragionamento guidato")).toBeInTheDocument();
  });

  it("renders discovery-oriented source labels", () => {
    render(
      <WendySources
        message={message({
          contextSources: ["growth-library", "search-index", "keyword-fallback"],
        })}
      />,
    );

    expect(screen.getByText("Biblioteca crescita")).toBeInTheDocument();
    expect(screen.getByText("Indice NorthStar")).toBeInTheDocument();
    expect(screen.getByText("Ricerca keyword")).toBeInTheDocument();
  });

  it("uses dynamic translations for Wendy source and reasoning chrome", () => {
    useDynamicTranslationMock.mockImplementation(({ key, source }: { key?: string; source: string }) =>
      key ? `dynamic:${key}` : source,
    );

    render(
      <WendySources
        message={message({
          answerMode: "llm-full-path",
          contextSources: ["app-data", "semantic-memory"],
          adaptiveReasoning: {
            mode: "tool_action",
            reasoningDepth: "deliberate",
            dataStrategy: "profile_market",
            executionMode: "tool_augmented_chat",
            selfCheck: [],
          },
        })}
      />,
    );

    expect(screen.getByLabelText("dynamic:wendy.sources.usedByWendy")).toBeInTheDocument();
    expect(screen.getByText("dynamic:wendy.sources.answerMode.llmFullPath")).toBeInTheDocument();
    expect(screen.getByText("dynamic:wendy.sources.reasoningDepth.deliberate")).toBeInTheDocument();
    expect(screen.getByText("dynamic:wendy.sources.dataStrategy.profileMarket")).toBeInTheDocument();
    expect(screen.getByText("dynamic:wendy.sources.context.appData")).toBeInTheDocument();
    expect(screen.getByText("dynamic:wendy.sources.context.semanticMemory")).toBeInTheDocument();
  });
});
