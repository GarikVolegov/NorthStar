import { describe, it, expect, vi, beforeEach } from "vitest";
import { RouterAgent } from "../growth-agent/router-agent";

const mockChatOnce = vi.fn();

vi.mock("../llm/client", () => ({
  getLLM: vi.fn(() => ({
    chatOnce: mockChatOnce,
  })),
}));

vi.mock("../growth-agent/memory-manager", () => ({
  loadMemory: vi.fn().mockResolvedValue({ facts: [], patterns: [] }),
}));

vi.mock("../growth-agent/router-memory", () => ({
  loadRoutingContext: vi.fn(() => ""),
  commitRoute: vi.fn(),
  logRouteDecision: vi.fn(),
}));

interface MockRouteResponse {
  domain?: string;
  intent?: string;
  confidence?: number;
  reasoning?: string;
  handoffContext?: string;
  secondaryDomain?: string;
  secondaryConfidence?: number;
  secondaryIntent?: string;
  secondaryHandoffContext?: string;
}

function mockRouterResponse(overrides: MockRouteResponse = {}) {
  mockChatOnce.mockResolvedValue(
    JSON.stringify({
      domain: "career",
      intent: "problem_solve",
      confidence: 0.85,
      reasoning: "User asks about salary negotiation",
      handoffContext: "Wants concrete strategies",
      ...overrides,
    }),
  );
}

function mockFallbackResponse() {
  mockChatOnce.mockRejectedValue(new Error("LLM unavailable"));
}

describe("RouterAgent", () => {
  let router: RouterAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    router = new RouterAgent();
  });

  it("classifies career + problem_solve", async () => {
    mockRouterResponse({ domain: "career", intent: "problem_solve", confidence: 0.85 });
    const decision = await router.route("come faccio a negoziare lo stipendio?");
    expect(decision.domain).toBe("career");
    expect(decision.intent).toBe("problem_solve");
    expect(decision.confidence).toBeGreaterThanOrEqual(0.70);
    expect(decision.isFallback).toBeFalsy();
  });

  it("classifies vent for emotional messages", async () => {
    mockRouterResponse({ domain: "general", intent: "vent", confidence: 0.55 });
    const decision = await router.route("non ce la faccio pi\u00f9, sono esausto");
    expect(decision.intent).toBe("vent");
    expect(decision.isFallback).toBeFalsy();
  });

  it("classifies finance + plan", async () => {
    mockRouterResponse({ domain: "finance", intent: "plan", confidence: 0.78 });
    const decision = await router.route("fammi un piano per risparmiare 500 euro al mese");
    expect(decision.domain).toBe("finance");
    expect(decision.intent).toBe("plan");
  });

  it("classifies trading for active market queries", async () => {
    mockRouterResponse({ domain: "trading", intent: "explore", confidence: 0.75 });
    const decision = await router.route("XAUUSD sta rompendo resistenza, che ne pensi?");
    expect(decision.domain).toBe("trading");
    expect(decision.confidence).toBeGreaterThanOrEqual(0.70);
  });

  it("classifies mindset for belief-related messages", async () => {
    mockRouterResponse({ domain: "mindset", intent: "reflect", confidence: 0.72 });
    const decision = await router.route("ho paura di non essere abbastanza bravo");
    expect(decision.domain).toBe("mindset");
    expect(decision.intent).toBe("reflect");
  });

  it("classifies habits for productivity", async () => {
    mockRouterResponse({ domain: "habits", intent: "problem_solve", confidence: 0.80 });
    const decision = await router.route("non riesco a mantenere una routine mattutina");
    expect(decision.domain).toBe("habits");
  });

  it("classifies relationships for networking", async () => {
    mockRouterResponse({ domain: "relationships", intent: "explore", confidence: 0.70 });
    const decision = await router.route("come posso migliorare il mio networking su LinkedIn?");
    expect(decision.domain).toBe("relationships");
  });

  it("classifies ask_info for factual queries", async () => {
    mockRouterResponse({ domain: "general", intent: "ask_info", confidence: 0.75 });
    const decision = await router.route("quanto dura in media un corso di laurea in Italia?");
    expect(decision.intent).toBe("ask_info");
  });

  it("detects multi-domain when secondary domain is present", async () => {
    mockRouterResponse({
      domain: "career",
      intent: "problem_solve",
      confidence: 0.82,
      secondaryDomain: "mindset",
      secondaryConfidence: 0.55,
      secondaryIntent: "reflect",
      secondaryHandoffContext: "Shows anxiety about asking",
    });
    const decision = await router.route("come chiedo un aumento senza ansia?");
    expect(decision.domain).toBe("career");
    expect(decision.secondaryRoute).toBeDefined();
    expect(decision.secondaryRoute!.domain).toBe("mindset");
  });

  it("returns fallback when LLM fails", async () => {
    mockFallbackResponse();
    const decision = await router.route("test message");
    expect(decision.isFallback).toBe(true);
    expect(decision.domain).toBe("general");
    expect(decision.fallbackReason).toContain("LLM unavailable");
  });

  it("classifies short emotional messages as vent", async () => {
    mockRouterResponse({ domain: "general", intent: "vent", confidence: 0.45 });
    const decision = await router.route("sono stanco");
    expect(decision.intent).toBe("vent");
  });
});
