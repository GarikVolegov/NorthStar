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
import { readToolCalls } from "./tool-call-parser";
import { getOpenAIFallbackConfig, shouldFallbackToOpenAI } from "../client";

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
}

export interface LLMConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatWithToolsResult {
  content: string;
  toolCalls: ToolCall[];
  finishReason: "stop" | "tool_calls" | "length";
}

export type ToolDefinitionOpenAI = {
  type: "function";
  function: { name: string; description: string; parameters: object };
};

export interface LLMProvider {
  chat(messages: LLMMessage[], config?: LLMConfig): Promise<AsyncIterable<string>>;
  chatOnce(messages: LLMMessage[], config?: LLMConfig): Promise<string>;
  chatWithTools(
    messages: LLMMessage[],
    tools: ToolDefinitionOpenAI[],
    config?: LLMConfig,
  ): Promise<ChatWithToolsResult>;
}

// ── Retry + timeout helpers ───────────────────────────────────────

/**
 * Run an SDK call with a hard timeout. The factory receives an `AbortSignal`
 * so the underlying HTTP request is actually cancelled on timeout (not left
 * running), and the timer is always cleared so no stray timers accumulate.
 */
function withTimeout<T>(
  factory: (signal: AbortSignal) => Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return factory(controller.signal)
    .catch((err: unknown) => {
      if (controller.signal.aborted) throw new Error(`${label} timeout after ${ms}ms`);
      throw err;
    })
    .finally(() => clearTimeout(timer));
}

const CHAT_TIMEOUT = 30_000;
const CHAT_ONCE_TIMEOUT = 15_000;

/** Map a provider finish_reason to our narrow union, collapsing anything
 * unexpected (e.g. "content_filter", "function_call") to "stop". */
function normalizeFinishReason(reason: string | null | undefined): ChatWithToolsResult["finishReason"] {
  return reason === "tool_calls" || reason === "length" ? reason : "stop";
}

// ── OpenAI Provider ────────────────────────────────────────────────

