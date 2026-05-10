import { OpenAI } from "openai";

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (_openai) return _openai;

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

export const openai = new Proxy({} as OpenAI, {
  get(_t, prop) {
    return (getOpenAI() as any)[prop];
  },
});
