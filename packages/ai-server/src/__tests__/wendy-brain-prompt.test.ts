import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "../growth-agent/prompt-builder";

describe("Wendy prompt brain separation", () => {
  it("keeps user memory, Wendy Brain and code graph context in separate sections", () => {
    const prompt = buildSystemPrompt({
      userContext: {
        locale: "it",
        memorySection: "## Memoria utente\n- goal_main: cambiare lavoro",
        wendyBrainSection: "## Wendy Brain\n- [style_rule] Rispondi con decisione",
        codeGraphSection: "## Graphify codice\n1. growth-agent -> router-agent",
      },
      personaExamples: [],
      documentChunks: [],
      webResults: [],
      platformChunks: [],
      cot: null,
      userMessage: "Come funziona Wendy?",
      evalResult: {
        score: 0.9,
        level: "high",
        dimensions: {
          contextCoverage: 0.9,
          cotConfidence: 0.9,
          questionClarity: 0.9,
          memoryCoverage: 0.9,
        },
        reasons: [],
        needsClarification: false,
      },
    });

    expect(prompt).toContain("## Memoria utente");
    expect(prompt).toContain("## Wendy Brain");
    expect(prompt).toContain("## Graphify codice");
    expect(prompt.indexOf("## Memoria utente")).toBeLessThan(prompt.indexOf("## Wendy Brain"));
    expect(prompt.indexOf("## Wendy Brain")).toBeLessThan(prompt.indexOf("## Graphify codice"));
  });
});
