/**
 * AI Service — Facade pubblica
 *
 * L'UNICO file che il resto del backend deve importare per usare l'AI.
 * Le route e gli agent NON importano mai direttamente gli SDK provider.
 *
 * Ogni chiamata AI loga tramite getRequestLogger():
 *   { requestId, useCase, provider, model, durationMs, inputTokens?, outputTokens? }
 * → In produzione ogni riga AI è correlabile alla richiesta HTTP padre.
 *
 * Mock AI (CI / test di integrazione):
 *   Se USE_MOCK_AI=true, tutte le chiamate vengono servite dal mock provider.
 */

import { resolveAIConfig } from './router.js';
import { streamGroqChat, chatGroq } from './providers/groq.js';
import { streamAnthropicChat, analyzeWithAnthropic } from './providers/anthropic.js';
import { streamOpenAIChat, chatOpenAI, createEmbeddings } from './providers/openai.js';
import { streamGoogleChat } from './providers/google.js';
import {
  mockStreamChat, mockChat, mockAnalyzeAgent, mockEmbed,
  MOCK_PROVIDER_NAME,
} from './providers/mock.js';
import { AIRouterError } from './types.js';
import type { AIChatRequest, AIAgentRequest, AIAgentResponse } from './types.js';
import { getRequestLogger, logger } from '../logger.js';

// ─── Mock mode ────────────────────────────────────────────────────────────────
export const USE_MOCK_AI = process.env.USE_MOCK_AI === 'true';

if (USE_MOCK_AI) {
  logger.warn('[ai-router] ⚠ MOCK MODE attivo — nessuna chiamata AI esterna');
}

// ─── Helpers interni ──────────────────────────────────────────────────────────

async function* _streamFromProvider(
  provider: string,
  messages: AIChatRequest['messages'],
  model: string,
  temperature: number,
  maxTokens: number,
  systemPrompt?: string
): AsyncIterable<string> {
  switch (provider) {
    case 'groq':
      yield* streamGroqChat(messages, model, temperature, maxTokens);
      break;
    case 'anthropic':
      yield* streamAnthropicChat(messages, systemPrompt ?? '', model, maxTokens);
      break;
    case 'openai':
      yield* streamOpenAIChat(messages, model, temperature, maxTokens);
      break;
    case 'google':
      yield* streamGoogleChat(messages, model);
      break;
    default:
      throw new Error(`[ai-router] Provider sconosciuto: ${provider}`);
  }
}

async function _chatFromProvider(
  provider: string,
  messages: AIChatRequest['messages'],
  model: string,
  temperature: number,
  maxTokens: number
): Promise<string> {
  switch (provider) {
    case 'groq':
      return chatGroq(messages, model, temperature, maxTokens);
    case 'openai':
      return chatOpenAI(messages, model, temperature, maxTokens);
    default:
      throw new Error(`[ai-router] Provider "${provider}" non supporta chat non-streaming`);
  }
}

// ─── API pubblica ─────────────────────────────────────────────────────────────

