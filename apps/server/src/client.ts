import { OpenAI } from "openai";

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (_openai) return _openai;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY must be set for cv-extractor.");
  _openai = new OpenAI({ apiKey });
  return _openai;
}

export const openai = new Proxy({} as OpenAI, {
  get(_t, prop) { return (getOpenAI() as any)[prop]; },
});
