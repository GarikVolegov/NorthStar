import { describe, expect, it } from "vitest";
import { buildWendySystemPrompt } from "../wendy-prompt-builder";

describe("wendy-prompt-builder", () => {
  it("builds the base prompt", () => {
    expect(buildWendySystemPrompt()).toContain("Wendy");
  });

  it("injects optional context sections", () => {
    const prompt = buildWendySystemPrompt({
      memory: "Ricorda il profilo",
      ragContext: "Fonte RAG",
      personalContext: "Graphify",
    });
    expect(prompt).toContain("## Memoria Wendy");
    expect(prompt).toContain("## Contesto RAG");
    expect(prompt).toContain("Graphify");
  });
});
