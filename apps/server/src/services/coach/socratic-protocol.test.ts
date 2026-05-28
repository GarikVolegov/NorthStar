/**
 * socratic-protocol.test.ts — verifica delle transizioni step e dell'iniezione del system prompt.
 */
import { describe, expect, it } from "vitest";
import {
  SOCRATIC_STEPS,
  getNextStep,
  getStepIntro,
  buildSocraticSystemPrompt,
} from "./socratic-protocol";

describe("socratic-protocol", () => {
  it("getNextStep avanza nella sequenza canonica", () => {
    expect(getNextStep(null)).toBe("mappa_rumore");
    expect(getNextStep("mappa_rumore")).toBe("fear_setting");
    expect(getNextStep("fear_setting")).toBe("ten_ten_ten");
    expect(getNextStep("ten_ten_ten")).toBe("regret_min");
    expect(getNextStep("regret_min")).toBe("carta_bivio");
  });

  it("getNextStep rimane fermo sull'ultimo step", () => {
    expect(getNextStep("carta_bivio")).toBe("carta_bivio");
  });

  it("ogni step ha un'intro non vuota", () => {
    for (const step of SOCRATIC_STEPS) {
      const intro = getStepIntro(step);
      expect(intro.length).toBeGreaterThan(20);
    }
  });

  it("buildSocraticSystemPrompt include la sezione 'MODALITÀ SOCRATICA' e le domande dello step", () => {
    const base = "Sei Wendy.";
    const prompt = buildSocraticSystemPrompt("fear_setting", base);
    expect(prompt).toContain(base);
    expect(prompt).toContain("MODALITÀ SOCRATICA");
    expect(prompt).toContain("FEAR-SETTING");
    // Almeno una domanda dello step deve essere presente come riferimento
    expect(prompt).toMatch(/scenario peggiore|scenario.*peggiore/i);
  });

  it("ogni step ha un addendum di sistema dedicato (no duplicati)", () => {
    const base = "X";
    const prompts = SOCRATIC_STEPS.map((s) => buildSocraticSystemPrompt(s, base));
    const unique = new Set(prompts);
    expect(unique.size).toBe(SOCRATIC_STEPS.length);
  });
});
