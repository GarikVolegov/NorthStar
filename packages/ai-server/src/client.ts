import { OpenAI } from "openai";

let _openai: OpenAI | null = null;
let _nonChatOpenAI: OpenAI | null = null;

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
    _openai = new OpenAI({ apiKey, baseURL });
    return _openai;
  }

  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!baseURL) {
    throw new Error(
      "AI_INTEGRATIONS_OPENAI_BASE_URL must be set. Did you forget to provision the OpenAI AI integration?",
    );
  }

  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AI_INTEGRATIONS_OPENAI_API_KEY must be set. Did you forget to provision the OpenAI AI integration?",
    );
  }

  _openai = new OpenAI({ apiKey, baseURL });
  return _openai;
}

/** For non-chat operations (embeddings, audio TTS/STT, images) that need real OpenAI. */
export function getNonChatOpenAI(): OpenAI {
  if (_nonChatOpenAI) return _nonChatOpenAI;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!apiKey) return getOpenAI(); // fallback
  _nonChatOpenAI = new OpenAI({ apiKey, baseURL: "https://api.openai.com/v1" });
  return _nonChatOpenAI;
}

export const openai = new Proxy({} as OpenAI, {
  get<T extends keyof OpenAI>(_t: object, prop: T): OpenAI[T] {
    return getOpenAI()[prop];
  },
});
