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

  it("falls back only for OpenRouter quota and rate limit failures", () => {
    expect(shouldFallbackToOpenAI({ status: 429 })).toBe(true);
    expect(shouldFallbackToOpenAI(new Error("Rate limit exceeded: free-models-per-day"))).toBe(true);
    expect(shouldFallbackToOpenAI(new Error("401 invalid key"))).toBe(false);
    expect(shouldFallbackToOpenAI(new Error("network unavailable"))).toBe(false);
  });
});
