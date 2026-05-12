/**
 * LLM Provider abstraction — supports OpenAI and Groq backends.
 *
 * Usage:
 *   const llm = getLLM();
 *   const stream = llm.chat(messages, { model: "gpt-4o-mini", temperature: 0.1 });
 *
 * Provider selection (first match):
 *   1. AI_PROVIDER=groq → Groq (requires GROQ_API_KEY)
 *   2. default → OpenAI (requires AI_INTEGRATIONS_OPENAI_*)
 */

import OpenAI from "openai";
import Groq from "groq-sdk";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMProvider {
  chat(messages: LLMMessage[], config?: LLMConfig): Promise<AsyncIterable<string>>;
  chatOnce(messages: LLMMessage[], config?: LLMConfig): Promise<string>;
}

// ── OpenAI Provider ────────────────────────────────────────────────

function createOpenAIProvider(): LLMProvider {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) {
    throw new Error("AI_INTEGRATIONS_OPENAI_BASE_URL and AI_INTEGRATIONS_OPENAI_API_KEY must be set");
  }
  const client = new OpenAI({ apiKey, baseURL });

  return {
    async chat(messages, config = {}) {
      const stream = await client.chat.completions.create({
        model: config.model ?? "gpt-4o-mini",
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        stream: true,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 800,
      });

      return {
        async *[Symbol.asyncIterator]() {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) yield delta;
          }
        },
      };
    },

    async chatOnce(messages, config = {}) {
      const res = await client.chat.completions.create({
        model: config.model ?? "gpt-4o-mini",
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 800,
      });
      return res.choices[0]?.message?.content ?? "";
    },
  };
}

// ── Groq Provider ──────────────────────────────────────────────────

function createGroqProvider(): LLMProvider {
  const apiKey = process.env.AI_INTEGRATIONS_GROQ_API_KEY ?? process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY must be set when AI_PROVIDER=groq");
  }
  const client = new Groq({ apiKey });

  const GROQ_MODEL_MAP: Record<string, string> = {
    "gpt-4o-mini": "llama-3.3-70b-versatile",
    "gpt-4o": "llama-3.3-70b-versatile",
  };

  return {
    async chat(messages, config = {}) {
      const model = GROQ_MODEL_MAP[config.model ?? ""] ?? "llama-3.3-70b-versatile";
      const stream = await client.chat.completions.create({
        model,
        messages: messages as Groq.Chat.ChatCompletionMessageParam[],
        stream: true,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 800,
      });

      return {
        async *[Symbol.asyncIterator]() {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) yield delta;
          }
        },
      };
    },

    async chatOnce(messages, config = {}) {
      const model = GROQ_MODEL_MAP[config.model ?? ""] ?? "llama-3.3-70b-versatile";
      const res = await client.chat.completions.create({
        model,
        messages: messages as Groq.Chat.ChatCompletionMessageParam[],
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 800,
      });
      return res.choices[0]?.message?.content ?? "";
    },
  };
}

// ── Singleton ──────────────────────────────────────────────────────

let _provider: LLMProvider | null = null;

export function getLLM(): LLMProvider {
  if (_provider) return _provider;

  const provider = (process.env.AI_PROVIDER ?? "openai").toLowerCase();

  switch (provider) {
    case "groq":
      _provider = createGroqProvider();
      break;
    case "openai":
    default:
      _provider = createOpenAIProvider();
      break;
  }

  return _provider;
}

/** Reset provider (for testing) */
export function resetLLM(): void {
  _provider = null;
}
