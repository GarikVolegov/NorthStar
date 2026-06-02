import { describe, expect, it } from "vitest";
import {
  getWendyRecoveryFallbackReply,
  shouldUseWendyQuickActionFastPath,
} from "../wendy-router/fast-path-fallback";

describe("Wendy recovery + quick-action routing (no prescribed answers)", () => {
  it("returns an honest operational message on failure — never prescribed advice", () => {
    const progressReply = getWendyRecoveryFallbackReply({
      intent: "deep_analysis",
      message: "Analizza i miei progressi",
      locale: "it",
    });
    const todayReply = getWendyRecoveryFallbackReply({
      intent: "conversation",
      message: "Cosa dovrei fare oggi?",
      locale: "it",
    });

    // Honest "technical hiccup, retry" — not faked coaching.
    expect(progressReply).toMatch(/problema tecnico/i);
    expect(progressReply).toMatch(/riprova/i);
    expect(todayReply).toMatch(/problema tecnico/i);

    // It must NOT pretend to reason with prescribed advice.
    expect(progressReply).not.toMatch(/prossima azione utile|micro-step|usa il progresso/i);
    expect(todayReply).not.toMatch(/25 minuti|prossima azione concreta/i);
  });

  it("localizes the honest recovery message", () => {
    expect(getWendyRecoveryFallbackReply({ intent: "conversation", message: "what should I do?", locale: "en" }))
      .toMatch(/technical issue/i);
    expect(getWendyRecoveryFallbackReply({ intent: "conversation", message: "que hago?", locale: "es" }))
      .toMatch(/problema t[eé]cnico/i);
    expect(getWendyRecoveryFallbackReply({ intent: "conversation", message: "que faire?", locale: "fr" }))
      .toMatch(/souci technique/i);
  });

  it("routes data-dependent quick actions through the lightweight LLM/tool path before the full agent", () => {
    expect(shouldUseWendyQuickActionFastPath({
      intent: "planning",
      message: "Cosa dovrei fare oggi?",
    })).toBe(true);
    expect(shouldUseWendyQuickActionFastPath({
      intent: "deep_analysis",
      message: "Analizza il mio profilo e dimmi la prossima mossa",
    })).toBe(true);
    expect(shouldUseWendyQuickActionFastPath({
      intent: "conversation",
      message: "Mi spieghi quale settore scegliere tra cybersecurity e data analysis?",
    })).toBe(false);
  });
});
