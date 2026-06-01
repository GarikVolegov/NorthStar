import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "../growth-agent/prompt-builder";

describe("Wendy prompt brain separation", () => {
  it("keeps user memory, neural activation, Wendy Brain and code graph context in separate sections", () => {
    const prompt = buildSystemPrompt({
      userContext: {
        locale: "it",
        memorySection: "## Memoria utente\n- goal_main: cambiare lavoro",
        neuralSection: "## Attivazione neurale Wendy\n- [brain_note] RAG Pipeline",
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
    expect(prompt).toContain("## Attivazione neurale Wendy");
    expect(prompt).toContain("## Wendy Brain");
    expect(prompt).toContain("## Graphify codice");
    expect(prompt.indexOf("## Memoria utente")).toBeLessThan(prompt.indexOf("## Attivazione neurale Wendy"));
    expect(prompt.indexOf("## Attivazione neurale Wendy")).toBeLessThan(prompt.indexOf("## Wendy Brain"));
    expect(prompt.indexOf("## Wendy Brain")).toBeLessThan(prompt.indexOf("## Graphify codice"));
  });

  it("injects the Bussola (no-verdetti) persona section only for journeyType=indeciso", () => {
    const base = {
      personaExamples: [],
      documentChunks: [],
      webResults: [],
      platformChunks: [],
      cot: null,
      userMessage: "Non so cosa fare nella vita",
      evalResult: {
        score: 0.9,
        level: "high" as const,
        dimensions: { contextCoverage: 0.9, cotConfidence: 0.9, questionClarity: 0.9, memoryCoverage: 0.9 },
        reasons: [],
        needsClarification: false,
      },
    };

    const indeciso = buildSystemPrompt({ ...base, userContext: { locale: "it", journeyType: "indeciso" } });
    const jobSearch = buildSystemPrompt({ ...base, userContext: { locale: "it", journeyType: "job_search" } });

    expect(indeciso).toContain("## Modalità Bussola (utente indeciso)");
    expect(indeciso).toContain("bussola, non una mappa");
    expect(indeciso).toContain("get_compass");
    // No verdetti: must mention advancing the stage, not giving a definitive answer
    expect(indeciso).toMatch(/avanzare di UNO stage/i);
    // Other journeys must NOT receive the compass persona section
    expect(jobSearch).not.toContain("## Modalità Bussola");
  });
});
