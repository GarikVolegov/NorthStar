/**
 * SupervisorAgent — quality gate between specialist and client.
 *
 * WHAT IT DOES
 * ────────────
 * After the specialist/general agent buffers its full response,
 * the Supervisor evaluates it on 4 quality dimensions.
 * If the composite score is below the pass threshold, it rewrites
 * the response using GPT-4o-mini with a targeted correction prompt.
 *
 * EVALUATION DIMENSIONS (all local, zero extra API calls)
 * ─────────────────────────────────────────────────────
 *
 *  actionability    At least one concrete action, step, or next move.
 *                   Heuristic: looks for numbered lists, action verbs,
 *                   time references ("questa settimana", "entro", "domani").
 *
 *  platitude_free   No generic motivational filler.
 *                   Heuristic: checks for banned phrases list.
 *
 *  length_ok        Response is neither too short nor too long.
 *                   Too short: < 60 words (superficial).
 *                   Too long:  > 380 words (unfocused).
 *
 *  on_topic         The response actually addresses the user's message.
 *                   Heuristic: keyword overlap between user message
 *                   and response (Jaccard-like, stemmed).
 *
 * COMPOSITE SCORE
 * ───────────────
 *   actionability   × 0.35
 *   platitude_free  × 0.25
 *   length_ok       × 0.20
 *   on_topic        × 0.20
 *
 *   pass threshold: >= 0.70
 *
 * REWRITE
 * ───────
 * If evaluate() fails, rewrite() calls GPT-4o-mini with:
 *   - The original user message
 *   - The specialist domain + intent
 *   - The specific failure reasons
 *   - The original draft as a starting point
 * Temperature 0.50 (stable). Max 700 tokens.
 *
 * COST ANALYSIS
 * ─────────────
 * evaluate() = 0 extra API calls (pure heuristics, < 1ms)
 * rewrite()  = 1 GPT-4o-mini call (~300 input + 300 output tokens = ~$0.0003)
 *              Fires only when quality is actually poor (estimated ~15-25% of responses)
 */
import { openai } from "../client";
import type { Domain, Intent } from "./router-agent";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SupervisorDimensions {
  actionability:  number;   // 0-1
  platitudeFree:  number;   // 0-1
  lengthOk:       number;   // 0-1
  onTopic:        number;   // 0-1
}

export interface SupervisorResult {
  pass:        boolean;
  score:       number;           // 0-1 composite
  dimensions:  SupervisorDimensions;
  reasons:     string[];         // failure reasons, empty if pass
  rewritten:   boolean;         // true if rewrite was triggered
}

export interface SupervisorEvalInput {
  userMessage:  string;
  draft:        string;          // full buffered response
  domain:       Domain;
  intent:       Intent;
}

// ── Constants ─────────────────────────────────────────────────────────────

const PASS_THRESHOLD = 0.70;

const WEIGHTS = {
  actionability: 0.35,
  platitudeFree: 0.25,
  lengthOk:      0.20,
  onTopic:       0.20,
};

// Phrases that indicate generic/platitudinous content
const PLATITUDE_PATTERNS = [
  /credi in te stesso/i,
  /tutto è possibile/i,
  /non mollare mai/i,
  /il successo arriva/i,
  /step by step/i,
  /un passo alla volta/i,
  /sei sulla strada giusta/i,
  /hai tutto ciò che serve/i,
  /ce la farai/i,
  /il viaggio è lungo/i,
  /ricorda che puoi farcela/i,
  /ogni giorno è un nuovo inizio/i,
  /il cambiamento inizia da dentro/i,
];

// Action verb patterns (Italian + English mix)
const ACTION_PATTERNS = [
  /\b(fai|scrivi|contatta|invia|apri|crea|prepara|definisci|identifica|misura|testa|inizia|completa|leggi|studia|pratica)\b/i,
  /entro\s+(domani|questa settimana|lunedì|venerdì|\d+ giorni)/i,
  /passo\s+\d+/i,
  /\d+\.\ /,     // numbered list
  /- \[\s*\]/,  // checkbox
];

// ── Dimension scorers (all local) ────────────────────────────────────────

function scoreActionability(draft: string): number {
  const matches = ACTION_PATTERNS.filter((p) => p.test(draft)).length;
  if (matches >= 3) return 1.0;
  if (matches === 2) return 0.80;
  if (matches === 1) return 0.50;
  return 0.10; // no actionable content
}

function scorePlatitudeFree(draft: string): number {
  const hits = PLATITUDE_PATTERNS.filter((p) => p.test(draft)).length;
  if (hits === 0) return 1.0;
  if (hits === 1) return 0.60;
  if (hits === 2) return 0.30;
  return 0.0;  // response is mostly platitudes
}

function scoreLengthOk(draft: string): number {
  const words = draft.trim().split(/\s+/).length;
  if (words >= 80 && words <= 280)  return 1.0;   // ideal range
  if (words >= 60 && words <= 380)  return 0.75;  // acceptable
  if (words < 60)                    return 0.30;  // too short
  return 0.50;                                     // too long (>380)
}

