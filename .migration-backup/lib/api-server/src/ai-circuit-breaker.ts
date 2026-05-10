/**
 * ai-circuit-breaker.ts
 *
 * Singleton CircuitBreaker instance pre-configured for the Wendy AI service
 * (OpenAI / runGrowthAgent). Import `wendyBreaker` wherever you call the AI.
 *
 * Configuration (overridable via env):
 *   CIRCUIT_FAILURE_THRESHOLD  — consecutive failures before OPEN  (default: 5)
 *   CIRCUIT_COOLDOWN_MS        — cooldown before HALF_OPEN probe    (default: 60000)
 *   CIRCUIT_CALL_TIMEOUT_MS    — per-call timeout                   (default: 30000)
 *
 * Also exports:
 *   aiFallbackStream() — async generator that emits a graceful SSE fallback
 *                        when the breaker is OPEN.
 */

import { CircuitBreaker, CircuitOpenError, TimeoutError } from './circuit-breaker';

const failureThreshold = Number(process.env.CIRCUIT_FAILURE_THRESHOLD ?? 5);
const cooldownMs       = Number(process.env.CIRCUIT_COOLDOWN_MS       ?? 60_000);
const callTimeoutMs    = Number(process.env.CIRCUIT_CALL_TIMEOUT_MS   ?? 30_000);

export const wendyBreaker = new CircuitBreaker({
  name: 'wendy-ai',
  failureThreshold,
  cooldownMs,
  callTimeoutMs,
  onStateChange: (name, from, to) => {
    // Log the transition — hook up to your monitoring/alerting here
    console.log(`[AI-Circuit] ${name}: ${from} → ${to} at ${new Date().toISOString()}`);
  },
});

// ── Fallback SSE event sequence ────────────────────────────────────────────

const FALLBACK_MESSAGE_OPEN =
  '⚡ Ops, sono momentaneamente in tilt. '
  + 'Il servizio AI non risponde — riprova tra qualche minuto!';

const FALLBACK_MESSAGE_TIMEOUT =
  '⏱️ La richiesta ha impiegato troppo tempo. '
  + 'Sto tornando operativa a breve — riprova!';

/**
 * Async generator that yields SSE-compatible event objects for the fallback
 * path. The consumer (chat.ts) simply iterates it the same way it would
 * iterate runGrowthAgent(), so the route handler needs no extra branching.
 */
export async function* aiFallbackStream(
  reason: 'open' | 'timeout' | 'unknown' = 'open'
): AsyncGenerator<{ type: string; value?: string; message?: string }> {
  const text =
    reason === 'timeout' ? FALLBACK_MESSAGE_TIMEOUT : FALLBACK_MESSAGE_OPEN;

  // Emit the full text as a single token so the frontend renders it cleanly
  yield { type: 'token', value: text };
  yield { type: 'done',  sources: [] };
}

/**
 * Helper to classify an error and return the appropriate fallback reason.
 */
export function classifyBreakerError(
  err: unknown
): 'open' | 'timeout' | 'unknown' {
  if (err instanceof CircuitOpenError) return 'open';
  if (err instanceof TimeoutError)     return 'timeout';
  return 'unknown';
}

export { CircuitOpenError, TimeoutError };
