import { afterEach, describe, expect, it, vi } from "vitest";

async function importFreshRouterWithFreeProviderEnv() {
  vi.resetModules();
  vi.stubEnv("AI_PROVIDER", "");
  vi.stubEnv("GROQ_API_KEY", "gsk_test_secret_do_not_log");
  vi.stubEnv("AI_INTEGRATIONS_GROQ_API_KEY", "");
  vi.stubEnv("OPENROUTER_API_KEY", "sk-or-test-secret-do-not-log");
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("AI_INTEGRATIONS_OPENAI_API_KEY", "");
  vi.stubEnv("ALLOW_PAID_AI_MODELS", "");

  return import("./router");
}

describe("Wendy router free provider routing", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("routes Wendy simple_qa to Groq nano when Groq and OpenRouter keys are present", async () => {
    const { resolveWendyRoute } = await importFreshRouterWithFreeProviderEnv();

    const route = resolveWendyRoute({
      userMessage: "ciao, come stai?",
      isPremium: true,
    });

    expect(route.intent).toBe("simple_qa");
    expect(route.decision).toMatchObject({
      provider: "groq",
      model: "llama-3.1-8b-instant",
      tier: "nano",
      skipFullPipeline: true,
    });
    expect(route.decision.model).not.toMatch(/gpt-4o|claude/i);
    expect(route.decision.reasoning).toContain("provider=groq");
    expect(route.decision.reasoning).toContain("fallback=");
    expect(route.decision.reasoning).not.toContain("gsk_test_secret_do_not_log");
    expect(route.decision.reasoning).not.toContain("sk-or-test-secret-do-not-log");
  });

  it("routes brief Wendy analysis to an OpenRouter free reasoning model instead of premium models", async () => {
    const { resolveWendyRoute } = await importFreshRouterWithFreeProviderEnv();

    const route = resolveWendyRoute({
      userMessage: "Analizza brevemente i miei progressi",
      isPremium: true,
    });

    expect(route.intent).toBe("deep_analysis");
    expect(route.decision).toMatchObject({
      provider: "openrouter",
      model: "deepseek/deepseek-r1:free",
      tier: "reasoning",
      skipFullPipeline: false,
    });
    expect(route.decision.model).toMatch(/:free$/);
    expect(route.decision.model).not.toMatch(/gpt-4o|claude/i);
    expect(route.decision.reasoning).toContain("provider=openrouter");
    expect(route.decision.reasoning).toContain("fallback=");
    expect(route.decision.reasoning).not.toContain("gsk_test_secret_do_not_log");
    expect(route.decision.reasoning).not.toContain("sk-or-test-secret-do-not-log");
  });
});
