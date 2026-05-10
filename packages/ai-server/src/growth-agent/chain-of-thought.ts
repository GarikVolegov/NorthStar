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

export interface CoTResult {
  limitingPattern: string;      // e.g. "all-or-nothing thinking"
  controllableActions: string[]; // what the user can do right now
  blindSpot: string;            // what they're not seeing
  confidence: number;           // 0-1
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
  /^(ciao|salve|hey|ok|grazie|perfetto|capito|sì|no|va bene)[\.!?]?$/i,
];

function shouldSkipCoT(message: string): boolean {
  const wordCount = message.trim().split(/\s+/).length;
  if (wordCount < 5) return true;
  return SKIP_PATTERNS.some((p) => p.test(message.trim()));
}

/**
 * Runs the hidden CoT reasoning pass.
 * Returns null if the message is too short/simple to warrant analysis.
 */
export async function runChainOfThought(
  userMessage: string,
  conversationSummary?: string, // optional: last 2-3 exchanges for context
): Promise<CoTResult | null> {
  if (shouldSkipCoT(userMessage)) return null;

  const userContent = conversationSummary
    ? `Contesto recente:\n${conversationSummary}\n\nMessaggio attuale: ${userMessage}`
    : userMessage;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: COT_SYSTEM },
        { role: "user",   content: userContent },
      ],
      temperature: 0.3,   // low temperature for analytical tasks
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<CoTResult>;

    return {
      limitingPattern:    parsed.limiting_pattern     ?? "non identificato",
      controllableActions: parsed.controllable_actions ?? [],
      blindSpot:          parsed.blind_spot           ?? "non identificato",
      confidence:         parsed.confidence           ?? 0.5,
    } as unknown as CoTResult;
  } catch (err) {
    // CoT failure is non-fatal — the agent continues without it
    console.warn("[CoT] failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Serialises the CoT result into a system prompt section.
 * Only included if confidence >= 0.6 (below that, the analysis is too uncertain).
 */
export function buildCoTSection(cot: CoTResult | null): string {
  if (!cot || cot.confidence < 0.6) return "";

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
