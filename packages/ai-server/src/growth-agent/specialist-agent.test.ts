import { beforeEach, describe, expect, it, vi } from "vitest";

const chatWithToolsMock = vi.hoisted(() => vi.fn());
const chatOnceMock = vi.hoisted(() => vi.fn());
const executeExternalToolMock = vi.hoisted(() => vi.fn());

vi.mock("../llm/client", () => ({
  getLLMForRoute: () => ({ chatWithTools: chatWithToolsMock, chatOnce: chatOnceMock, chat: vi.fn() }),
}));
vi.mock("./retriever", () => ({ retrieve: vi.fn(async () => []) }));
vi.mock("./web-search", () => ({ searchWeb: vi.fn(async () => []), MIN_LOCAL_CHUNKS: 2 }));
vi.mock("./chain-of-thought", () => ({ runChainOfThought: vi.fn(async () => null) }));
vi.mock("./self-evaluator", () => ({ evaluateSelf: () => ({ level: "low", needsClarification: false }) }));
vi.mock("./prompt-builder", () => ({ buildSystemPrompt: () => "system prompt" }));
vi.mock("./supervisor-agent", () => ({
  supervisorAgent: { evaluate: vi.fn(async () => ({ pass: true, score: 1 })), rewrite: vi.fn(async () => "rewritten") },
}));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("./memory-manager", () => ({
  loadMemory: vi.fn(async () => ({ facts: [], patterns: [] })),
  buildMemorySection: () => "",
  extractMemory: vi.fn(async () => null),
  mergeMemory: vi.fn(async () => undefined),
}));
vi.mock("../model-router", () => ({
  selectModelFor: () => ({ model: "test-model", provider: "groq" }),
  modelFor: () => "test-model",
}));
vi.mock("../config/wendy", () => ({
  wendyConfig: {
    specialist: {
      cotHistorySlice: 4, cotMessageTruncate: 200, personaMinScore: 0.3, documentMinScore: 0.35,
      documentTopK: 6, temperatureLow: 0.2, temperatureHigh: 0.7, maxTokensLow: 300, maxTokensHigh: 700,
      memorySaveTimeoutMs: 8000,
    },
    agent: { chunkSize: 100, maxToolTurns: 2, followUpMaxTokens: 700 },
  },
}));
vi.mock("../wendy-router/tool-registry", () => ({
  getToolsForIntent: () => [{ name: "get_market_trend" }],
  toolsToOpenAIFormat: () => [
    { type: "function", function: { name: "get_market_trend", description: "trend", parameters: { type: "object", properties: {}, required: [] } } },
  ],
}));
vi.mock("../wendy-router/tool-handlers", () => ({ executeToolCall: vi.fn(async () => ({ ok: true, data: { fallback: true } })) }));
vi.mock("./tool-args", () => ({ isClientSideToolData: () => false }));

import { SpecialistAgent, type SpecialistRunOptions } from "./specialist-agent";
import type { Domain } from "./router-agent";

class TestSpecialist extends SpecialistAgent {
  readonly DOMAIN = "career" as Domain;
  readonly PERSONA_CORE = "persona";
  readonly TONE_HINT = "tono";
  domainWebQuery(message: string): string { return message; }
}

function options(): SpecialistRunOptions {
  return {
    userId: 11,
    userContext: { name: "Ada", memorySection: "mem" },
    history: [],
    userMessage: "qual è il trend di mercato per il mio settore?",
    routeDecision: {
      domain: "career", intent: "ask_info", confidence: 0.9, threshold: 0.6,
      isFallback: false, handoffContext: "",
    } as SpecialistRunOptions["routeDecision"],
    wendyIntent: "deep_analysis",
    executeExternalTool: executeExternalToolMock,
  };
}

describe("SpecialistAgent tool loop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executeExternalToolMock.mockResolvedValue({ ok: true, data: { trend: "up" } });
  });

  it("uses the app tools (multi-step) instead of answering from memory", async () => {
    chatWithToolsMock
      .mockResolvedValueOnce({ content: "", finishReason: "tool_calls", toolCalls: [{ id: "c1", name: "get_market_trend", arguments: { sector: "data" } }] })
      .mockResolvedValueOnce({ content: "Sintesi specialist fondata sui dati di mercato.", finishReason: "stop", toolCalls: [] });

    const events = [];
    for await (const event of new TestSpecialist().run(options())) {
      events.push(event);
    }

    // The specialist called the real tool through the injected executor.
    expect(executeExternalToolMock).toHaveBeenCalledWith("get_market_trend", { sector: "data" }, 11);
    expect(events.filter((e) => e.type === "tool_call").map((e) => (e as { name: string }).name)).toEqual(["get_market_trend"]);
    // Final turn drops tools (forced synthesis) and streams the answer.
    expect(chatWithToolsMock).toHaveBeenCalledTimes(2);
    expect(chatWithToolsMock.mock.calls[1]?.[1]).toEqual([]);
    const finalText = events.filter((e) => e.type === "token").map((e) => (e as { value: string }).value).join("");
    expect(finalText).toContain("Sintesi specialist fondata sui dati");
  });
});
