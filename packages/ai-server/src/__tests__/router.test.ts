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

  describe("domain classification", () => {
    it("classifies career + problem_solve", async () => {
      mockRouterResponse({ domain: "career", intent: "problem_solve", confidence: 0.85 });
      const decision = await router.route("come faccio a negoziare lo stipendio?");
      expect(decision.domain).toBe("career");
      expect(decision.intent).toBe("problem_solve");
      expect(decision.confidence).toBeGreaterThanOrEqual(0.70);
      expect(decision.isFallback).toBeFalsy();
    });

    it("classifies career explore", async () => {
      mockRouterResponse({ domain: "career", intent: "explore", confidence: 0.70 });
      const decision = await router.route("quali sono i lavori più richiesti in Italia?");
      expect(decision.domain).toBe("career");
      expect(decision.intent).toBe("explore");
    });

    it("classifies career plan", async () => {
      mockRouterResponse({ domain: "career", intent: "plan", confidence: 0.80 });
      const decision = await router.route("fammi un piano per cambiare carriera in 6 mesi");
      expect(decision.domain).toBe("career");
      expect(decision.intent).toBe("plan");
    });

    it("classifies trading for active market queries", async () => {
      mockRouterResponse({ domain: "trading", intent: "explore", confidence: 0.75 });
      const decision = await router.route("XAUUSD sta rompendo resistenza, che ne pensi?");
      expect(decision.domain).toBe("trading");
      expect(decision.confidence).toBeGreaterThanOrEqual(0.70);
    });

    it("classifies trading with technical analysis", async () => {
      mockRouterResponse({ domain: "trading", intent: "problem_solve", confidence: 0.78 });
      const decision = await router.route("BTC ha appena rotto il trendline giornaliero, entro long?");
      expect(decision.domain).toBe("trading");
    });

    it("classifies trading with forex", async () => {
      mockRouterResponse({ domain: "trading", intent: "explore", confidence: 0.72 });
      const decision = await router.route("che setup vedi su EURUSD questa settimana?");
      expect(decision.domain).toBe("trading");
    });

    it("classifies trading with risk management", async () => {
      mockRouterResponse({ domain: "trading", intent: "problem_solve", confidence: 0.80 });
      const decision = await router.route("come gestisco il drawdown dopo 3 perdite consecutive?");
      expect(decision.domain).toBe("trading");
    });

    it("classifies finance for passive investing", async () => {
      mockRouterResponse({ domain: "finance", intent: "explore", confidence: 0.78 });
      const decision = await router.route("conviene un PAC su VWCE ora o aspetto un correction?");
      expect(decision.domain).toBe("finance");
    });

    it("classifies finance + plan", async () => {
      mockRouterResponse({ domain: "finance", intent: "plan", confidence: 0.78 });
      const decision = await router.route("fammi un piano per risparmiare 500 euro al mese");
      expect(decision.domain).toBe("finance");
      expect(decision.intent).toBe("plan");
    });

    it("classifies finance for budget", async () => {
      mockRouterResponse({ domain: "finance", intent: "problem_solve", confidence: 0.75 });
      const decision = await router.route("come calcolo il mio patrimonio netto?");
      expect(decision.domain).toBe("finance");
    });

    it("classifies finance for retirement", async () => {
      mockRouterResponse({ domain: "finance", intent: "ask_info", confidence: 0.80 });
      const decision = await router.route("conviene il fondo pensione o il TFR lasciato in azienda?");
      expect(decision.domain).toBe("finance");
      expect(decision.intent).toBe("ask_info");
    });

    it("classifies mindset for belief-related messages", async () => {
      mockRouterResponse({ domain: "mindset", intent: "reflect", confidence: 0.72 });
      const decision = await router.route("ho paura di non essere abbastanza bravo");
      expect(decision.domain).toBe("mindset");
      expect(decision.intent).toBe("reflect");
    });

    it("classifies mindset for limiting beliefs", async () => {
      mockRouterResponse({ domain: "mindset", intent: "problem_solve", confidence: 0.70 });
      const decision = await router.route("come supero la sindrome dell'impostore?");
      expect(decision.domain).toBe("mindset");
    });

    it("classifies mindset for anxiety", async () => {
      mockRouterResponse({ domain: "mindset", intent: "vent", confidence: 0.55 });
      const decision = await router.route("mi sento bloccato, non so da dove iniziare");
      expect(decision.domain).toBe("mindset");
    });

    it("classifies habits for productivity", async () => {
      mockRouterResponse({ domain: "habits", intent: "problem_solve", confidence: 0.80 });
      const decision = await router.route("non riesco a mantenere una routine mattutina");
      expect(decision.domain).toBe("habits");
    });

    it("classifies habits for sleep", async () => {
      mockRouterResponse({ domain: "habits", intent: "problem_solve", confidence: 0.75 });
      const decision = await router.route("dormo 5 ore a notte, come miglioro il sonno?");
      expect(decision.domain).toBe("habits");
    });

    it("classifies habits for procrastination", async () => {
      mockRouterResponse({ domain: "habits", intent: "problem_solve", confidence: 0.78 });
      const decision = await router.route("rimando sempre tutto, come smetto di procrastinare?");
      expect(decision.domain).toBe("habits");
    });

    it("classifies relationships for networking", async () => {
      mockRouterResponse({ domain: "relationships", intent: "explore", confidence: 0.70 });
      const decision = await router.route("come posso migliorare il mio networking su LinkedIn?");
      expect(decision.domain).toBe("relationships");
    });

    it("classifies relationships for conflict", async () => {
      mockRouterResponse({ domain: "relationships", intent: "problem_solve", confidence: 0.72 });
      const decision = await router.route("come gestisco un conflitto con il mio capo?");
      expect(decision.domain).toBe("relationships");
    });

    it("classifies relationships for mentorship", async () => {
      mockRouterResponse({ domain: "relationships", intent: "explore", confidence: 0.68 });
      const decision = await router.route("come trovo un mentore nel mio settore?");
      expect(decision.domain).toBe("relationships");
    });
  });

  describe("intent classification", () => {
    it("classifies vent for emotional messages", async () => {
      mockRouterResponse({ domain: "general", intent: "vent", confidence: 0.55 });
      const decision = await router.route("non ce la faccio più, sono esausto");
      expect(decision.intent).toBe("vent");
      expect(decision.isFallback).toBeFalsy();
    });

    it("classifies short emotional messages as vent", async () => {
      mockRouterResponse({ domain: "general", intent: "vent", confidence: 0.45 });
      const decision = await router.route("sono stanco");
      expect(decision.intent).toBe("vent");
    });

    it("classifies deep frustration as vent", async () => {
      mockRouterResponse({ domain: "general", intent: "vent", confidence: 0.50 });
      const decision = await router.route("è frustrante non vedere risultati dopo mesi di lavoro");
      expect(decision.intent).toBe("vent");
    });

    it("classifies ask_info for factual queries", async () => {
      mockRouterResponse({ domain: "general", intent: "ask_info", confidence: 0.75 });
      const decision = await router.route("quanto dura in media un corso di laurea in Italia?");
      expect(decision.intent).toBe("ask_info");
    });

    it("classifies ask_info for stats", async () => {
      mockRouterResponse({ domain: "general", intent: "ask_info", confidence: 0.72 });
      const decision = await router.route("qual è lo stipendio medio di un data scientist in Italia?");
      expect(decision.intent).toBe("ask_info");
    });

    it("classifies reflect for processing emotions", async () => {
      mockRouterResponse({ domain: "general", intent: "reflect", confidence: 0.65 });
      const decision = await router.route("sto ripensando alle scelte che ho fatto finora");
      expect(decision.intent).toBe("reflect");
    });
  });

  describe("multi-domain detection", () => {
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

    it("detects career + finance multi-domain", async () => {
      mockRouterResponse({
        domain: "career",
        intent: "problem_solve",
        confidence: 0.80,
        secondaryDomain: "finance",
        secondaryConfidence: 0.50,
        secondaryIntent: "ask_info",
        secondaryHandoffContext: "Wants to understand salary-to-savings ratio",
      });
      const decision = await router.route("vorrei cambiare lavoro per guadagnare di più e investire meglio");
      expect(decision.domain).toBe("career");
      expect(decision.secondaryRoute).toBeDefined();
      expect(decision.secondaryRoute!.domain).toBe("finance");
    });
  });

  describe("edge cases", () => {
    it("returns fallback when LLM fails", async () => {
      mockFallbackResponse();
      const decision = await router.route("test message");
      expect(decision.isFallback).toBe(true);
      expect(decision.domain).toBe("general");
      expect(decision.fallbackReason).toContain("LLM unavailable");
    });

    it("handles very short messages", async () => {
      mockRouterResponse({ domain: "general", intent: "explore", confidence: 0.40 });
      const decision = await router.route("ciao");
      expect(decision.domain).toBe("general");
    });

    it("handles empty-ish messages", async () => {
      mockRouterResponse({ domain: "general", intent: "explore", confidence: 0.35 });
      const decision = await router.route("ok");
      expect(decision.isFallback).toBeFalsy();
    });

    it("handles very long messages", async () => {
      mockRouterResponse({ domain: "general", intent: "explore", confidence: 0.60 });
      const longMsg = "parlami di ".repeat(200);
      const decision = await router.route(longMsg);
      expect(decision.domain).toBe("general");
    });

    it("classifies general for mixed ambiguous query", async () => {
      mockRouterResponse({ domain: "general", intent: "explore", confidence: 0.45 });
      const decision = await router.route("che tempo fa domani?");
      expect(decision.domain).toBe("general");
    });
  });
});