function scoreOnTopic(userMessage: string, draft: string): number {
  // Jaccard-like keyword overlap (lowercased, stop-words stripped)
  const STOP = new Set(["il","la","lo","le","i","gli","un","una","uno","e","o","ma","che","di","a","in","con","su","per","tra","fra","da","del","della","dei","degli","delle","al","alla","ai","agli","alle","mi","ti","si","ci","vi","ho","hai","ha","ho","sono","sei","è","siamo","siete","non","come","cosa","perché","quando"]);
  const tokenize = (s: string) =>
    new Set(
      s.toLowerCase().match(/[a-zà-ü]{4,}/g)?.filter((w) => !STOP.has(w)) ?? [],
    );
  const uTokens = tokenize(userMessage);
  const dTokens = tokenize(draft);
  if (uTokens.size === 0) return 0.80; // can't measure, assume ok
  const intersection = [...uTokens].filter((w) => dTokens.has(w)).length;
  const jaccard = intersection / (uTokens.size + dTokens.size - intersection);
  // Jaccard on short texts is low by nature; calibrate thresholds
  if (jaccard >= 0.12) return 1.0;
  if (jaccard >= 0.07) return 0.75;
  if (jaccard >= 0.04) return 0.50;
  return 0.20;
}

// ── SupervisorAgent class ──────────────────────────────────────────────────────

export class SupervisorAgent {
  /**
   * Evaluates a buffered response. Pure local heuristics, ~0ms.
   * Returns a SupervisorResult with pass/fail + reasons.
   */
  evaluate(input: SupervisorEvalInput): SupervisorResult {
    const { userMessage, draft } = input;

    const dimensions: SupervisorDimensions = {
      actionability: scoreActionability(draft),
      platitudeFree: scorePlatitudeFree(draft),
      lengthOk:      scoreLengthOk(draft),
      onTopic:       scoreOnTopic(userMessage, draft),
    };

    const score =
      dimensions.actionability * WEIGHTS.actionability +
      dimensions.platitudeFree * WEIGHTS.platitudeFree +
      dimensions.lengthOk      * WEIGHTS.lengthOk      +
      dimensions.onTopic       * WEIGHTS.onTopic;

    const roundedScore = Math.round(score * 100) / 100;
    const pass = roundedScore >= PASS_THRESHOLD;

    const reasons: string[] = [];
    if (!pass) {
      if (dimensions.actionability < 0.50)
        reasons.push("La risposta non contiene azioni concrete o passi chiari.");
      if (dimensions.platitudeFree < 0.60)
        reasons.push("La risposta contiene frasi generiche o motivazionali vuote.");
      if (dimensions.lengthOk < 0.60) {
        const words = draft.trim().split(/\s+/).length;
        reasons.push(
          words < 60
            ? `Risposta troppo corta (${words} parole — minimo 60).`
            : `Risposta troppo lunga (${words} parole — massimo 380).`,
        );
      }
      if (dimensions.onTopic < 0.50)
        reasons.push("La risposta sembra non affrontare direttamente la domanda dell'utente.");
    }

    return { pass, score: roundedScore, dimensions, reasons, rewritten: false };
  }

  /**
   * Rewrites a failing draft using GPT-4o-mini.
   * Includes the failure reasons in the prompt so the model knows
   * exactly what to fix.
   */
  async rewrite(
    input: SupervisorEvalInput,
    failResult: SupervisorResult,
  ): Promise<string> {
    const { userMessage, draft, domain, intent } = input;

    const reasonsList = failResult.reasons.map((r) => `- ${r}`).join("\n");

    const systemPrompt = `
Sei un editor di qualità per un sistema di coaching AI.
Ricevi una risposta di bozza generata da uno specialista (dominio: ${domain}, intento: ${intent}) e devi migliorarla.

PROBLEMI IDENTIFICATI:
${reasonsList}

REGOLE DI RISCRITTURA:
1. Mantieni il contenuto corretto della bozza — non inventare fatti nuovi.
2. Aggiungi almeno UN'azione concreta con verbo imperativo e scadenza se mancante.
3. Rimuovi qualsiasi frase motivazionale generica (platitudini).
4. Lunghezza target: 80-250 parole.
5. Assicurati che la risposta risponda DIRETTAMENTE alla domanda dell'utente.
6. Mantieni la lingua della bozza (italiano).
7. Tono: diretto, specifico, rispettoso. Mai paternalistico.
    `.trim();

    const userPrompt = `DOMANDA UTENTE:\n${userMessage}\n\nBOZZA DA MIGLIORARE:\n${draft}`;

    try {
      const res = await openai.chat.completions.create({
        model:       "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt },
        ],
        temperature: 0.50,
        max_tokens:  700,
      });
      return res.choices[0]?.message?.content?.trim() ?? draft;
    } catch (err) {
      console.warn("[supervisor] rewrite failed, using original draft:", err);
      return draft;  // safe fallback: return original
    }
  }
}

// Singleton
export const supervisorAgent = new SupervisorAgent();
