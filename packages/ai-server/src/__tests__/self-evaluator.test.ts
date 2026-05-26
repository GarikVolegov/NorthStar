import { describe, it, expect } from "vitest";
import {
  evaluateSelf,
  buildClarification,
} from "../growth-agent/self-evaluator";
import type { RetrievedChunk } from "../growth-agent/retriever";
import type { CoTResult } from "../growth-agent/chain-of-thought";

function chunk(text: string, score: number): RetrievedChunk {
  return {
    id: 1,
    content: text,
    source: "test",
    sourceType: "document" as const,
    score,
    metadata: {},
  };
}

function cot(confidence: number): CoTResult {
  return {
    confidence,
    limitingPattern: "test",
    controllableActions: ["test"],
    blindSpot: "test",
  };
}

describe("SelfEvaluator", () => {
  describe("scoreContextCoverage", () => {
    it("returns low score when no chunks available", () => {
      const result = evaluateSelf({
        userMessage: "come trovo lavoro?",
        documentChunks: [],
        webResults: [],
        cot: cot(0.8),
        memoryFactCount: 5,
      });
      expect(result.dimensions.contextCoverage).toBeLessThan(0.2);
    });

    it("returns high score with very relevant chunks", () => {
      const result = evaluateSelf({
        userMessage: "come trovo lavoro?",
        documentChunks: [chunk("guida alla ricerca lavoro", 0.85)],
        webResults: [],
        cot: cot(0.8),
        memoryFactCount: 5,
      });
      expect(result.dimensions.contextCoverage).toBeGreaterThanOrEqual(0.9);
    });

    it("returns medium score with marginally relevant chunks", () => {
      const result = evaluateSelf({
        userMessage: "come investire in ETF?",
        documentChunks: [chunk("articolo generico sulla finanza", 0.55)],
        webResults: [],
        cot: cot(0.8),
        memoryFactCount: 5,
      });
      expect(result.dimensions.contextCoverage).toBeGreaterThanOrEqual(0.4);
      expect(result.dimensions.contextCoverage).toBeLessThanOrEqual(0.6);
    });
  });

  describe("scoreQuestionClarity", () => {
    it("bypasses clarification for greetings and short openings", () => {
      const result = evaluateSelf({
        userMessage: "ciao",
        documentChunks: [],
        webResults: [],
        cot: cot(0.8),
        memoryFactCount: 0,
      });
      expect(result.score).toBe(0.6);
      expect(result.level).toBe("medium");
      expect(result.needsClarification).toBe(false);
    });

    it("bypasses clarification for typo greetings", () => {
      const result = evaluateSelf({
        userMessage: "come stqi",
        documentChunks: [],
        webResults: [],
        cot: null,
        memoryFactCount: 0,
      });
      expect(result.level).toBe("medium");
      expect(result.needsClarification).toBe(false);
    });

    it("bypasses clarification for predefined suggestions", () => {
      const result = evaluateSelf({
        userMessage: "Fammi un piano carriera",
        documentChunks: [],
        webResults: [],
        cot: null,
        memoryFactCount: 0,
        isPredefined: true,
      });
      expect(result.score).toBe(0.7);
      expect(result.level).toBe("high");
      expect(result.needsClarification).toBe(false);
    });

    it("returns medium score for short but specific messages", () => {
      const result = evaluateSelf({
        userMessage: "come trovo lavoro in Italia dopo la laurea?",
        documentChunks: [],
        webResults: [],
        cot: cot(0.8),
        memoryFactCount: 5,
      });
      expect(result.dimensions.questionClarity).toBeGreaterThanOrEqual(0.5);
      expect(result.dimensions.questionClarity).toBeLessThanOrEqual(0.8);
    });

    it("returns high score for long specific messages", () => {
      const result = evaluateSelf({
        userMessage:
          "ho 28 anni, una laurea in economia e 3 anni di esperienza in contabilità. Vorrei cambiare carriera verso la consulenza strategica ma non so da dove iniziare. Che percorso consigli?",
        documentChunks: [],
        webResults: [],
        cot: cot(0.8),
        memoryFactCount: 5,
      });
      expect(result.dimensions.questionClarity).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe("scoreMemoryCoverage", () => {
    it("returns low score for new users with no memory", () => {
      const result = evaluateSelf({
        userMessage: "vorrei capire quale scelta professionale ha piu senso",
        documentChunks: [],
        webResults: [],
        cot: cot(0.8),
        memoryFactCount: 0,
      });
      expect(result.dimensions.memoryCoverage).toBeLessThan(0.3);
    });

    it("returns high score for users with lots of memory", () => {
      const result = evaluateSelf({
        userMessage: "vorrei capire quale scelta professionale ha piu senso",
        documentChunks: [],
        webResults: [],
        cot: cot(0.8),
        memoryFactCount: 6,
      });
      expect(result.dimensions.memoryCoverage).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe("composite score and level", () => {
    it("returns high level when all dimensions are strong", () => {
      const result = evaluateSelf({
        userMessage:
          "ho 28 anni e una laurea in economia. Come trovo lavoro nella consulenza strategica? Quali sono i passi concreti?",
        documentChunks: [chunk("guida alla consulenza strategica", 0.88)],
        webResults: [chunk("articolo consulenza", 0.82)],
        cot: cot(0.85),
        memoryFactCount: 6,
      });
      expect(result.level).toBe("high");
      expect(result.needsClarification).toBe(false);
      expect(result.score).toBeGreaterThanOrEqual(0.72);
    });

    it("returns medium level when context coverage is weak", () => {
      const result = evaluateSelf({
        userMessage:
          "come si calcola il rendimento di un BTP italiano con scadenza 2030?",
        documentChunks: [chunk("documento generico", 0.5)],
        webResults: [chunk("articolo", 0.45)],
        cot: cot(0.6),
        memoryFactCount: 2,
      });
      expect(result.level).toBe("medium");
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it("returns low level for vague non-greeting question with no context", () => {
      const result = evaluateSelf({
        userMessage: "non so cosa dovrei fare adesso nella mia situazione",
        documentChunks: [],
        webResults: [],
        cot: null,
        memoryFactCount: 0,
      });
      expect(result.level).toBe("low");
      expect(result.needsClarification).toBe(true);
    });

    it("returns medium level when cot is null despite good context", () => {
      const result = evaluateSelf({
        userMessage: "qual è la differenza tra ETF attivi e passivi?",
        documentChunks: [chunk("guida ETF con confronto dettagliato", 0.9)],
        webResults: [],
        cot: null,
        memoryFactCount: 3,
      });
      expect(result.level).toBe("medium");
    });
  });

  describe("buildClarification", () => {
    it("asks for more details when question is vague", () => {
      const evalResult = evaluateSelf({
        userMessage: "aiuto",
        documentChunks: [],
        webResults: [],
        cot: cot(0.8),
        memoryFactCount: 5,
      });
      const msg = buildClarification(evalResult, "Marco");
      expect(msg).toContain("Marco");
      expect(msg.length).toBeGreaterThan(20);
    });

    it("addresses the specific low dimension", () => {
      const evalResult = {
        score: 0.3,
        level: "low" as const,
        needsClarification: true,
        dimensions: {
          contextCoverage: 0.9,
          cotConfidence: 0.9,
          questionClarity: 0.1,
          memoryCoverage: 0.9,
        },
        reasons: ["La domanda è troppo vaga"],
      };
      const msg = buildClarification(evalResult);
      expect(msg).toContain("generica");
    });
  });
});
