import { describe, it, expect, beforeEach, vi } from "vitest";
import { applyContextSignals, selectModelFor } from "../model-router";
import { aiPlugins } from "../plugins/registry";

describe("router context signals", () => {
  beforeEach(() => {
    aiPlugins.reset();
  });

  it("keeps base tier when no signals are present", () => {
    const r = applyContextSignals("nano", {});
    expect(r.tier).toBe("nano");
    expect(r.reasons).toEqual([]);
  });

  it("upgrades tier when message is long", () => {
    const r = applyContextSignals("nano", { messageTokens: 5000 });
    expect(r.tier).toBe("standard");
    expect(r.reasons.some((x) => x.includes("long-message"))).toBe(true);
  });

  it("forces reasoning tier on retry", () => {
    const r = applyContextSignals("micro", { retryCount: 1 });
    expect(r.tier).toBe("reasoning");
    expect(r.reasons.some((x) => x.includes("retry"))).toBe(true);
  });

  it("escalates to standard when a file/vision is provided", () => {
    const r1 = applyContextSignals("nano", { hasFile: true });
    expect(r1.tier).toBe("standard");
    expect(r1.reasons).toContain("file");
    const r2 = applyContextSignals("nano", { requiresVision: true });
    expect(r2.tier).toBe("standard");
    expect(r2.reasons).toContain("vision");
  });

  it("does not downgrade when base tier is already higher", () => {
    const r = applyContextSignals("reasoning", { messageTokens: 100 });
    expect(r.tier).toBe("reasoning");
    expect(r.reasons).toEqual([]);
  });

  it("selectModelFor surfaces signal reasons in the route reason", () => {
    const route = selectModelFor("growth-agent-chat", { messageTokens: 4000, retryCount: 2 });
    expect(route.reason).toMatch(/signals\[.*retry\(2\).*\]/);
  });
});

describe("router plugin-awareness", () => {
  beforeEach(() => {
    aiPlugins.reset();
  });

  it("uses the registered reasoning plugin when tier is reasoning", () => {
    aiPlugins.register({
      id: "fake-claude",
      capability: "reasoning",
      version: "1.0.0",
      provider: "anthropic",
      init: async () => {},
      health: async () => ({ ok: true }),
      execute: async (x) => x,
    });
    const route = selectModelFor("chain-of-thought");
    expect(route.pluginId).toBe("fake-claude");
    // Anthropic plugins are dispatched through the plugin's own client; route.provider
    // reports the closest neutral HTTP hint ("openrouter") so legacy consumers don't break.
    expect(route.provider).toBe("openrouter");
    expect(route.reason).toContain("plugin(fake-claude)");
  });

  it("falls back to catalog when no reasoning plugin is registered", () => {
    const route = selectModelFor("chain-of-thought");
    expect(route.pluginId).toBeUndefined();
    expect(route.reason).toMatch(/chain-of-thought:reasoning/);
  });

  it("plugin override only triggers on reasoning tier", () => {
    aiPlugins.register({
      id: "fake-claude-2",
      capability: "reasoning",
      version: "1.0.0",
      provider: "anthropic",
      init: async () => {},
      health: async () => ({ ok: true }),
      execute: async (x) => x,
    });
    const route = selectModelFor("router-classify");
    expect(route.pluginId).toBeUndefined();
  });

  it("does not route OpenRouter nano traffic to the retired llama 3.1 free endpoint", () => {
    const route = selectModelFor("growth-agent-voice", { complexity: "simple" });
    expect(route.model).not.toBe("meta-llama/llama-3.1-8b-instruct:free");
  });

  it("uses the configured OpenRouter model for nano traffic when no nano override is set", async () => {
    vi.resetModules();
    vi.stubEnv("AI_PROVIDER", "openrouter");
    vi.stubEnv("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free");
    vi.stubEnv("MODEL_NANO_OPENROUTER", "");

    const freshRouter = await import("../model-router");
    const route = freshRouter.selectModelFor("growth-agent-voice", { complexity: "simple" });

    expect(route).toMatchObject({
      provider: "openrouter",
      model: "meta-llama/llama-3.3-70b-instruct:free",
    });

    vi.unstubAllEnvs();
  });

  it("does not fall back to the retired llama 3.1 OpenRouter endpoint without env overrides", async () => {
    vi.resetModules();
    vi.stubEnv("AI_PROVIDER", "openrouter");
    vi.stubEnv("OPENROUTER_MODEL", "");
    vi.stubEnv("MODEL_NANO_OPENROUTER", "");
    vi.stubEnv("MODEL_OPENROUTER_FREE_ROUTER", "");

    const freshRouter = await import("../model-router");
    const route = freshRouter.selectModelFor("growth-agent-voice", { complexity: "simple" });

    expect(route.model).not.toBe("meta-llama/llama-3.1-8b-instruct:free");

    vi.unstubAllEnvs();
  });
});
