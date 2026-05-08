/**
 * AI Service — Facade pubblica
 *
 * L'UNICO file che il resto del backend deve importare per usare l'AI.
 * Le route e gli agent NON importano mai direttamente gli SDK provider.
 *
 * API pubblica:
 *   streamChat(request)   → AsyncIterable<string>  (streaming SSE)
 *   analyzeAgent(request) → Promise<AIAgentResponse>
 *   chat(request)         → Promise<string>         (non-streaming)
 *   embed(input)          → Promise<number[][]>
 *
 * Usage:
 *   import { ai } from "../lib/ai";
 *   for await (const chunk of ai.streamChat({ useCase: "streaming_chat", messages })) {
 *     res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
 *   }
 */

import { resolveAIConfig } from "./router";
import { streamGroqChat, chatGroq } from "./providers/groq";
import { streamAnthropicChat, analyzeWithAnthropic } from "./providers/anthropic";
import { streamOpenAIChat, chatOpenAI, createEmbeddings } from "./providers/openai";
import { streamGoogleChat } from "./providers/google";
import { AIRouterError } from "./types";
import type { AIChatRequest, AIAgentRequest, AIAgentResponse } from "./types";

// ─── Logging ─────────────────────────────────────────────────────────────────

function logAI(
  useCase: string,
  provider: string,
  model: string,
  ms: number,
  extra?: string
) {
  console.log(
    `[ai-router] ${useCase} → ${provider}/${model} (${ms}ms)${
      extra ? " " + extra : ""
    }`
  );
}

// ─── Helpers interni ──────────────────────────────────────────────────────────

async function* _streamFromProvider(
  provider: string,
  messages: AIChatRequest["messages"],
  model: string,
  temperature: number,
  maxTokens: number,
  systemPrompt?: string
): AsyncIterable<string> {
  switch (provider) {
    case "groq":
      yield* streamGroqChat(messages, model, temperature, maxTokens);
      break;
    case "anthropic":
      yield* streamAnthropicChat(
        messages,
        systemPrompt ?? "",
        model,
        maxTokens
      );
      break;
    case "openai":
      yield* streamOpenAIChat(messages, model, temperature, maxTokens);
      break;
    case "google":
      yield* streamGoogleChat(messages, model);
      break;
    default:
      throw new Error(`[ai-router] Provider sconosciuto: ${provider}`);
  }
}

async function _chatFromProvider(
  provider: string,
  messages: AIChatRequest["messages"],
  model: string,
  temperature: number,
  maxTokens: number
): Promise<string> {
  switch (provider) {
    case "groq":
      return chatGroq(messages, model, temperature, maxTokens);
    case "openai":
      return chatOpenAI(messages, model, temperature, maxTokens);
    default:
      throw new Error(
        `[ai-router] Provider "${provider}" non supporta chat non-streaming`
      );
  }
}

// ─── API pubblica ─────────────────────────────────────────────────────────────

