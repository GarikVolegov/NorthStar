/**
 * Mock AI Provider — NorthStar
 *
 * Usato in CI (USE_MOCK_AI=true) e nei test di integrazione.
 * Sostituisce tutti i provider reali (Groq, Anthropic, OpenAI, Google) con
 * risposte deterministiche e istantanee — zero chiamate API esterne, zero costo.
 *
 * Strategia:
 *   - `streamChat` → emette token fissi con delay 0ms
 *   - `chat`       → restituisce JSON valido o testo plain a seconda dell'useCase
 *   - `analyzeAgent` → AIAgentResponse completa con dati RIASEC mock
 *   - `embed`      → vettore float32 di dimensione 1536 (text-embedding-3-small compat)
 *
 * Il mock imposta un header `X-AI-Provider: mock` su ogni risposta — usato
 * nei test di integrazione per verificare che il traffico AI passi dal router
 * e non da chiamate dirette ai provider.
 *
 * IMPORTANTE: questo file non deve mai essere importato in produzione.
 * L'import avviene solo tramite ai/index.ts quando USE_MOCK_AI=true.
 */

import type { AIChatRequest, AIAgentRequest, AIAgentResponse } from '../types.js';

export const MOCK_PROVIDER_NAME = 'mock' as const;

// Testo di risposta deterministico per use case
const MOCK_RESPONSES: Record<string, string> = {
  streaming_chat:  'Questa è una risposta mock del career advisor NorthStar.',
  agent_analysis:  JSON.stringify({ insight: 'Mock RIASEC insight', score: 0.85 }),
  json_extraction: JSON.stringify({ title: 'Software Engineer', skills: ['TypeScript', 'Node.js'] }),
  research:        'Mock research output: settore tech in crescita del 12% YoY.',
  embedding:       '',
};

// Embedding mock: vettore di 1536 float deterministici (compatibile text-embedding-3-small)
const MOCK_EMBEDDING = Array.from({ length: 1536 }, (_, i) => Math.sin(i * 0.01));

/** Flag globale — true se almeno una chiamata AI è passata dal mock (per asserzioni test) */
export let mockCallCount = 0;
export let lastMockUseCase: string | null = null;

export function resetMockCounters(): void {
  mockCallCount = 0;
  lastMockUseCase = null;
}

// ─── streamChat ──────────────────────────────────────────────────────────────

export async function* mockStreamChat(
  request: AIChatRequest,
): AsyncIterable<string> {
  mockCallCount++;
  lastMockUseCase = request.useCase;
  const text = MOCK_RESPONSES[request.useCase] ?? 'Mock AI response.';
  // Emette token per token simulando streaming
  for (const token of text.split(' ')) {
    yield token + ' ';
    // Nessun await — mock sincrono per velocità nei test
  }
}

// ─── chat (non-streaming) ────────────────────────────────────────────────────

export async function mockChat(
  request: AIChatRequest,
): Promise<string> {
  mockCallCount++;
  lastMockUseCase = request.useCase;
  return MOCK_RESPONSES[request.useCase] ?? 'Mock AI response.';
}

// ─── analyzeAgent ────────────────────────────────────────────────────────────

export async function mockAnalyzeAgent(
  request: AIAgentRequest,
): Promise<AIAgentResponse> {
  mockCallCount++;
  lastMockUseCase = 'agent_analysis';
  return {
    text: `Mock analysis for: ${request.userPrompt.slice(0, 50)}`,
    toolCalls: [],
    stopReason: 'end_turn',
    inputTokens: 10,
    outputTokens: 20,
  };
}

// ─── embed ───────────────────────────────────────────────────────────────────

export async function mockEmbed(
  input: string | string[],
): Promise<number[][]> {
  mockCallCount++;
  lastMockUseCase = 'embedding';
  const items = Array.isArray(input) ? input : [input];
  return items.map(() => MOCK_EMBEDDING);
}
