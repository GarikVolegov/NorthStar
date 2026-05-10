/**
 * ai-mock.ts — Risposte mock per AI_MOCK_MODE=true
 *
 * Usato in staging per evitare costi LLM.
 * Importato dall'AI router quando process.env.AI_MOCK_MODE === 'true'.
 *
 * SICUREZZA: vedi AI_RULES.md — nessuna API key loggata.
 */

export const MOCK_CHAT_RESPONSE = {
  content: '[MOCK STAGING] Sono Wendy in modalità test. Nessuna chiamata AI reale è stata effettuata.',
  usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  model: 'mock-model',
  provider: 'mock',
};

export const MOCK_STREAM_CHUNKS = [
  '[MOCK STAGING] ',
  'Risposta simulata ',
  'per ambiente staging. ',
  'AI_MOCK_MODE=true attivo.',
];

/**
 * Vettore embedding mock — 1536 dimensioni di zeri.
 * Compatibile con OpenAI text-embedding-3-small.
 */
export const MOCK_EMBEDDING = new Array(1536).fill(0);

/**
 * Simula un delay realistico per testare l'UI di loading
 * senza aspettare risposte LLM reali.
 */
export async function mockDelay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock stream asincrono — compatibile con l'interfaccia
 * attesa da ai.stream() nelle route SSE.
 */
export async function* mockStream(): AsyncGenerator<string> {
  for (const chunk of MOCK_STREAM_CHUNKS) {
    await mockDelay(150);
    yield chunk;
  }
}
