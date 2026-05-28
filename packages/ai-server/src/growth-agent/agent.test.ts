import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GrowthAgentOptions, GrowthAgentToolExecutor } from "./agent";

const createMock = vi.hoisted(() => vi.fn());
const fallbackToolExecutor = vi.hoisted(() => vi.fn());

async function* streamChunks(chunks: unknown[]) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

vi.mock("../client", () => ({
  openai: {
    chat: {
      completions: {
        create: createMock,
      },
    },
  },
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
  getToolsForIntent: () => [],
  toolsToOpenAIFormat: () => [],
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
  selectModelFor: () => ({ model: "test-model" }),
}));

vi.mock("../config/wendy", () => ({
  wendyConfig: {
    specialist: { temperatureLow: 0.2, temperatureHigh: 0.7 },
    agent: { maxTokensLow: 100, maxTokensHigh: 200, followUpMaxTokens: 80, chunkSize: 100 },
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
    fallbackToolExecutor.mockResolvedValue({ ok: true, data: { fallback: true } });
  });

  it("dispatches multiple streamed tool calls separately through an injected executor", async () => {
    const { runGrowthAgent } = await import("./agent");
    const executeExternalTool = vi.fn(async (name: string, args: Record<string, unknown>, userId: number) => ({
      ok: true as const,
      data: { name, args, userId },
    }));

    createMock
      .mockResolvedValueOnce(streamChunks([
        {
          choices: [{
            delta: {
              tool_calls: [
                { index: 0, id: "call_search", type: "function", function: { name: "host_search", arguments: "{\"q\"" } },
                { index: 1, id: "call_save", type: "function", function: { name: "host_save", arguments: "{\"fact\"" } },
              ],
            },
            finish_reason: null,
          }],
        },
        {
          choices: [{
            delta: {
              tool_calls: [
                { index: 0, function: { arguments: ":\"alpha\"}" } },
                { index: 1, function: { arguments: ":\"beta\"}" } },
              ],
            },
            finish_reason: null,
          }],
        },
        { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
      ]))
      .mockResolvedValueOnce(streamChunks([
        { choices: [{ delta: { content: "fatto" }, finish_reason: null }] },
        { choices: [{ delta: {}, finish_reason: "stop" }] },
      ]));

    const events = [];
    for await (const event of runGrowthAgent(baseOptions(executeExternalTool))) {
      events.push(event);
    }

    expect(executeExternalTool).toHaveBeenCalledTimes(2);
    expect(executeExternalTool).toHaveBeenNthCalledWith(1, "host_search", { q: "alpha" }, 7);
    expect(executeExternalTool).toHaveBeenNthCalledWith(2, "host_save", { fact: "beta" }, 7);
    expect(fallbackToolExecutor).not.toHaveBeenCalled();
    expect(events.filter((event) => event.type === "tool_call").map((event) => event.name)).toEqual([
      "host_search",
      "host_save",
    ]);
  });
});
