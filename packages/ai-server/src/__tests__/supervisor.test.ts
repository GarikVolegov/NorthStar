import { describe, it, expect, vi, beforeEach } from "vitest";
import { SupervisorAgent } from "../growth-agent/supervisor-agent";

const mockChatOnce = vi.fn();

vi.mock("../llm/client", () => ({
  getLLM: vi.fn(() => ({
    chatOnce: mockChatOnce,
  })),
}));

vi.mock("../db/client", () => ({
  db: null,
}));

describe("SupervisorAgent", () => {
  let supervisor: SupervisorAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    supervisor = new SupervisorAgent();
  });

  describe("evaluate", () => {
    it("passes a good response with actions", () => {
      const result = supervisor.evaluate({
        userMessage: "come trovo lavoro?",
        draft: "Ecco 3 passi concreti: 1. Aggiorna il CV con le ultime esperienze. 2. Contatta 5 recruiter su LinkedIn entro questa settimana. 3. Preparati per i colloqui tecnici studiando system design.",
        domain: "career",
        intent: "plan",
      });
      expect(result.pass).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0.70);
    });

    it("fails a response with platitudes", () => {
      const result = supervisor.evaluate({
        userMessage: "non ce la faccio",
        draft: "Credi in te stesso e tutto \u00e8 possibile. Non mollare mai. Il successo arriva per chi persevera. Sei sulla strada giusta.",
        domain: "mindset",
        intent: "reflect",
      });
      expect(result.dimensions.platitudeFree).toBeLessThanOrEqual(0.30);
    });

    it("applies low actionability weight for vent responses", () => {
      const result = supervisor.evaluate({
        userMessage: "oggi \u00e8 stata una giornata terribile",
        draft: "Mi dispiace che tu abbia passato una giornata cos\u00ec difficile. Ti ascolto. Cosa \u00e8 successo di preciso?",
        domain: "general",
        intent: "vent",
      });
      expect(result.dimensions.actionability).toBeLessThan(0.30);
    });

    it("fails plan response without action steps", () => {
      const result = supervisor.evaluate({
        userMessage: "fammi un piano carriera",
        draft: "Il tuo percorso professionale \u00e8 importante. Dovresti considerare le tue opzioni e fare delle scelte. Il tempo \u00e8 dalla tua parte.",
        domain: "career",
        intent: "plan",
      });
      expect(result.pass).toBe(false);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it("flags short responses", () => {
      const result = supervisor.evaluate({
        userMessage: "ciao",
        draft: "Ciao!",
        domain: "general",
        intent: "explore",
      });
      expect(result.dimensions.lengthOk).toBeLessThan(0.50);
    });

    it("rejects empty plan drafts", () => {
      const result = supervisor.evaluate({
        userMessage: "fammi un piano",
        draft: "Certo, ecco il tuo piano personale.",
        domain: "general",
        intent: "plan",
      });
      expect(result.pass).toBe(false);
    });
  });

  describe("rewrite", () => {
    it("returns rewritten text when successful", async () => {
      mockChatOnce.mockResolvedValue(
        "Ecco 3 azioni concrete: 1. Analizza le tue spese. 2. Crea un budget mensile. 3. Automatizza il risparmio.",
      );

      const failResult = supervisor.evaluate({
        userMessage: "come risparmio?",
        draft: "Risparmia \u00e8 importante.",
        domain: "finance",
        intent: "plan",
      });

      const rewritten = await supervisor.rewrite(
        { userMessage: "come risparmio?", draft: "Risparmia \u00e8 importante.", domain: "finance", intent: "plan" },
        failResult,
      );
      expect(rewritten).not.toBe("Risparmia \u00e8 importante.");
      expect(rewritten.length).toBeGreaterThan(20);
    });

    it("keeps original if rewrite degrades quality", async () => {
      const goodDraft = "Ecco cosa fare: 1. Prendi un respiro. 2. Identifica il problema. 3. Chiedi supporto.";

      mockChatOnce.mockResolvedValue("breve");

      const failResult = supervisor.evaluate({
        userMessage: "aiuto",
        draft: goodDraft,
        domain: "mindset",
        intent: "problem_solve",
      });

      const rewritten = await supervisor.rewrite(
        { userMessage: "aiuto", draft: goodDraft, domain: "mindset", intent: "problem_solve" },
        failResult,
      );
      expect(rewritten).toBe(goodDraft);
    });
  });
});
