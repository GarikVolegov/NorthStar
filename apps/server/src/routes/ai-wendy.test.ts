import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const executeWendyToolCallMock = vi.hoisted(() => vi.fn());
const agentRegistryMock = vi.hoisted(() => ({
  getSnapshot: vi.fn(),
  update: vi.fn(),
  clear: vi.fn(),
}));

vi.mock("../middleware/auth", () => ({
  optionalAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    if (req.headers.authorization !== "Bearer test-token") {
      next();
      return;
    }
    req.user = {
      id: 42,
      email: "ada@example.com",
      name: "Ada",
      role: "user",
      onboardingCompleted: true,
      journeyType: "indeciso",
      stripeSubscriptionId: null,
      testSessionId: null,
    };
    next();
  },
  requireAuth: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.headers.authorization !== "Bearer test-token") {
      res.status(401).json({ error: "Token mancante" });
      return;
    }
    req.user = {
      id: 42,
      email: "ada@example.com",
      name: "Ada",
      role: "user",
      onboardingCompleted: true,
      journeyType: "indeciso",
      stripeSubscriptionId: null,
      testSessionId: null,
    };
    next();
  },
}));

vi.mock("../middleware/rate-limit", () => ({
  wendyLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock("../middleware/logger", () => ({
  rootLogger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../middleware/check-feature", () => ({
  checkFeatureAccess: vi.fn(async () => ({ allowed: true })),
  getEffectivePlan: vi.fn(async () => "free"),
  planMeets: vi.fn(() => false),
}));

vi.mock("../lib/redis", () => ({
  cacheIncr: vi.fn(async () => 1),
}));

vi.mock("../lib/agent-registry", () => ({
  agentRegistry: agentRegistryMock,
}));

vi.mock("../lib/wikillm-context-router", () => ({
  buildWikiLLMContext: vi.fn(async () => ({
    context: "",
    contexts: { semanticMemory: "", openHuman: "", graphify: "", wendyBrain: "" },
    sources: [],
  })),
}));

vi.mock("../lib/wendy-tool-executor", () => ({
  executeWendyToolCall: executeWendyToolCallMock,
}));

vi.mock("../lib/semantic-memory", () => ({
  storeSemanticTurnInBackground: vi.fn(),
}));

vi.mock("@workspace/ai-server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/ai-server")>();
  return {
    ...actual,
    buildWendyActivationContext: vi.fn(async () => null),
    ensureWendyConfigFresh: vi.fn(async () => undefined),
    evaluateWendyResponse: vi.fn(() => ({ ok: true, score: 1, issues: [] })),
    getEffectivePlan: vi.fn(async () => "free"),
    getLLMForRoute: vi.fn(),
    isLlmConfigured: vi.fn(() => true),
    loadMemory: vi.fn(async () => null),
    loadRecentSummaries: vi.fn(async () => []),
    persistActivationTrace: vi.fn(async () => undefined),
    recordAiCall: vi.fn(),
    recordCost: vi.fn(),
    recordQualityScore: vi.fn(),
    recordTtft: vi.fn(),
    recordWendyCost: vi.fn(),
    reinforceCoActivations: vi.fn(async () => undefined),
    runGrowthAgent: vi.fn(),
  };
});

import aiWendyRouter from "./ai-wendy";

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/ai/wendy", aiWendyRouter);
  return instance;
}

function parseSse(text: string) {
  return text
    .split("\n\n")
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.startsWith("data: "))
    .map((chunk) => JSON.parse(chunk.slice("data: ".length)) as Record<string, unknown>);
}

describe("ai Wendy route fallbacks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agentRegistryMock.getSnapshot.mockResolvedValue({
      agents: [{ slug: "wendy", isActive: true }],
    });
    executeWendyToolCallMock.mockImplementation(async (name: string) => {
      if (name === "get_user_objectives") {
        return {
          ok: true,
          data: { objectives: [{ id: 7, text: "Finire il portfolio", progress: 40 }] },
        };
      }
      if (name === "get_user_context") {
        return {
          ok: true,
          data: { journeyType: "autonomo", preferredSectors: [{ name: "Cybersecurity" }] },
        };
      }
      return { ok: true, data: { updated: true } };
    });
  });

  it("streams token, done, and coherent suggested prompts for Italian data-backed fallback actions", async () => {
    const response = await request(app())
      .post("/api/ai/wendy")
      .set("Authorization", "Bearer test-token")
      .send({ message: "Cosa dovrei fare oggi?", locale: "en" })
      .expect(200);

    const events = parseSse(response.text);
    const token = events.find((event) => event.type === "token");
    const done = events.find((event) => event.type === "done");

    expect(token?.value).toContain("Finire il portfolio");
    expect(done).toMatchObject({
      answerMode: "local-quick-action",
      suggestedPrompts: expect.any(Array),
    });
    expect(done?.suggestedPrompts).toHaveLength(3);
    expect(done?.suggestedPrompts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Aggiorna obiettivo" }),
      ]),
    );
    expect(JSON.stringify(done?.suggestedPrompts)).toMatch(/oggi|25 minuti|obiettivo/i);
    expect(response.text).toMatch(/\n\ndata: \{"type":"done"/);
    expect(agentRegistryMock.clear).toHaveBeenCalled();
  });

  it("returns a non-retryable login gate over SSE for guests", async () => {
    const response = await request(app())
      .post("/api/ai/wendy")
      .send({ message: "Ciao Wendy", locale: "it" })
      .expect(200);

    expect(response.headers["content-type"]).toContain("text/event-stream");
    const events = parseSse(response.text);

    expect(events).toEqual([
      expect.objectContaining({
        type: "gate",
        feature: "auth_required",
        authRequired: true,
        retryable: false,
        loginUrl: "/sign-in",
        message: expect.stringContaining("Accedi"),
      }),
    ]);
    expect(agentRegistryMock.getSnapshot).not.toHaveBeenCalled();
    expect(agentRegistryMock.update).not.toHaveBeenCalled();
  });
});
