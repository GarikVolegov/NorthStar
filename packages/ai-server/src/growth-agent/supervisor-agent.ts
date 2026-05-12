/**
 * SupervisorAgent v2 — quality gate + self-improvement logging.
 *
 * WHAT'S NEW (v2)
 * ───────────────
 * When a rewrite is triggered (pass === false), the full context is logged
 * to the `supervisor_logs` table:
 *   { userId, sessionId, domain, intent, userMessage, draft, finalText,
 *     scoreBefore, reasons }
 *
 * This data feeds the weekly analysis job (supervisor-pattern-analyzer.ts)
 * which proposes new PLATITUDE_PATTERNS / ACTION_PATTERNS to add.
 *
 * Logging is fire-and-forget (à la void) — never blocks the response stream.
 * If DB is unavailable, the insert is silently skipped.
 *
 * EVALUATION DIMENSIONS (v3 — dynamic weights per intent)
 * ───────────────────────────────────────────
 *  Weights vary by Intent (plan/vent/reflect/etc).
 *  Short messages (<8 words) halve onTopic component.
 *  onTopic returns 0.85 when Jaccard has <3 user tokens (short msgs).
 *  pass threshold: >= 0.70
 */
import { getLLM } from "../llm/client";
import { db } from "../db/client";
import { supervisorLogs } from "../db/schema";
import type { Domain, Intent } from "./router-agent";
import { logger, type LoggerFields } from "../logger";
import { recordSupervisorRewrite } from "../metrics";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SupervisorDimensions {
  actionability: number;
  platitudeFree: number;
  lengthOk:      number;
  onTopic:       number;
}

export interface SupervisorResult {
  pass:       boolean;
  score:      number;
  dimensions: SupervisorDimensions;
  reasons:    string[];
  rewritten:  boolean;
}

export interface SupervisorEvalInput {
  userMessage: string;
  draft:       string;
  domain:      Domain;
  intent:      Intent;
  // v2: optional context for logging
  userId?:     string;
  sessionId?:  number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PASS_THRESHOLD = 0.70;
const WEIGHTS_FALLBACK = {
  actionability: 0.35, platitudeFree: 0.25, lengthOk: 0.20, onTopic: 0.20,
};

interface SupervisorWeights {
  actionability: number;
  platitudeFree: number;
  lengthOk: number;
  onTopic: number;
}

const WEIGHTS_BY_INTENT: Record<string, SupervisorWeights> = {
  plan:          { actionability: 0.45, platitudeFree: 0.25, lengthOk: 0.15, onTopic: 0.15 },
  problem_solve: { actionability: 0.40, platitudeFree: 0.25, lengthOk: 0.20, onTopic: 0.15 },
  explore:       { actionability: 0.20, platitudeFree: 0.30, lengthOk: 0.25, onTopic: 0.25 },
  reflect:       { actionability: 0.05, platitudeFree: 0.35, lengthOk: 0.30, onTopic: 0.30 },
  vent:          { actionability: 0.00, platitudeFree: 0.40, lengthOk: 0.30, onTopic: 0.30 },
  ask_info:      { actionability: 0.10, platitudeFree: 0.20, lengthOk: 0.25, onTopic: 0.45 },
};

// Learned from DB + hard-coded initial set.
// The weekly job (supervisor-pattern-analyzer.ts) proposes additions here.
const PLATITUDE_PATTERNS = [
  /credi in te stesso/i,
  /tutto \u00e8 possibile/i,
  /non mollare mai/i,
  /il successo arriva/i,
  /step by step/i,
  /un passo alla volta/i,
  /sei sulla strada giusta/i,
  /hai tutto ci\u00f2 che serve/i,
  /ce la farai/i,
  /il viaggio \u00e8 lungo/i,
  /ricorda che puoi farcela/i,
  /ogni giorno \u00e8 un nuovo inizio/i,
  /il cambiamento inizia da dentro/i,
];

const ACTION_PATTERNS = [
  /\b(fai|scrivi|contatta|invia|apri|crea|prepara|definisci|identifica|misura|testa|inizia|completa|leggi|studia|pratica)\b/i,
  /entro\s+(domani|questa settimana|luned\u00ec|venerd\u00ec|\d+ giorni)/i,
  /passo\s+\d+/i,
  /\d+\.\s/,
  /- \[\s*\]/,
];

// ── Dimension scorers (local, ~0ms) ────────────────────────────────────────

function scoreActionability(draft: string): number {
  const matches = ACTION_PATTERNS.filter((p) => p.test(draft)).length;
  if (matches >= 3) return 1.0;
  if (matches === 2) return 0.80;
  if (matches === 1) return 0.50;
  return 0.10;
}

function scorePlatitudeFree(draft: string): number {
  const hits = PLATITUDE_PATTERNS.filter((p) => p.test(draft)).length;
  if (hits === 0) return 1.0;
  if (hits === 1) return 0.60;
  if (hits === 2) return 0.30;
  return 0.0;
}

function scoreLengthOk(draft: string): number {
  const words = draft.trim().split(/\s+/).length;
  if (words >= 80 && words <= 280) return 1.0;
  if (words >= 60 && words <= 380) return 0.75;
  if (words < 60)                   return 0.30;
  return 0.50;
}

function scoreOnTopic(userMessage: string, draft: string): number {
  const STOP = new Set(["il","la","lo","le","i","gli","un","una","uno","e","o","ma","che","di","a","in","con","su","per","tra","fra","da","del","della","dei","degli","delle","al","alla","ai","agli","alle","mi","ti","si","ci","vi","ho","hai","ha","sono","sei","\u00e8","siamo","siete","non","come","cosa","perch\u00e9","quando"]);
  const tokenize = (s: string) =>
    new Set(s.toLowerCase().match(/[a-z\u00e0-\u00fc]{4,}/g)?.filter((w) => !STOP.has(w)) ?? []);
  const uTokens = tokenize(userMessage);
  const dTokens = tokenize(draft);
  if (uTokens.size < 3) return 0.85;
  const intersection = [...uTokens].filter((w) => dTokens.has(w)).length;
  const jaccard = intersection / (uTokens.size + dTokens.size - intersection);
  if (jaccard >= 0.12) return 1.0;
  if (jaccard >= 0.07) return 0.75;
  if (jaccard >= 0.04) return 0.50;
  return 0.20;
}

// ── SupervisorAgent ──────────────────────────────────────────────────────────────────

export class SupervisorAgent {
  /** Pure heuristic evaluation. ~0ms, zero API calls. */
  evaluate(input: SupervisorEvalInput): SupervisorResult {
    const { userMessage, draft } = input;
    const dimensions: SupervisorDimensions = {
      actionability: scoreActionability(draft),
      platitudeFree: scorePlatitudeFree(draft),
      lengthOk:      scoreLengthOk(draft),
      onTopic:       scoreOnTopic(userMessage, draft),
    };
    const weights = WEIGHTS_BY_INTENT[input.intent] ?? WEIGHTS_FALLBACK;
    let { onTopic: onTopicWeight } = weights;

    const words = input.userMessage.trim().split(/\s+/).length;
    if (words < 8) {
      onTopicWeight *= 0.5;
    }

    const score = Math.round((
      dimensions.actionability * weights.actionability +
      dimensions.platitudeFree * weights.platitudeFree +
      dimensions.lengthOk      * weights.lengthOk      +
      dimensions.onTopic       * onTopicWeight
    ) * 100) / 100;
    const pass = score >= PASS_THRESHOLD;
    const reasons: string[] = [];
    if (!pass) {
      if (dimensions.actionability < 0.50)
        reasons.push("La risposta non contiene azioni concrete o passi chiari.");
      if (dimensions.platitudeFree < 0.60)
        reasons.push("La risposta contiene frasi generiche o motivazionali vuote.");
      if (dimensions.lengthOk < 0.60) {
        const words = draft.trim().split(/\s+/).length;
        reasons.push(words < 60
          ? `Risposta troppo corta (${words} parole — minimo 60).`
          : `Risposta troppo lunga (${words} parole — massimo 380).`);
      }
      if (dimensions.onTopic < 0.50)
        reasons.push("La risposta sembra non affrontare direttamente la domanda dell'utente.");
    }
    return { pass, score, dimensions, reasons, rewritten: false };
  }

