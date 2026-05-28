/**
 * mood-to-action.test.ts — verifica le regole di mapping mood→azione.
 *
 * Verifica:
 *  - Ansia alta domina (anche con altri slider alti)
 *  - Curiosità alta + chiarezza ok → settori
 *  - Curiosità alta + chiarezza bassa → diario indizi
 *  - Energia + motivazione basse → micro-azione
 *  - Motivazione + chiarezza alte → coach socratico
 *  - Fallback con mood neutro
 *  - normalizeMoodInput clamping
 */
import { describe, expect, it } from "vitest";
import { suggestActionForMood, normalizeMoodInput } from "./mood-to-action";

describe("mood-to-action", () => {
  const neutral = { energy: 50, anxiety: 50, curiosity: 50, clarity: 50, motivation: 50 };

  describe("suggestActionForMood", () => {
    it("ansia alta domina anche con motivazione alta", () => {
      const r = suggestActionForMood({ ...neutral, anxiety: 80, motivation: 90, clarity: 80 });
      expect(r.toolHref).toBe("/coach?mode=socratic");
      expect(r.toolLabel.toLowerCase()).toContain("socratica");
    });

    it("curiosità alta + chiarezza ok → settori", () => {
      const r = suggestActionForMood({ ...neutral, curiosity: 75, clarity: 50, anxiety: 30 });
      expect(r.toolHref).toBe("/settori");
    });

    it("curiosità alta + chiarezza bassa → diario indizi (NON settori)", () => {
      const r = suggestActionForMood({ ...neutral, curiosity: 70, clarity: 20, anxiety: 30 });
      expect(r.toolHref).toBe("/diario?mode=indizi");
    });

    it("chiarezza molto bassa generale → diario indizi", () => {
      const r = suggestActionForMood({ ...neutral, clarity: 15, curiosity: 30, anxiety: 40 });
      expect(r.toolHref).toBe("/diario?mode=indizi");
    });

    it("energia + motivazione basse → micro-azione diario", () => {
      const r = suggestActionForMood({ ...neutral, energy: 20, motivation: 25, anxiety: 40, curiosity: 30, clarity: 40 });
      expect(r.toolHref).toBe("/diario?mode=indizi");
      expect(r.rationale).toMatch(/60 secondi|domani/i);
    });

    it("motivazione + chiarezza alte → coach socratico per fissare scelta", () => {
      const r = suggestActionForMood({ ...neutral, motivation: 80, clarity: 75, anxiety: 30, curiosity: 40 });
      expect(r.toolHref).toBe("/coach?mode=socratic");
      expect(r.toolLabel.toLowerCase()).toContain("azione");
    });

    it("energia + curiosità alta (con chiarezza media) → esplora settori", () => {
      const r = suggestActionForMood({ ...neutral, energy: 75, curiosity: 60, anxiety: 30, clarity: 50, motivation: 50 });
      expect(r.toolHref).toBe("/settori");
    });

    it("fallback con mood completamente neutro", () => {
      const r = suggestActionForMood(neutral);
      // 50 di chiarezza non triggera la regola clarity<30, motivazione 50 non triggera quella alta.
      // Curiosità 50 non triggera curiosity>=60. Quindi cade nel fallback.
      expect(r.toolHref).toBe("/diario?mode=indizi");
    });
  });

  describe("normalizeMoodInput", () => {
    it("clampa valori fuori range", () => {
      const r = normalizeMoodInput({ energy: 150, anxiety: -10, curiosity: 50, clarity: 50, motivation: 50 });
      expect("error" in r).toBe(false);
      if ("error" in r) return;
      expect(r.energy).toBe(100);
      expect(r.anxiety).toBe(0);
    });

    it("rifiuta valori non numerici", () => {
      const r = normalizeMoodInput({ energy: NaN, anxiety: 50, curiosity: 50, clarity: 50, motivation: 50 });
      expect("error" in r).toBe(true);
    });

    it("rifiuta input incompleti", () => {
      const r = normalizeMoodInput({ energy: 50 });
      expect("error" in r).toBe(true);
    });
  });
});
