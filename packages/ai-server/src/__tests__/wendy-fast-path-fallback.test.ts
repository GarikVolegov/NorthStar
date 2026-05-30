import { describe, expect, it } from "vitest";
import {
  getFastPathFallbackReply,
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
      message: "mi spieghi bene quale settore scegliere tra cyber e data?",
    })).toBe(false);
    expect(shouldUseImmediateFastPathFallback({
      intent: "planning",
      message: "ciao, creami un piano",
    })).toBe(false);
  });
});
