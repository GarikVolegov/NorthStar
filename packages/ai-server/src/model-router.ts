/**
 * model-router.ts — Smart model selection based on request type, user plan, and cost.
 *
 * Rules:
 *   - Free users: always use cheapest model (gpt-4o-mini or Groq equivalent)
 *   - Pro users: can access premium models for deep analysis
 *   - Simple chat: fast/cheap model
 *   - Deep analysis: best model (gpt-4o)
 *   - TTS/voice: always cheapest (handled separately)
 */

export type RequestComplexity = "simple" | "standard" | "deep";

export interface RouterOptions {
  isPremium: boolean;
  complexity: RequestComplexity;
  preferGroq?: boolean;
}

export interface ModelRoute {
  model: string;
  provider: "openai" | "groq";
  temperature: number;
  maxTokens: number;
  reason: string;
}

const CHEAP_OPENAI = "gpt-4o-mini";
const CHEAP_GROQ = "llama-3.3-70b-versatile";
const PREMIUM_OPENAI = "gpt-4o";

export function selectModel(opts: RouterOptions): ModelRoute {
  const { isPremium, complexity, preferGroq } = opts;

  if (preferGroq) {
    return {
      model: CHEAP_GROQ,
      provider: "groq",
      temperature: 0.72,
      maxTokens: complexity === "simple" ? 300 : complexity === "deep" ? 1200 : 600,
      reason: "groq-preferred",
    };
  }

  if (complexity === "simple") {
    return {
      model: CHEAP_OPENAI,
      provider: "openai",
      temperature: 0.5,
      maxTokens: 300,
      reason: "simple-chat-cheapest",
    };
  }

  if (complexity === "deep" && isPremium) {
    return {
      model: PREMIUM_OPENAI,
      provider: "openai",
      temperature: 0.7,
      maxTokens: 1200,
      reason: "deep-analysis-premium",
    };
  }

  if (complexity === "deep" && !isPremium) {
    return {
      model: CHEAP_OPENAI,
      provider: "openai",
      temperature: 0.7,
      maxTokens: 1000,
      reason: "deep-analysis-free-capped",
    };
  }

  return {
    model: CHEAP_OPENAI,
    provider: "openai",
    temperature: 0.72,
    maxTokens: 600,
    reason: "standard-default",
  };
}
