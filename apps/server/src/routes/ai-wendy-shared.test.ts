import { describe, expect, it } from "vitest";

import { buildWendyContextSources, WendyRequestSchema } from "./ai-wendy-shared";

describe("buildWendyContextSources", () => {
  it("normalizes personal, RAG, and app-data provenance without duplicates", () => {
    expect(
      buildWendyContextSources({
        personalSources: ["openhuman", "graphify", "semantic-memory"],
        toolsUsed: ["search_rag", "list_sectors", "search_rag"],
        ragChunksRetrieved: 2,
      }),
    ).toEqual(["openhuman", "graphify", "semantic-memory", "rag", "app-data"]);
  });

  it("emits wendy-brain when brain chunks are retrieved", () => {
    expect(
      buildWendyContextSources({
        personalSources: [],
        toolsUsed: ["list_sectors"],
        ragChunksRetrieved: 0,
        brainChunksRetrieved: 3,
      }),
    ).toEqual(["wendy-brain", "app-data"]);
  });

  it("emits wendy-brain when search_brain was called even with zero chunks", () => {
    expect(
      buildWendyContextSources({
        personalSources: [],
        toolsUsed: ["search_brain"],
        ragChunksRetrieved: 0,
        brainChunksRetrieved: 0,
      }),
    ).toEqual(["wendy-brain"]);
  });

  it("emits discovery-oriented provenance for growth and search sources", () => {
    expect(
      buildWendyContextSources({
        personalSources: [],
        toolsUsed: ["get_growth_articles", "search_rag"],
        ragChunksRetrieved: 0,
        searchModeUsed: "keyword",
      }),
    ).toEqual(["rag", "growth-library", "keyword-fallback", "app-data"]);

    expect(
      buildWendyContextSources({
        personalSources: [],
        toolsUsed: ["search_rag"],
        ragChunksRetrieved: 2,
        searchModeUsed: "semantic",
      }),
    ).toEqual(["rag", "search-index"]);
  });
});

describe("WendyRequestSchema", () => {
  it("accepts a hidden follow-up context separate from the visible user message", () => {
    const parsed = WendyRequestSchema.safeParse({
      message: "Piano carriera",
      contextPrompt: "Risposta precedente Wendy: hai completato il test. Procedi con il primo passo.",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.message).toBe("Piano carriera");
      expect(parsed.data.contextPrompt).toContain("Risposta precedente Wendy");
    }
  });
});