export const ai = {
  /**
   * Streaming chat — per Wiki AI, RAG chat, SSE.
   * Restituisce AsyncIterable<string> normalizzato su tutti i provider.
   */
  async *streamChat(request: AIChatRequest): AsyncIterable<string> {
    const config = resolveAIConfig(request.useCase);
    const temperature = request.temperature ?? 0.7;
    const maxTokens = request.maxTokens ?? 2048;
    const model = request.model ?? config.model ?? "";
    const systemMessage = request.messages.find((m) => m.role === "system");
    const t0 = Date.now();

    try {
      yield* _streamFromProvider(
        config.primary,
        request.messages,
        model,
        temperature,
        maxTokens,
        systemMessage?.content
      );
      logAI(request.useCase, config.primary, model, Date.now() - t0, "[stream]");
    } catch (primaryErr) {
      if (!config.fallback) throw new AIRouterError(request.useCase, config.primary, primaryErr);

      console.warn(
        `[ai-router] ${config.primary} fallito per ${request.useCase}, retry su ${config.fallback}`,
        primaryErr instanceof Error ? primaryErr.message : primaryErr
      );

      const fallbackConfig = resolveAIConfig(request.useCase);
      const fallbackModel = DEFAULT_FALLBACK_MODELS[config.fallback] ?? model;

      try {
        yield* _streamFromProvider(
          config.fallback,
          request.messages,
          fallbackModel,
          temperature,
          maxTokens,
          systemMessage?.content
        );
        logAI(request.useCase, config.fallback, fallbackModel, Date.now() - t0, "[stream][fallback]");
      } catch (fallbackErr) {
        throw new AIRouterError(request.useCase, config.fallback, fallbackErr);
      }
    }
  },

  /**
   * Chat non-streaming — per research job, background generation.
   */
  async chat(request: AIChatRequest): Promise<string> {
    const config = resolveAIConfig(request.useCase);
    const temperature = request.temperature ?? 0.3;
    const maxTokens = request.maxTokens ?? 4096;
    const model = request.model ?? config.model ?? "";
    const t0 = Date.now();

    try {
      const text = await _chatFromProvider(
        config.primary,
        request.messages,
        model,
        temperature,
        maxTokens
      );
      logAI(request.useCase, config.primary, model, Date.now() - t0);
      return text;
    } catch (primaryErr) {
      if (!config.fallback) throw new AIRouterError(request.useCase, config.primary, primaryErr);

      console.warn(
        `[ai-router] ${config.primary} fallito, retry su ${config.fallback}`,
        primaryErr instanceof Error ? primaryErr.message : primaryErr
      );

      const fallbackModel = DEFAULT_FALLBACK_MODELS[config.fallback] ?? model;
      const text = await _chatFromProvider(
        config.fallback,
        request.messages,
        fallbackModel,
        temperature,
        maxTokens
      );
      logAI(request.useCase, config.fallback, fallbackModel, Date.now() - t0, "[fallback]");
      return text;
    }
  },

  /**
   * Analisi agente — per RIASEC+Spiriti, agent runs.
   * Usa Anthropic di default (tool use + ragionamento strutturato).
   */
  async analyzeAgent(request: AIAgentRequest): Promise<AIAgentResponse> {
    const config = resolveAIConfig("agent_analysis");
    const model = config.model ?? "claude-sonnet-4-5";
    const t0 = Date.now();

    try {
      const result = await analyzeWithAnthropic(request, model);
      logAI(
        "agent_analysis",
        config.primary,
        model,
        Date.now() - t0,
        `[in:${result.inputTokens} out:${result.outputTokens}]`
      );
      return result;
    } catch (err) {
      // Fallback: tenta OpenAI con JSON mode
      console.warn("[ai-router] Anthropic agent fallito, retry su openai", err);
      const fallbackModel = "gpt-4o-mini";
      const messages: AIChatRequest["messages"] = [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt },
      ];
      const text = await chatOpenAI(messages, fallbackModel, request.temperature ?? 0.3);
      logAI("agent_analysis", "openai", fallbackModel, Date.now() - t0, "[fallback]");
      return {
        text,
        toolCalls: [],
        stopReason: "end_turn",
        inputTokens: 0,
        outputTokens: 0,
      };
    }
  },

  /**
   * Embedding — sempre OpenAI text-embedding-3-small.
   * Restituisce number[][] pronto per knowledgenodes.embedding (jsonb).
   */
  async embed(input: string | string[]): Promise<number[][]> {
    const t0 = Date.now();
    const result = await createEmbeddings(input);
    logAI("embedding", "openai", "text-embedding-3-small", Date.now() - t0);
    return result;
  },
};

/** Modelli di fallback se il provider primario è giù */
const DEFAULT_FALLBACK_MODELS: Record<string, string> = {
  openai: "gpt-4o-mini",
  groq: "llama-3.1-70b-versatile",
  anthropic: "claude-haiku-3-5",
};

export type { AIChatRequest, AIAgentRequest, AIAgentResponse } from "./types";
export { AIRouterError } from "./types";
