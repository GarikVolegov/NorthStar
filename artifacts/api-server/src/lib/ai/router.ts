/**
 * AI Router — Risoluzione provider per use case
 *
 * Default:
 *   streaming_chat  → groq       (latenza bassissima, OpenAI-compatible SSE)
 *   agent_analysis  → anthropic  (ragionamento + tool use strutturato)
 *   embedding       → openai     (text-embedding-3-small, nessun rivale qui)
 *   research        → groq       (background job, bassa latenza)
 *   json_extraction → groq       (CV parse/generate/tailor/cover-letter/ATS)
 *
 * Override via env (senza redeploy):
 *   AI_STREAMING_PROVIDER=openai
 *   AI_AGENT_PROVIDER=openai
 *   AI_EMBEDDING_PROVIDER=openai
 *   AI_RESEARCH_PROVIDER=openai
 *   AI_JSON_PROVIDER=openai
 */

import type { AIProviderName, AIUseCase, AIRouterConfig } from "./types";

const DEFAULT_ROUTER: Record<AIUseCase, AIProviderName> = {
  streaming_chat:  "groq",
  agent_analysis:  "anthropic",
  embedding:       "openai",
  research:        "groq",
  json_extraction: "groq",
};

const FALLBACK_ROUTER: Partial<Record<AIUseCase, AIProviderName>> = {
  streaming_chat:  "openai",
  agent_analysis:  "openai",
  research:        "openai",
  json_extraction: "openai",
  // embedding non ha fallback: se OpenAI è giù non embeddare
};

const DEFAULT_MODELS: Record<AIProviderName, string> = {
  groq:      "llama-3.1-70b-versatile",
  anthropic: "claude-sonnet-4-5",
  openai:    "gpt-4o-mini",
  google:    "gemini-1.5-flash",
};

const EMBEDDING_MODELS: Record<AIProviderName, string> = {
  openai:    "text-embedding-3-small",
  groq:      "",  // Groq non offre embedding
  anthropic: "",
  google:    "text-embedding-004",
};

/** Legge eventuali override da env, con validazione sul set di provider noti */
function resolveEnvOverride(envKey: string): AIProviderName | undefined {
  const val = process.env[envKey]?.toLowerCase();
  if (!val) return undefined;
  const valid: AIProviderName[] = ["groq", "anthropic", "openai", "google"];
  if (valid.includes(val as AIProviderName)) return val as AIProviderName;
  console.warn(`[ai-router] env ${envKey}=${val} non valido, ignorato`);
  return undefined;
}

const ENV_OVERRIDES: Partial<Record<AIUseCase, AIProviderName>> = {
  streaming_chat:  resolveEnvOverride("AI_STREAMING_PROVIDER"),
  agent_analysis:  resolveEnvOverride("AI_AGENT_PROVIDER"),
  embedding:       resolveEnvOverride("AI_EMBEDDING_PROVIDER"),
  research:        resolveEnvOverride("AI_RESEARCH_PROVIDER"),
  json_extraction: resolveEnvOverride("AI_JSON_PROVIDER"),
};

export function resolveAIProvider(useCase: AIUseCase): AIProviderName {
  return ENV_OVERRIDES[useCase] ?? DEFAULT_ROUTER[useCase];
}

export function resolveFallbackProvider(useCase: AIUseCase): AIProviderName | undefined {
  return FALLBACK_ROUTER[useCase];
}

export function resolveAIConfig(useCase: AIUseCase): AIRouterConfig {
  const primary = resolveAIProvider(useCase);
  const fallback = resolveFallbackProvider(useCase);
  const model =
    useCase === "embedding"
      ? EMBEDDING_MODELS[primary]
      : (process.env.AI_MODEL_OVERRIDE ?? DEFAULT_MODELS[primary]);

  return { primary, fallback, model, timeoutMs: 30_000 };
}
