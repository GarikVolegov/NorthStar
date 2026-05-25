/**
 * Chain of Thought (CoT) — hidden reasoning layer.
 *
 * WHAT IT DOES
 * ─────────────
 * Before the coach gives the visible answer, it runs a silent reasoning pass
 * using gpt-4o (non-streaming). This pass extracts:
 *
 *   limiting_pattern  — the cognitive/behavioral pattern the user is showing
 *   controllable      — 2-3 actions the user can take right now
 *   blind_spot        — what the user is NOT seeing but should
 *   confidence        — 0-1, how confident the agent is it understood the question
 *
 * These are injected as a "coach's internal reasoning" section into the
 * final system prompt. The user NEVER sees the CoT — they only see a better answer.
 *
 * WHY HIDDEN CoT
 * ───────────────
 * Showing the reasoning steps to the user breaks the conversational flow.
 * But without reasoning, the agent jumps to generic advice. The hidden CoT
 * forces the model to "think before speaking" and then produce a focused answer.
 *
 * COST
 * ─────
 * ~200 input tokens + ~150 output tokens per call = ~0.001$ per message at
 * gpt-4o pricing. Acceptable for a premium feature.
 *
 * SKIP CONDITION
 * ───────────────
 * If the message is very short (<10 words) or is a greeting/acknowledgement,
 * the CoT is skipped (returns null) to avoid wasting tokens.
 */
import { openai } from "../client";
import { logger } from "../logger";
import { selectModelFor } from "../model-router";
import { ragConfig } from "../config/rag";

export interface CoTResult {
  limitingPattern: string;      // e.g. "all-or-nothing thinking"
  controllableActions: string[]; // what the user can do right now
  blindSpot: string;            // what they're not seeing
  confidence: number;           // 0-1
}

// ── In-session cache ──────────────────────────────────────────────────────────

interface CachedCoT {
  result: CoTResult;
  userTokens: Set<string>;
  timestamp: number;
}

const cotCache = new Map<number, CachedCoT>();

function tokenizeForCoT(s: string): Set<string> {
  return new Set(s.toLowerCase().match(/[a-z\u00e0-\u00fc]{4,}/g) ?? []);
}

function shouldReuseCached(userId: number, newTokens: Set<string>): CoTResult | null {
  const cached = cotCache.get(userId);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > ragConfig.chainOfThought.cacheTtlMs) {
    cotCache.delete(userId);
    return null;
  }
  if (cached.result.confidence < ragConfig.chainOfThought.reuseMinConfidence) return null;
  if (newTokens.size === 0 || cached.userTokens.size === 0) return null;
  const intersection = [...newTokens].filter((t) => cached.userTokens.has(t)).length;
  const overlap = intersection / Math.max(newTokens.size, cached.userTokens.size);
  if (overlap < ragConfig.chainOfThought.reuseMinTokenOverlap) return null;
  return cached.result;
}

const COT_SYSTEM = `
Sei il layer di ragionamento interno di un coach di crescita personale.
Il tuo output è JSON — non viene mai mostrato all'utente.

Dato il messaggio dell'utente, analizza con precisione:

1. limiting_pattern: Il pattern cognitivo o comportamentale che emerge
   (esempi: "pensiero tutto-o-niente", "identità legata al risultato",
   "evitamento del rischio per paura del giudizio", "confusione tra urgenza e importanza")

2. controllable_actions: Array di 2-3 azioni CONCRETE che l'utente può fare
   nelle prossime 24-72 ore. Devono essere specifiche, non generiche.

3. blind_spot: La cosa che l'utente NON sta vedendo o sta evitando di guardare.
   Deve essere precisa e leggermente scomoda — non ovvia.

4. confidence: Float 0-1. Quanto sei certo di aver capito correttamente il problema
   reale (0 = messaggio troppo vago, 1 = problema cristallino).

Rispondi SOLO con JSON valido, nessun testo extra:
{
  "limiting_pattern": "...",
  "controllable_actions": ["...", "..."],
  "blind_spot": "...",
  "confidence": 0.85
}
`.trim();

/** Short messages / greetings don't need CoT */
const SKIP_PATTERNS = [
  /^(ciao|salve|hey|ok|grazie|perfetto|capito|sì|no|va bene)[.!?]?$/i,
];

function shouldSkipCoT(message: string): boolean {
  const wordCount = message.trim().split(/\s+/).length;
  if (wordCount < ragConfig.chainOfThought.minWords) return true;
  return SKIP_PATTERNS.some((p) => p.test(message.trim()));
}

/**
 * Runs the hidden CoT reasoning pass.
 * Returns null if the message is too short/simple to warrant analysis.
 * Uses an in-session cache: if the user's new message has ≥60% token overlap
 * with the previous one and the cached confidence was ≥0.75, reuses the cached
 * result to avoid an expensive GPT-4o call.
 */
export async function runChainOfThought(
  userId: number,
  userMessage: string,
  conversationSummary?: string, // optional: last 2-3 exchanges for context
): Promise<CoTResult | null> {
  if (shouldSkipCoT(userMessage)) return null;

  const tokens = tokenizeForCoT(userMessage);
  const cached = shouldReuseCached(userId, tokens);
  if (cached) {
    logger.debug({ userId }, "CoT cache hit");
    return cached;
  }

  const userContent = conversationSummary
    ? `Contesto recente:\n${conversationSummary}\n\nMessaggio attuale: ${userMessage}`
    : userMessage;

  try {
    const route = selectModelFor("chain-of-thought");
    const response = await openai.chat.completions.create({
      model: route.model,
      messages: [
        { role: "system", content: COT_SYSTEM },
        { role: "user",   content: userContent },
      ],
      temperature: ragConfig.chainOfThought.temperature,
      max_tokens: ragConfig.chainOfThought.maxTokens,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const result: CoTResult = {
      limitingPattern:    (parsed.limiting_pattern as string)     ?? "non identificato",
      controllableActions: (parsed.controllable_actions as string[]) ?? [],
      blindSpot:          (parsed.blind_spot as string)           ?? "non identificato",
      confidence:         (parsed.confidence as number)           ?? 0.5,
    };

    cotCache.set(userId, { result, userTokens: tokens, timestamp: Date.now() });
    return result;
  } catch (err) {
    // CoT failure is non-fatal — the agent continues without it
    logger.warn({ err }, "CoT failed");
    return null;
  }
}

/**
 * Serialises the CoT result into a system prompt section.
 * Only included if confidence >= 0.6 (below that, the analysis is too uncertain).
 */
export function buildCoTSection(cot: CoTResult | null): string {
  if (!cot || cot.confidence < ragConfig.chainOfThought.outputMinConfidence) return "";

  const actions = cot.controllableActions
    .map((a, i) => `   ${i + 1}. ${a}`)
    .join("\n");

  return `
## Ragionamento interno del coach (non visibile all'utente)
Pattern che emerge: ${cot.limitingPattern}
Angolo cieco: ${cot.blindSpot}
Azioni su cui l'utente ha controllo:
${actions}

USA queste osservazioni per dare una risposta più precisa e mirata.
Non citare esplicitamente questo ragionamento nella risposta — incorporalo.
`.trim();
}
