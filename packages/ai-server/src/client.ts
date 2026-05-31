import { OpenAI } from "openai";

let _openai: OpenAI | null = null;
let _nonChatOpenAI: OpenAI | null = null;

export interface OpenAIFallbackConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

type EnvLike = Record<string, string | undefined>;

export function getOpenAIFallbackConfig(env: EnvLike = process.env): OpenAIFallbackConfig | null {
  const apiKey = env.AI_INTEGRATIONS_OPENAI_API_KEY ?? env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const normalizedKey = apiKey.toLowerCase();
  if (
    normalizedKey.includes("placeholder") ||
    normalizedKey.includes("inactive") ||
    normalizedKey.includes("changeme")
  ) {
    return null;
  }
  return {
    apiKey,
    baseURL: env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    model: env.OPENAI_MODEL ?? "gpt-4o-mini",
  };
}

export type LlmProvider = "openai" | "groq" | "openrouter";

function hasUsableKey(value: string | undefined): boolean {
  const k = value?.toLowerCase().trim();
  if (!k) return false;
  return !(k.includes("placeholder") || k.includes("inactive") || k.includes("changeme") || k.startsWith("your_"));
}

export function hasGroqKey(env: EnvLike = process.env): boolean {
  return hasUsableKey(env.AI_INTEGRATIONS_GROQ_API_KEY) || hasUsableKey(env.GROQ_API_KEY);
}

export function hasOpenRouterKey(env: EnvLike = process.env): boolean {
  return hasUsableKey(env.OPENROUTER_API_KEY);
}

export function hasOpenAIKey(env: EnvLike = process.env): boolean {
  return getOpenAIFallbackConfig(env) !== null;
}

/**
 * Resolve which chat LLM provider to use. Honors an explicit, valid AI_PROVIDER;
 * otherwise auto-detects the first provider that actually has a usable key
 * (groq → openrouter → openai), so Wendy works when any single key is added
 * without also having to set AI_PROVIDER. Falls back to "openai".
 */
export function resolveActiveProvider(env: EnvLike = process.env): LlmProvider {
  const explicit = env.AI_PROVIDER?.toLowerCase();
  if (explicit === "groq" || explicit === "openrouter" || explicit === "openai") return explicit;
  if (hasGroqKey(env)) return "groq";
  if (hasOpenRouterKey(env)) return "openrouter";
  return "openai";
}

/** True when at least one chat LLM provider has a usable API key. */
export function isLlmConfigured(env: EnvLike = process.env): boolean {
  return hasGroqKey(env) || hasOpenRouterKey(env) || hasOpenAIKey(env);
}

function paidOpenAIFallbackEnabled(env: EnvLike = process.env): boolean {
  return env.ALLOW_PAID_AI_MODELS === "true" || env.OPENAI_FALLBACK_ENABLED === "true";
}

export function shouldFallbackToOpenAI(err: unknown, env: EnvLike = process.env): boolean {
  if (!paidOpenAIFallbackEnabled(env)) return false;
  const status = (err as { status?: unknown })?.status;
  if (status === 429 || status === "429") return true;
  const message = String((err as { message?: unknown })?.message ?? err).toLowerCase();
  return message.includes("rate limit") || message.includes("free-models-per");
}

function createStableOpenAIClient(config: OpenAIFallbackConfig): OpenAI {
  return new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
}

function withOpenRouterFallback(primary: OpenAI, fallbackConfig: OpenAIFallbackConfig | null): OpenAI {
  if (!fallbackConfig) return primary;
  const fallback = createStableOpenAIClient(fallbackConfig);

  return new Proxy(primary, {
    get(target, prop, receiver) {
      if (prop !== "chat") return Reflect.get(target, prop, receiver);
      return {
        completions: {
          create: async (params: Record<string, unknown>, ...rest: unknown[]) => {
            try {
              return await (target.chat.completions.create as unknown as Function)(params, ...rest);
            } catch (err) {
              if (!shouldFallbackToOpenAI(err)) throw err;
              return await (fallback.chat.completions.create as unknown as Function)(
                { ...params, model: fallbackConfig.model },
                ...rest,
              );
            }
          },
        },
      };
    },
  }) as OpenAI;
}

function getOpenAI(): OpenAI {
  if (_openai) return _openai;

  // When OpenRouter is configured, route all chat completions through it
  const provider = process.env.AI_PROVIDER;
  if (provider === "openrouter") {
    const baseURL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENROUTER_API_KEY must be set when AI_PROVIDER=openrouter",
      );
    }
    _openai = withOpenRouterFallback(new OpenAI({ apiKey, baseURL }), getOpenAIFallbackConfig());
    return _openai;
  }

  const fallback = getOpenAIFallbackConfig();
  if (!fallback) {
    throw new Error(
      "OPENAI_API_KEY or AI_INTEGRATIONS_OPENAI_API_KEY must be set. Did you forget to provision the OpenAI AI integration?",
    );
  }

  _openai = createStableOpenAIClient(fallback);
  return _openai;
}

/** For non-chat operations (embeddings, audio TTS/STT, images) that need real OpenAI. */
export function getNonChatOpenAI(): OpenAI {
  if (_nonChatOpenAI) return _nonChatOpenAI;
  const fallback = getOpenAIFallbackConfig();
  if (!fallback) return getOpenAI();
  _nonChatOpenAI = createStableOpenAIClient({
    ...fallback,
    baseURL: "https://api.openai.com/v1",
  });
  return _nonChatOpenAI;
}

export const openai = new Proxy({} as OpenAI, {
  get<T extends keyof OpenAI>(_t: object, prop: T): OpenAI[T] {
    return getOpenAI()[prop];
  },
});
