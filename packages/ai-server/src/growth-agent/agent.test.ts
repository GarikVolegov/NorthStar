import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GrowthAgentOptions, GrowthAgentToolExecutor } from "./agent";

const getLLMForRouteMock = vi.hoisted(() => vi.fn());
const chatWithToolsMock = vi.hoisted(() => vi.fn());
const chatOnceMock = vi.hoisted(() => vi.fn());
const fallbackToolExecutor = vi.hoisted(() => vi.fn());
const getToolsForIntentMock = vi.hoisted(() => vi.fn(() => [] as unknown[]));
const toolsToOpenAIFormatMock = vi.hoisted(() => vi.fn(() => [] as unknown[]));

vi.mock("../llm/client", () => ({
  getLLMForRoute: getLLMForRouteMock,
}));

vi.mock("./prompt-builder", () => ({
  buildSystemPrompt: () => "system prompt",
}));

vi.mock("./self-evaluator", () => ({
  evaluateSelf: () => ({ level: "low", needsClarification: false }),
  buildClarification: () => "clarification",
}));

vi.mock("./router-agent", () => ({
  routerAgent: {
    route: vi.fn(async () => ({
      domain: "general",
      intent: "conversation",
      confidence: 0.2,
      threshold: 0.7,
      isFallback: false,
    })),
  },
}));

vi.mock("./router-memory", () => ({
  buildRoutingHistorySummary: vi.fn(async () => ""),
}));

vi.mock("./specialist-agent", () => ({
  getSpecialist: () => null,
}));

vi.mock("./supervisor-agent", () => ({
  supervisorAgent: {
    evaluate: vi.fn(async () => ({ pass: true, score: 1 })),
    rewrite: vi.fn(async () => "rewritten"),
  },
}));

vi.mock("./memory-manager", () => ({
  loadMemory: vi.fn(async () => ({ facts: [], patterns: [] })),
  buildMemorySection: () => "",
}));

vi.mock("./memory-search", () => ({
  searchMemory: vi.fn(async () => []),
  buildContextualMemorySection: () => "",
}));

vi.mock("../wendy-brain", () => ({
  searchWendyBrain: vi.fn(async () => []),
  buildWendyBrainContextSection: () => "",
}));

vi.mock("../wendy-neural", () => ({
  buildWendyActivationContext: vi.fn(async () => null),
}));

vi.mock("./parallel-handoff", () => ({
  runParallelHandoff: vi.fn(),
}));

vi.mock("./ui-tools", () => ({
  UI_TOOLS: [],
}));

vi.mock("../wendy-router/tool-registry", () => ({
  getToolsForIntent: getToolsForIntentMock,
  toolsToOpenAIFormat: toolsToOpenAIFormatMock,
}));

vi.mock("../wendy-router/tool-handlers", () => ({
  executeToolCall: fallbackToolExecutor,
}));

vi.mock("../tools/registry", () => ({
  toolRegistry: {
    isUiTool: () => false,
  },
}));

vi.mock("./memory-save", () => ({
  scheduleMemorySave: vi.fn(),
}));

vi.mock("./ui-directives", () => ({
  buildUiDirectives: () => ({}),
}));

vi.mock("./response-context", () => ({
  loadResponseContext: vi.fn(async () => ({
    personaExamples: [],
    documentChunks: [],
    platformChunks: [],
    webResults: [],
    cot: null,
  })),
}));

vi.mock("./input-normalizer", () => ({
  normalizeInput: (value: string) => value,
}));

vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../metrics", () => ({
  recordRequest: vi.fn(),
  recordError: vi.fn(),
  recordLlmTokens: vi.fn(),
  recordToolCall: vi.fn(),
  wendyLatencySeconds: {
    startTimer: () => vi.fn(),
  },
}));

vi.mock("../tracing", () => ({
  startSpan: () => ({ end: vi.fn() }),
}));

vi.mock("../feature-flags", () => ({
  FF: {
    parallelHandoff: false,
    generativeUI: false,
    supervisorEnabled: false,
  },
}));

vi.mock("../model-router", () => ({
  modelFor: () => "test-model",
  selectModelFor: () => ({ model: "test-model", provider: "groq" }),
}));

vi.mock("../config/wendy", () => ({
  wendyConfig: {
    specialist: { temperatureLow: 0.2, temperatureHigh: 0.7 },
    agent: { maxTokensLow: 100, maxTokensHigh: 200, followUpMaxTokens: 80, chunkSize: 100, maxToolTurns: 3 },
    brain: { maxContextNodes: 3 },
  },
}));

vi.mock("./specialists/career-agent", () => ({}));
vi.mock("./specialists/mindset-agent", () => ({}));
vi.mock("./specialists/habits-agent", () => ({}));
vi.mock("./specialists/trading-agent", () => ({}));
vi.mock("./specialists/health-agent", () => ({}));