function createOpenAIProvider(): LLMProvider {
  const fallback = getOpenAIFallbackConfig();
  if (!fallback) {
    throw new Error("OPENAI_API_KEY or AI_INTEGRATIONS_OPENAI_API_KEY must be set");
  }
  const client = new OpenAI({ apiKey: fallback.apiKey, baseURL: fallback.baseURL });

  const DEFAULT_MODEL = fallback.model;

  return {
    async chat(messages, config = {}) {
      const stream = await pRetry(
        () => withTimeout(
          (signal) => client.chat.completions.create({
            model: config.model ?? DEFAULT_MODEL,
            messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
            stream: true,
            temperature: config.temperature ?? 0.7,
            max_tokens: config.maxTokens ?? 800,
          }, { signal }),
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
          (signal) => client.chat.completions.create({
            model: config.model ?? DEFAULT_MODEL,
            messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
            temperature: config.temperature ?? 0.7,
            max_tokens: config.maxTokens ?? 800,
          }, { signal }),
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

    async chatWithTools(messages, tools, config = {}) {
      const res = await pRetry(
        () => withTimeout(
          (signal) => client.chat.completions.create({
            model: config.model ?? DEFAULT_MODEL,
            messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
            tools:       tools as OpenAI.Chat.ChatCompletionTool[],
            tool_choice: "auto",
            temperature: config.temperature ?? 0.1,
            max_tokens:  config.maxTokens ?? 500,
          }, { signal }),
          CHAT_ONCE_TIMEOUT,
          "openai chatWithTools",
        ),
        { retries: 2, onFailedAttempt: (err) => logger.warn({ err, attempt: err.attemptNumber }, "LLM chatWithTools retry") },
      );
      const msg = res.choices[0]?.message;
      const toolCalls = readToolCalls(msg?.tool_calls);
      return {
        content:      msg?.content ?? "",
        toolCalls,
        finishReason: normalizeFinishReason(res.choices[0]?.finish_reason),
      };
    },
  };
}

// ── Groq Provider ──────────────────────────────────────────────────

function shouldFallbackFromGroq(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  return status === 429 || (typeof status === "number" && status >= 500);
}

let _groqOrFallback: LLMProvider | null | undefined;
function getGroqOpenRouterFallback(): LLMProvider | null {
  if (_groqOrFallback !== undefined) return _groqOrFallback;
  if (!process.env.OPENROUTER_API_KEY) { _groqOrFallback = null; return null; }
  try { _groqOrFallback = createOpenRouterProvider(); return _groqOrFallback; }
  catch { _groqOrFallback = null; return null; }
}

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
      const model = GROQ_MODEL_MAP[config.model ?? ""] ?? config.model ?? "llama-3.3-70b-versatile";
      try {
        const stream = await pRetry(
          () => withTimeout(
            (signal) => client.chat.completions.create({
              model,
              messages: messages as Groq.Chat.ChatCompletionMessageParam[],
              stream: true,
              temperature: config.temperature ?? 0.7,
              max_tokens: config.maxTokens ?? 800,
            }, { signal }),
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
      } catch (err) {
        const fallback = getGroqOpenRouterFallback();
        if (!fallback || !shouldFallbackFromGroq(err)) throw err;
        logger.warn({ err, model }, "Groq rate limited; falling back to OpenRouter");
        return fallback.chat(messages, config);
      }
    },

    async chatOnce(messages, config = {}) {
      const model = GROQ_MODEL_MAP[config.model ?? ""] ?? config.model ?? "llama-3.3-70b-versatile";
      try {
        const res = await pRetry(
          () => withTimeout(
            (signal) => client.chat.completions.create({
              model,
              messages: messages as Groq.Chat.ChatCompletionMessageParam[],
              temperature: config.temperature ?? 0.7,
              max_tokens: config.maxTokens ?? 800,
            }, { signal }),
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
      } catch (err) {
        const fallback = getGroqOpenRouterFallback();
        if (!fallback || !shouldFallbackFromGroq(err)) throw err;
        logger.warn({ err, model }, "Groq rate limited; falling back to OpenRouter");
        return fallback.chatOnce(messages, config);
      }
    },

    async chatWithTools(messages, tools, config = {}) {
      const model = GROQ_MODEL_MAP[config.model ?? ""] ?? config.model ?? "llama-3.3-70b-versatile";
      try {
        const res = await pRetry(
          () => withTimeout(
            (signal) => client.chat.completions.create({
              model,
              messages:    messages as Groq.Chat.ChatCompletionMessageParam[],
              tools:       tools as Groq.Chat.ChatCompletionTool[],
              tool_choice: "auto",
              temperature: config.temperature ?? 0.1,
              max_tokens:  config.maxTokens ?? 500,
            }, { signal }),
            CHAT_ONCE_TIMEOUT,
            "groq chatWithTools",
          ),
          { retries: 2, onFailedAttempt: (err) => logger.warn({ err, attempt: err.attemptNumber }, "Groq chatWithTools retry") },
        );
        const msg = res.choices[0]?.message;
        const toolCalls = readToolCalls(msg?.tool_calls);
        return {
          content:      msg?.content ?? "",
          toolCalls,
          finishReason: normalizeFinishReason(res.choices[0]?.finish_reason),
        };
      } catch (err) {
        const fallback = getGroqOpenRouterFallback();
        if (!fallback || !shouldFallbackFromGroq(err)) throw err;
        logger.warn({ err, model }, "Groq rate limited; falling back to OpenRouter");
        return fallback.chatWithTools(messages, tools, config);
      }
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
  const fallbackConfig = getOpenAIFallbackConfig();
  const fallbackClient = fallbackConfig
    ? new OpenAI({ apiKey: fallbackConfig.apiKey, baseURL: fallbackConfig.baseURL })
    : null;

  async function callWithFallback<T>(
    label: string,
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
  ): Promise<T> {
    try {
      return await primary();
    } catch (err) {
      if (!fallbackClient || !shouldFallbackToOpenAI(err)) throw err;
      logger.warn({ err, label }, "OpenRouter rate limited; falling back to OpenAI");
      return await fallback();
    }
  }

  return {
    async chat(messages, config = {}) {
      const stream = await pRetry(
        () => withTimeout(
          (signal) => callWithFallback(
            "openrouter chat stream",
            () => client.chat.completions.create({
              model: config.model ?? process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free",
              messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
              stream: true,
              temperature: config.temperature ?? 0.7,
              max_tokens: config.maxTokens ?? 800,
            }, { signal }),
            () => fallbackClient!.chat.completions.create({
              model: fallbackConfig!.model,
              messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
              stream: true,
              temperature: config.temperature ?? 0.7,
              max_tokens: config.maxTokens ?? 800,
            }, { signal }),
          ),
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
          (signal) => callWithFallback(
            "openrouter chatOnce",
            () => client.chat.completions.create({
              model: config.model ?? process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free",
              messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
              temperature: config.temperature ?? 0.7,
              max_tokens: config.maxTokens ?? 800,
            }, { signal }),
            () => fallbackClient!.chat.completions.create({
              model: fallbackConfig!.model,
              messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
              temperature: config.temperature ?? 0.7,
              max_tokens: config.maxTokens ?? 800,
            }, { signal }),
          ),
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

    async chatWithTools(messages, tools, config = {}) {
      const res = await pRetry(
        () => withTimeout(
          (signal) => callWithFallback(
            "openrouter chatWithTools",
            () => client.chat.completions.create({
              model:       config.model ?? process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free",
              messages:    messages as OpenAI.Chat.ChatCompletionMessageParam[],
              tools:       tools as OpenAI.Chat.ChatCompletionTool[],
              tool_choice: "auto",
              temperature: config.temperature ?? 0.1,
              max_tokens:  config.maxTokens ?? 500,
            }, { signal }),
            () => fallbackClient!.chat.completions.create({
              model:       fallbackConfig!.model,
              messages:    messages as OpenAI.Chat.ChatCompletionMessageParam[],
              tools:       tools as OpenAI.Chat.ChatCompletionTool[],
              tool_choice: "auto",
              temperature: config.temperature ?? 0.1,
              max_tokens:  config.maxTokens ?? 500,
            }, { signal }),
          ),
          CHAT_ONCE_TIMEOUT,
          "openrouter chatWithTools",
        ),
        { retries: 2, onFailedAttempt: (err) => logger.warn({ err, attempt: err.attemptNumber }, "OpenRouter chatWithTools retry") },
      );
      const msg = res.choices[0]?.message;
      const toolCalls = readToolCalls(msg?.tool_calls);
      return {
        content:      msg?.content ?? "",
        toolCalls,
        finishReason: normalizeFinishReason(res.choices[0]?.finish_reason),
      };
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

/** Per-provider cache for route-based dispatch, so we don't build a new SDK
 * client (and connection pool) on every call. */
const _routeProviders = new Map<string, LLMProvider>();

export function resetLLM(): void {
  _provider = null;
  _routeProviders.clear();
}

/**
 * Restituisce un provider LLM specifico per route, permettendo chiamate
 * a provider diversi (es. Groq per NANO, OpenRouter per STANDARD) nella stessa istanza.
 * Non usa il singleton: crea un client per-call in base a ModelRoute.provider.
 */
export function getLLMForRoute(route: { provider: "openai" | "groq" | "openrouter" }): LLMProvider {
  const cached = _routeProviders.get(route.provider);
  if (cached) return cached;
  const provider =
    route.provider === "openrouter" ? createOpenRouterProvider() :
    route.provider === "groq"       ? createGroqProvider() :
    createOpenAIProvider();
  _routeProviders.set(route.provider, provider);
  return provider;
}