  /**
   * Rewrites a failing draft via GPT-4o-mini.
   * After rewrite, logs the full context to supervisor_logs (fire-and-forget).
   */
  async rewrite(
    input: SupervisorEvalInput,
    failResult: SupervisorResult,
    finalText?: string,
  ): Promise<string> {
    const { userMessage, draft, domain, intent, userId, sessionId } = input;
    const reasonsList = failResult.reasons.map((r) => `- ${r}`).join("\n");

    const systemPrompt = `
Sei un editor di qualit\u00e0 per un sistema di coaching AI.
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
7. Tono: diretto, specifico, rispettoso. Mai paternalistico.`.trim();

    let rewritten = draft; // safe fallback
    try {
      rewritten = await getLLM().chatOnce(
        [
          { role: "system", content: systemPrompt },
          { role: "user",   content: `DOMANDA UTENTE:\n${userMessage}\n\nBOZZA:\n${draft}` },
        ],
        { model: "gpt-4o-mini", temperature: 0.50, maxTokens: 700 },
      );
    } catch (err) {
      logger.warn({ err, domain, intent }, "rewrite failed — using original draft");
    }

    // ── Re-evaluate post-rewrite ─────────────────────────────────────
    const rewrittenResult = this.evaluate({ ...input, draft: rewritten });
    const degraded = rewrittenResult.score < failResult.score;
    const logFields: LoggerFields = { userId, sessionId, domain, intent, supervisorScore: rewrittenResult.score };
    if (degraded) {
      logger.warn(
        { ...logFields, originalScore: failResult.score, rewriteScore: rewrittenResult.score },
        "rewrite degraded quality — keeping original",
      );
    }

    recordSupervisorRewrite(domain);

    // ── Fire-and-forget DB log ───────────────────────────────────────
    if (db) {
      db.insert(supervisorLogs).values({
        userId:      userId ?? null,
        sessionId:   sessionId ?? null,
        domain,
        intent,
        userMessage,
        draft,
        finalText:   finalText ?? rewritten,
        scoreBefore: failResult.score,
        scoreAfter:  rewrittenResult.score,
        reasons:     JSON.stringify(failResult.reasons),
      }).catch((err: unknown) => {
        logger.warn({ err, ...logFields }, "supervisor DB log failed");
      });
    }

    logger.info({ ...logFields, originalScore: failResult.score, degraded }, "supervisor rewrite completed");

    return degraded ? draft : rewritten;
  }
}

export const supervisorAgent = new SupervisorAgent();
