import { describe, expect, it } from "vitest";
import {
  proposeSpike,
  resolveSpikeOutcome,
  spikeReviewDate,
  spikeOutcomeDims,
  COMMIT_ENERGY_THRESHOLD,
} from "../compass/spike";

describe("compass/spike — pure logic", () => {
  it("proposeSpike returns small, verifiable actions with a non-empty kill-criterion", () => {
    const s = proposeSpike("UX Designer");
    expect(s.length).toBeGreaterThanOrEqual(2);
    for (const sug of s) {
      expect(sug.action).toContain("UX Designer");
      expect(sug.killCriterion.trim().length).toBeGreaterThan(0); // mai vuoto
    }
    // la skill-ponte aggiunge una terza azione
    expect(proposeSpike("UX Designer", { firstSkill: "Figma" })).toHaveLength(3);
    // un kill-criterion custom viene rispettato
    expect(proposeSpike("X", { killCriterion: "stop se odio la prima ora" })[0]!.killCriterion)
      .toBe("stop se odio la prima ora");
  });

  it("resolveSpikeOutcome: continue + high energy → committed/confirmed", () => {
    const r = resolveSpikeOutcome("continue", 0.8);
    expect(r.stage).toBe("committed");
    expect(r.verdict).toBe("confirmed");
    expect(r.status).toBe("completed_continue");
    expect(r.signalValence).toBeGreaterThan(0);
  });

  it("resolveSpikeOutcome: continue + low energy stays experimenting", () => {
    const r = resolveSpikeOutcome("continue", COMMIT_ENERGY_THRESHOLD - 0.2);
    expect(r.stage).toBe("experimenting");
    expect(r.verdict).toBe("confirmed");
  });

  it("resolveSpikeOutcome: kill → back to hypotheses, discarded, negative signal (informed no)", () => {
    const r = resolveSpikeOutcome("kill", 0.9);
    expect(r.stage).toBe("hypotheses");
    expect(r.verdict).toBe("discarded");
    expect(r.status).toBe("completed_kill");
    expect(r.signalValence).toBeLessThan(0);
    expect(r.signalWeight).toBeGreaterThan(1); // l'esperienza pesa
  });

  it("spikeReviewDate defaults to +14 days", () => {
    const start = new Date("2026-06-01T00:00:00Z");
    expect(spikeReviewDate(start).toISOString()).toBe("2026-06-15T00:00:00.000Z");
  });

  it("spikeOutcomeDims scales the hypothesis RIASEC by valence (sign matters)", () => {
    expect(spikeOutcomeDims(["A", "I"], 1).A).toBeGreaterThan(0);
    expect(spikeOutcomeDims(["A", "I"], -1).A).toBeLessThan(0);
  });
});