export const ai = {
  async *streamChat(request: AIChatRequest): AsyncIterable<string> {
    const log = getRequestLogger();

    if (USE_MOCK_AI) {
      log.debug({ useCase: request.useCase, provider: MOCK_PROVIDER_NAME }, '[ai] stream [mock]');
      yield* mockStreamChat(request);
      return;
    }

    const config       = resolveAIConfig(request.useCase);
    const temperature  = request.temperature ?? 0.7;
    const maxTokens    = request.maxTokens   ?? 2048;
    const model        = request.model ?? config.model ?? '';
    const systemMessage = request.messages.find((m) => m.role === 'system');
    const t0 = Date.now();

    log.info({ useCase: request.useCase, provider: config.primary, model }, '[ai] stream start');

    try {
      yield* _streamFromProvider(config.primary, request.messages, model, temperature, maxTokens, systemMessage?.content);
      log.info({ useCase: request.useCase, provider: config.primary, model, durationMs: Date.now() - t0 }, '[ai] stream end');
    } catch (primaryErr) {
      if (!config.fallback) throw new AIRouterError(request.useCase, config.primary, primaryErr);
      log.warn({ useCase: request.useCase, provider: config.primary, err: primaryErr }, '[ai] primary failed, retry fallback');
      const fallbackModel = DEFAULT_FALLBACK_MODELS[config.fallback] ?? model;
      try {
        yield* _streamFromProvider(config.fallback, request.messages, fallbackModel, temperature, maxTokens, systemMessage?.content);
        log.info({ useCase: request.useCase, provider: config.fallback, model: fallbackModel, durationMs: Date.now() - t0 }, '[ai] stream end [fallback]');
      } catch (fallbackErr) {
        throw new AIRouterError(request.useCase, config.fallback, fallbackErr);
      }
    }
  },

  async chat(request: AIChatRequest): Promise<string> {
    const log = getRequestLogger();

    if (USE_MOCK_AI) {
      log.debug({ useCase: request.useCase, provider: MOCK_PROVIDER_NAME }, '[ai] chat [mock]');
      return mockChat(request);
    }

    const config      = resolveAIConfig(request.useCase);
    const temperature = request.temperature ?? 0.3;
    const maxTokens   = request.maxTokens   ?? 4096;
    const model       = request.model ?? config.model ?? '';
    const t0 = Date.now();

    log.info({ useCase: request.useCase, provider: config.primary, model }, '[ai] chat start');

    try {
      const text = await _chatFromProvider(config.primary, request.messages, model, temperature, maxTokens);
      log.info({ useCase: request.useCase, provider: config.primary, model, durationMs: Date.now() - t0 }, '[ai] chat end');
      return text;
    } catch (primaryErr) {
      if (!config.fallback) throw new AIRouterError(request.useCase, config.primary, primaryErr);
      log.warn({ useCase: request.useCase, provider: config.primary, err: primaryErr }, '[ai] primary failed, retry fallback');
      const fallbackModel = DEFAULT_FALLBACK_MODELS[config.fallback] ?? model;
      const text = await _chatFromProvider(config.fallback, request.messages, fallbackModel, temperature, maxTokens);
      log.info({ useCase: request.useCase, provider: config.fallback, model: fallbackModel, durationMs: Date.now() - t0 }, '[ai] chat end [fallback]');
      return text;
    }
  },

  async analyzeAgent(request: AIAgentRequest): Promise<AIAgentResponse> {
    const log = getRequestLogger();

    if (USE_MOCK_AI) {
      log.debug({ provider: MOCK_PROVIDER_NAME }, '[ai] analyzeAgent [mock]');
      return mockAnalyzeAgent(request);
    }

    const config = resolveAIConfig('agent_analysis');
    const model  = config.model ?? 'claude-sonnet-4-5';
    const t0 = Date.now();

    log.info({ provider: config.primary, model }, '[ai] analyzeAgent start');

    try {
      const result = await analyzeWithAnthropic(request, model);
      log.info({
        provider: config.primary, model,
        durationMs: Date.now() - t0,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      }, '[ai] analyzeAgent end');
      return result;
    } catch (err) {
      log.warn({ provider: config.primary, err }, '[ai] Anthropic agent failed, fallback openai');
      const fallbackModel = 'gpt-4o-mini';
      const messages: AIChatRequest['messages'] = [
        { role: 'system', content: request.systemPrompt },
        { role: 'user',   content: request.userPrompt   },
      ];
      const text = await chatOpenAI(messages, fallbackModel, request.temperature ?? 0.3);
      log.info({ provider: 'openai', model: fallbackModel, durationMs: Date.now() - t0 }, '[ai] analyzeAgent end [fallback]');
      return { text, toolCalls: [], stopReason: 'end_turn', inputTokens: 0, outputTokens: 0 };
    }
  },

  async embed(input: string | string[]): Promise<number[][]> {
    const log = getRequestLogger();

    if (USE_MOCK_AI) {
      log.debug({ provider: MOCK_PROVIDER_NAME }, '[ai] embed [mock]');
      return mockEmbed(input);
    }

    const t0 = Date.now();
    log.info({ provider: 'openai', model: 'text-embedding-3-small' }, '[ai] embed start');
    const result = await createEmbeddings(input);
    log.info({ provider: 'openai', model: 'text-embedding-3-small', durationMs: Date.now() - t0 }, '[ai] embed end');
    return result;
  },
};

const DEFAULT_FALLBACK_MODELS: Record<string, string> = {
  openai:    'gpt-4o-mini',
  groq:      'llama-3.1-70b-versatile',
  anthropic: 'claude-haiku-3-5',
};

export type { AIChatRequest, AIAgentRequest, AIAgentResponse } from './types.js';
export { AIRouterError } from './types.js';
export { mockCallCount, lastMockUseCase, resetMockCounters } from './providers/mock.js';
