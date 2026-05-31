import { describe, expect, it } from "vitest";
import {
  getOpenAIFallbackConfig,
  shouldFallbackToOpenAI,
} from "../client";

describe("LLM provider fallback", () => {
  it("uses OPENAI_API_KEY as a stable fallback when AI_INTEGRATIONS_OPENAI_API_KEY is absent", () => {
    const config = getOpenAIFallbackConfig({
      OPENAI_API_KEY: "sk-openai",
      OPENAI_MODEL: "gpt-4o-mini",
    });

    expect(config).toEqual({
      apiKey: "sk-openai",
      baseURL: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
    });
  });

  it("does not treat placeholder OpenAI keys as a usable fallback", () => {
    expect(getOpenAIFallbackConfig({
      OPENAI_API_KEY: "sk-placeholder-inactive",
      OPENAI_MODEL: "gpt-4o-mini",
    })).toBeNull();
  });

  it("does not use paid OpenAI fallback unless explicitly enabled", () => {
    expect(shouldFallbackToOpenAI({ status: 429 }, {})).toBe(false);
    expect(shouldFallbackToOpenAI(new Error("Rate limit exceeded: free-models-per-day"), {})).toBe(false);
  });

  it("falls back only for quota and rate limit failures when paid fallback is enabled", () => {
    const env = { ALLOW_PAID_AI_MODELS: "true" };
    expect(shouldFallbackToOpenAI({ status: 429 }, env)).toBe(true);
    expect(shouldFallbackToOpenAI(new Error("Rate limit exceeded: free-models-per-day"), env)).toBe(true);
    expect(shouldFallbackToOpenAI(new Error("401 invalid key"), env)).toBe(false);
    expect(shouldFallbackToOpenAI(new Error("network unavailable"), env)).toBe(false);
  });
});