function baseOptions(executeExternalTool: GrowthAgentToolExecutor): GrowthAgentOptions {
  return {
    userId: 7,
    userContext: { name: "Ada" },
    history: [],
    userMessage: "usa due host tool",
    executeExternalTool,
  };
}

describe("runGrowthAgent tool dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getToolsForIntentMock.mockReturnValue([]);
    toolsToOpenAIFormatMock.mockReturnValue([]);
    fallbackToolExecutor.mockResolvedValue({ ok: true, data: { fallback: true } });
    getLLMForRouteMock.mockReturnValue({
      chatWithTools: chatWithToolsMock,
      chatOnce: chatOnceMock,
      chat: vi.fn(),
    });
  });

  it("dispatches multiple tool calls separately through an injected executor", async () => {
    const { runGrowthAgent } = await import("./agent");
    const executeExternalTool = vi.fn(async (name: string, args: Record<string, unknown>, userId: number) => ({
      ok: true as const,
      data: { name, args, userId },
    }));

    chatWithToolsMock.mockResolvedValueOnce({
      content: "",
      finishReason: "tool_calls",
      toolCalls: [
        { id: "call_search", name: "host_search", arguments: { q: "alpha" } },
        { id: "call_save", name: "host_save", arguments: { fact: "beta" } },
      ],
    });
    chatOnceMock.mockResolvedValueOnce("fatto");

    const events = [];
    for await (const event of runGrowthAgent(baseOptions(executeExternalTool))) {
      events.push(event);
    }

    expect(getLLMForRouteMock).toHaveBeenCalledWith({ provider: "groq" });
    expect(executeExternalTool).toHaveBeenCalledTimes(2);
    expect(executeExternalTool).toHaveBeenNthCalledWith(1, "host_search", { q: "alpha" }, 7);
    expect(executeExternalTool).toHaveBeenNthCalledWith(2, "host_save", { fact: "beta" }, 7);
    expect(fallbackToolExecutor).not.toHaveBeenCalled();
    expect(events.filter((event) => event.type === "tool_call").map((event) => event.name)).toEqual([
      "host_search",
      "host_save",
    ]);
  });

  it("chains tool calls across multiple turns and synthesizes a final answer", async () => {
    getToolsForIntentMock.mockReturnValue([{ name: "get_market_trend" }]);
    toolsToOpenAIFormatMock.mockReturnValue([
      {
        type: "function",
        function: { name: "get_market_trend", description: "trend", parameters: { type: "object", properties: {}, required: [] } },
      },
    ]);

    const { runGrowthAgent } = await import("./agent");
    const executeExternalTool = vi.fn(async (name: string, args: Record<string, unknown>, userId: number) => ({
      ok: true as const,
      data: { name, args, userId },
    }));

    // Turn 0 → ask for a tool; Turn 1 → ask for a second tool based on the first
    // result; Turn 2 (final, tools stripped) → produce the textual answer.
    chatWithToolsMock
      .mockResolvedValueOnce({
        content: "",
        finishReason: "tool_calls",
        toolCalls: [{ id: "c1", name: "get_market_trend", arguments: { role: "alpha" } }],
      })
      .mockResolvedValueOnce({
        content: "",
        finishReason: "tool_calls",
        toolCalls: [{ id: "c2", name: "get_market_trend", arguments: { role: "beta" } }],
      })
      .mockResolvedValueOnce({
        content: "Sintesi finale fondata sui dati di mercato.",
        finishReason: "stop",
        toolCalls: [],
      });

    const options: GrowthAgentOptions = {
      userId: 9,
      userContext: { name: "Ada" },
      history: [],
      userMessage: "trend del mercato per due ruoli",
      wendyIntent: "deep_analysis",
      executeExternalTool,
    };

    const events = [];
    for await (const event of runGrowthAgent(options)) {
      events.push(event);
    }

    // Three LLM turns: two tool rounds + one synthesis round.
    expect(chatWithToolsMock).toHaveBeenCalledTimes(3);
    // Last turn must be called WITHOUT tools (forced synthesis).
    expect(chatWithToolsMock.mock.calls[2]?.[1]).toEqual([]);
    // The second tool call was decided AFTER observing the first result.
    expect(executeExternalTool).toHaveBeenCalledTimes(2);
    expect(executeExternalTool).toHaveBeenNthCalledWith(1, "get_market_trend", { role: "alpha" }, 9);
    expect(executeExternalTool).toHaveBeenNthCalledWith(2, "get_market_trend", { role: "beta" }, 9);
    expect(events.filter((event) => event.type === "tool_call").map((event) => event.name)).toEqual([
      "get_market_trend",
      "get_market_trend",
    ]);
    const finalText = events
      .filter((event) => event.type === "token")
      .map((event) => (event as { value: string }).value)
      .join("");
    expect(finalText).toContain("Sintesi finale fondata sui dati");
  });
});
