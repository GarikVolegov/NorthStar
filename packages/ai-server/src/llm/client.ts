/**
 * LLM Provider abstraction — supports OpenAI, Groq and OpenRouter backends.
 *
 * Usage:
 *   const llm = getLLM();
 *   const stream = llm.chat(messages, { model: "gpt-4o-mini", temperature: 0.1 });
 *
 * Provider selection (first match):
 *   1. AI_PROVIDER=openrouter → OpenRouter (requires OPENROUTER_API_KEY)
 *   2. AI_PROVIDER=groq → Groq (requires GROQ_API_KEY)
 *   3. default → OpenAI (requires AI_INTEGRATIONS_OPENAI_*)
 */

import OpenAI from "openai";
import Groq from "groq-sdk";
import pRetry from "p-retry";
import { logger } from "../logger";

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

// ── Retry + timeout helpers ───────────────────────────────────────

function isTransientError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("rate limit") ||
      msg.includes("timeout") ||
      msg.includes("5") ||
      msg.includes("network") ||
      msg.includes("econnrefused") ||
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("internal server error") ||
      msg.includes("service unavailable") ||
      msg.includes("bad gateway")
    );
  }
  return false;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`${label} timeout after ${ms}ms`)), ms),
    ),
  ]);
}

const CHAT_TIMEOUT = 30_000;
const CHAT_ONCE_TIMEOUT = 15_000;

// ── OpenAI Provider ────────────────────────────────────────────────

function createOpenAIProvider(): LLMProvider {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) {
    throw new Error("AI_INTEGRATIONS_OPENAI_BASE_URL and AI_INTEGRATIONS_OPENAI_API_KEY must be set");
  }
  const client = new OpenAI({ apiKey, baseURL });

  const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  return {
    async chat(messages, config = {}) {
      const stream = await pRetry(
        () => withTimeout(
          client.chat.completions.create({
            model: config.model ?? DEFAULT_MODEL,
            messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
            stream: true,
            temperature: config.temperature ?? 0.7,
            max_tokens: config.maxTokens ?? 800,
          }),
          CHAT_TIMEOUT,
          "openai chat stream",
        ),
        {
          retries: 2,
          onFailedAttempt: (err) => {
            logger.warn({ err, attempt: err.attemptNumber }, "LLM chat retry");
          },
        },
      );

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
      const res = await pRetry(
        () => withTimeout(
          client.chat.completions.create({
            model: config.model ?? DEFAULT_MODEL,
            messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
            temperature: config.temperature ?? 0.7,
            max_tokens: config.maxTokens ?? 800,
          }),
          CHAT_ONCE_TIMEOUT,
          "openai chatOnce",
        ),
        {
          retries: 2,
          onFailedAttempt: (err) => {
            logger.warn({ err, attempt: err.attemptNumber }, "LLM chatOnce retry");
          },
        },
      );
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

  // Map OpenAI-style names → Groq equivalents. Used only when callers still
  // pass legacy model strings; the new model-router already returns Groq names
  // directly so this map is becoming a safety net.
  const GROQ_MODEL_MAP: Record<string, string> = {
    "gpt-4o-mini": "llama-3.1-8b-instant",      // cheap class → cheapest Groq
    "gpt-4o":      "llama-3.3-70b-versatile",   // premium class → best Groq
    "gpt-3.5-turbo": "llama-3.1-8b-instant",
  };

  return {
    async chat(messages, config = {}) {
      const model = GROQ_MODEL_MAP[config.model ?? ""] ?? "llama-3.3-70b-versatile";
      const stream = await pRetry(
        () => withTimeout(
          client.chat.completions.create({
            model,
            messages: messages as Groq.Chat.ChatCompletionMessageParam[],
            stream: true,
            temperature: config.temperature ?? 0.7,
            max_tokens: config.maxTokens ?? 800,
          }),
          CHAT_TIMEOUT,
          "groq chat stream",
        ),
        {
          retries: 2,
          onFailedAttempt: (err) => {
            logger.warn({ err, attempt: err.attemptNumber }, "Groq chat retry");
          },
        },
      );

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
      const res = await pRetry(
        () => withTimeout(
          client.chat.completions.create({
            model,
            messages: messages as Groq.Chat.ChatCompletionMessageParam[],
            temperature: config.temperature ?? 0.7,
            max_tokens: config.maxTokens ?? 800,
          }),
          CHAT_ONCE_TIMEOUT,
          "groq chatOnce",
        ),
        {
          retries: 2,
          onFailedAttempt: (err) => {
            logger.warn({ err, attempt: err.attemptNumber }, "Groq chatOnce retry");
          },
        },
      );
      return res.choices[0]?.message?.content ?? "";
    },
  };
}

// ── OpenRouter Provider ──────────────────────────────────────────

function createOpenRouterProvider(): LLMProvider {
  const baseURL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
  const apiKey = process.env.OPENROUTER_API_KEY || "";
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY must be set when AI_PROVIDER=openrouter");
  }
  const client = new OpenAI({ apiKey, baseURL });

  return {
    async chat(messages, config = {}) {
      const stream = await pRetry(
        () => withTimeout(
          client.chat.completions.create({
            model: config.model ?? process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free",
            messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
            stream: true,
            temperature: config.temperature ?? 0.7,
            max_tokens: config.maxTokens ?? 800,
          }),
          CHAT_TIMEOUT,
          "openrouter chat stream",
        ),
        {
          retries: 2,
          onFailedAttempt: (err) => {
            logger.warn({ err, attempt: err.attemptNumber }, "OpenRouter chat retry");
          },
        },
      );

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
      const res = await pRetry(
        () => withTimeout(
          client.chat.completions.create({
            model: config.model ?? process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free",
            messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
            temperature: config.temperature ?? 0.7,
            max_tokens: config.maxTokens ?? 800,
          }),
          CHAT_ONCE_TIMEOUT,
          "openrouter chatOnce",
        ),
        {
          retries: 2,
          onFailedAttempt: (err) => {
            logger.warn({ err, attempt: err.attemptNumber }, "OpenRouter chatOnce retry");
          },
        },
      );
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
    case "openrouter":
      _provider = createOpenRouterProvider();
      break;
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
