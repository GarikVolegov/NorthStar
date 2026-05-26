import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValues = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const mockInsert = vi.hoisted(() => vi.fn(() => ({ values: mockValues })));

vi.mock("@workspace/db", () => ({
  db: { insert: mockInsert },
  aiCostLogTable: { tableName: "ai_cost_log" },
  aiRequestLogTable: { tableName: "ai_request_log" },
}));

vi.mock("../logger", () => ({
  logger: { warn: vi.fn() },
}));

import { recordAiCall } from "../ai-request-log";

describe("recordAiCall cost telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes the unified ai_cost_log row with routing, model, cost, latency, and quality fields", () => {
    recordAiCall({
      requestId: "1f5100d4-9cd1-478a-b51f-ef9b3af1ad1f",
      userId: 7,
      threadId: "thread-1",
      intent: "plan",
      domain: "career",
      tier: "standard",
      model: "gpt-4o-mini",
      inputTokens: 120,
      outputTokens: 80,
      costUsdEst: 0.0012,
      latencyMs: 450,
      totalTurns: 2,
      status: "success",
      supervisorScore: 0.82,
      wasRewritten: true,
      ttftMs: 140,
    });

    expect(mockInsert).toHaveBeenCalledWith({ tableName: "ai_cost_log" });
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "1f5100d4-9cd1-478a-b51f-ef9b3af1ad1f",
        userId: 7,
        sessionId: "thread-1",
        intent: "plan",
        domain: "career",
        tier: "standard",
        phase: "specialist",
        role: "wendy",
        model: "gpt-4o-mini",
        inputTokens: 120,
        outputTokens: 80,
        costUsdEstimate: "0.001200",
        latencyMs: 450,
        supervisorScore: "0.820",
        wasRewritten: true,
        ttftMs: 140,
        status: "success",
      }),
    );
  });
});
