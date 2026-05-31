import { describe, expect, it } from "vitest";
import {
  getFastPathFallbackReply,
  getWendyRecoveryFallbackReply,
  shouldUseWendyQuickActionFastPath,
  shouldUseImmediateWendyRecoveryFallback,
  shouldUseImmediateFastPathFallback,
} from "../wendy-router/fast-path-fallback";

describe("Wendy fast path fallback", () => {
  it("returns a local reply for simple small talk when the provider is unavailable", () => {
    const reply = getFastPathFallbackReply({
      intent: "simple_qa",
      message: "ciao, come stai?",
      locale: "it",
    });

    expect(reply).toContain("Ciao");
    expect(reply).toContain("pronta ad aiutarti");
  });

  it("answers Italian identity questions in Italian even when the browser locale is English", () => {
    const reply = getFastPathFallbackReply({
      intent: "simple_qa",
      message: "chi sei?",
      locale: "en",
    });

    expect(reply).not.toContain("I am Wendy");
    expect(reply).toContain("Sono Wendy");
    expect(reply).toContain("NorthStar");
  });

  it("explains how the app works instead of only introducing Wendy", () => {
    const prompts = ["come funziona?", "come funziona l'app", "come funziona l app?"];

    for (const message of prompts) {
      const reply = getFastPathFallbackReply({
        intent: "simple_qa",
        message,
        locale: "en",
      });

      expect(reply).toContain("test");
      expect(reply).toContain("profilo");
      expect(reply).toContain("settori");
      expect(reply).toContain("obiettivi");
      expect(reply).not.toBe("Sono Wendy, la tua guida NorthStar. Ti aiuto a capire percorsi, obiettivi, settori, ruoli e prossimi passi dentro la piattaforma.");
    }
  });

  it("allows safe app-explanation fast path even when routing classified it as conversation", () => {
    expect(shouldUseImmediateFastPathFallback({
      intent: "conversation",
      message: "come funziona l app?",
    })).toBe(true);

    const reply = getFastPathFallbackReply({
      intent: "conversation",
      message: "come funziona l app?",
      locale: "en",
    });

    expect(reply).toContain("NorthStar funziona");
    expect(reply).toContain("test");
  });

  it("does not answer non-simple intents locally", () => {
    expect(getFastPathFallbackReply({
      intent: "planning",
      message: "creami un piano di carriera",
      locale: "it",
    })).toBeNull();
  });

  it("short-circuits only safe simple social messages", () => {
    expect(shouldUseImmediateFastPathFallback({
      intent: "simple_qa",
      message: "ciao, come stai?",
    })).toBe(true);
    expect(shouldUseImmediateFastPathFallback({
      intent: "simple_qa",
      message: "!",
    })).toBe(true);
    expect(shouldUseImmediateFastPathFallback({
      intent: "simple_qa",
      message: "hey!",
    })).toBe(true);
    expect(shouldUseImmediateFastPathFallback({
      intent: "simple_qa",
      message: "ei",
    })).toBe(true);
    expect(shouldUseImmediateFastPathFallback({
      intent: "conversation",
      message: "ce lho gia",
    })).toBe(true);
    expect(shouldUseImmediateFastPathFallback({
      intent: "simple_qa",
      message: "mi spieghi bene quale settore scegliere tra cyber e data?",
    })).toBe(false);
    expect(shouldUseImmediateFastPathFallback({
      intent: "planning",
      message: "ciao, creami un piano",
    })).toBe(false);
  });

  it("answers Italian acknowledgements in Italian instead of recovery English", () => {
    for (const message of ["ce lho", "ce lho gia", "ce l'ho già", "ei"]) {
      const reply = getFastPathFallbackReply({
        intent: "conversation",
        message,
        locale: "en",
      });

      expect(reply).not.toContain("I can still help");
      expect(reply).not.toContain("Pick one concrete next step");
      expect(reply).toMatch(/Perfetto|Ciao|Dimmi/);
    }
  });

  it("returns a useful recovery reply for common Wendy quick actions", () => {
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

    expect(progressReply).toContain("progressi");
    expect(progressReply).toContain("obiettivi");
    expect(todayReply).toContain("oggi");
    expect(todayReply).toContain("prossima azione");
  });

  it("answers Italian quick actions in Italian even when the browser locale is English", () => {
    const prompts = [
      "Cosa dovrei fare oggi?",
      "Analizza il mio profilo e dimmi la prossima mossa",
      "Quali settori sono piu adatti a me?",
    ];

    for (const message of prompts) {
      const reply = getWendyRecoveryFallbackReply({
        intent: "conversation",
        message,
        locale: "en",
      });

      expect(reply).not.toContain("I can still help");
      expect(reply).not.toContain("Pick one concrete next step");
      expect(reply).toMatch(/obiettivi|profilo|settori|prossima azione/);
    }
  });

  it("short-circuits only known predefined-style Wendy quick actions", () => {
    expect(shouldUseImmediateWendyRecoveryFallback({
      intent: "conversation",
      message: "Cosa dovrei fare oggi?",
    })).toBe(true);
    expect(shouldUseImmediateWendyRecoveryFallback({
      intent: "deep_analysis",
      message: "Analizza i miei progressi",
    })).toBe(true);
    expect(shouldUseImmediateWendyRecoveryFallback({
      intent: "conversation",
      message: "Quali settori sono piu adatti a me?",
    })).toBe(true);
    expect(shouldUseImmediateWendyRecoveryFallback({
      intent: "deep_analysis",
      message: "Analizza il mio profilo e dimmi la prossima mossa",
    })).toBe(true);
    expect(shouldUseImmediateWendyRecoveryFallback({
      intent: "conversation",
      message: "Mi spieghi quale settore scegliere tra cybersecurity e data analysis?",
    })).toBe(false);
  });

  it("does not short-circuit data-dependent quick actions when an LLM provider is configured", () => {
    expect(shouldUseImmediateWendyRecoveryFallback({
      intent: "conversation",
      message: "Cosa dovrei fare oggi?",
      llmConfigured: true,
    })).toBe(false);
    expect(shouldUseImmediateWendyRecoveryFallback({
      intent: "deep_analysis",
      message: "Analizza il mio profilo e dimmi la prossima mossa",
      llmConfigured: true,
    })).toBe(false);
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
