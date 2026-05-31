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
