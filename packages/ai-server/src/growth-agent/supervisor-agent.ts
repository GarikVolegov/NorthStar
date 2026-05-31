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
import { selectModelFor } from "../model-router";
import { withTimeout } from "../utils";
import { wendyConfig } from "../config/wendy";
import { embedText } from "./embedder";

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
  userId?:     string | undefined;
  sessionId?:  number | undefined;
}

// ── Constants (now sourced from wendyConfig) ────────────────────────────────────

const PASS_THRESHOLD   = wendyConfig.supervisor.passThreshold;
const WEIGHTS_FALLBACK = wendyConfig.supervisor.weightsFallback;
const WEIGHTS_BY_INTENT = wendyConfig.supervisor.intentWeights;

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

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,}\d{3,4}/g;
const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/gi;
const ITALIAN_FISCAL_CODE_RE = /\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/gi;

function redactSupervisorLogText(text: string): string {
  return text
    .replace(EMAIL_RE, "[redacted-email]")
    .replace(PHONE_RE, "[redacted-phone]")
    .replace(IBAN_RE, "[redacted-iban]")
    .replace(ITALIAN_FISCAL_CODE_RE, "[redacted-fiscal-code]")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Dimension scorers (local, ~0ms) ────────────────────────────────────────

function scoreActionability(draft: string): number {
  const matches = ACTION_PATTERNS.filter((p) => p.test(draft)).length;
  const brackets = wendyConfig.supervisor.actionScoreBrackets;
  for (const b of brackets) {
    if (matches >= b.minMatches) return b.score;
  }
  return 0.10;
}

function scorePlatitudeFree(draft: string): number {
  const hits = PLATITUDE_PATTERNS.filter((p) => p.test(draft)).length;
  const brackets = wendyConfig.supervisor.platitudeScoreBrackets;
  for (const b of brackets) {
    if (hits <= b.maxHits) return b.score;
  }
  return 0.0;
}

function scoreLengthOk(draft: string): number {
  const words = draft.trim().split(/\s+/).length;
  for (const b of wendyConfig.supervisor.lengthBrackets) {
    if (words >= b.min && words <= b.max) return b.score;
  }
  return 0.50;
}

function scoreOnTopicByJaccard(userMessage: string, draft: string): number {
  const STOP = new Set(["il","la","lo","le","i","gli","un","una","uno","e","o","ma","che","di","a","in","con","su","per","tra","fra","da","del","della","dei","degli","delle","al","alla","ai","agli","alle","mi","ti","si","ci","vi","ho","hai","ha","sono","sei","\u00e8","siamo","siete","non","come","cosa","perch\u00e9","quando"]);
  const tokenize = (s: string) =>
    new Set(s.toLowerCase().match(/[a-z\u00e0-\u00fc]{4,}/g)?.filter((w) => !STOP.has(w)) ?? []);
  const uTokens = tokenize(userMessage);
  const dTokens = tokenize(draft);
  const jt = wendyConfig.supervisor.jaccardThresholds;
  if (uTokens.size < 3) return wendyConfig.supervisor.shortTokenOnTopicScore;
  const intersection = [...uTokens].filter((w) => dTokens.has(w)).length;
  const jaccard = intersection / (uTokens.size + dTokens.size - intersection);
  if (jaccard >= jt.high) return 1.0;
  if (jaccard >= jt.mid)  return 0.75;
  if (jaccard >= jt.low)  return 0.50;
  return 0.20;
}

function cosine(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function scoreOnTopicByCosine(similarity: number): number {
  if (similarity >= 0.75) return 1.0;
  if (similarity >= 0.60) return 0.75;
  if (similarity >= 0.45) return 0.50;
  return 0.20;
}

async function scoreOnTopic(userMessage: string, draft: string): Promise<number> {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return scoreOnTopicByJaccard(userMessage, draft);
  }
  try {
    const [userEmb, draftEmb] = await Promise.all([
      embedText(userMessage),
      embedText(draft.slice(0, 500)),
    ]);
    return scoreOnTopicByCosine(cosine(userEmb, draftEmb));
  } catch (err) {
    logger.warn({ err }, "supervisor embedding topic check failed, falling back to token overlap");
    return scoreOnTopicByJaccard(userMessage, draft);
  }
}

// ── SupervisorAgent ──────────────────────────────────────────────────────────────────

export class SupervisorAgent {
  /** Heuristic evaluation with semantic on-topic check. */
  async evaluate(input: SupervisorEvalInput): Promise<SupervisorResult> {
    const { userMessage, draft } = input;
    const dimensions: SupervisorDimensions = {
      actionability: scoreActionability(draft),
      platitudeFree: scorePlatitudeFree(draft),
      lengthOk:      scoreLengthOk(draft),
      onTopic:       await scoreOnTopic(userMessage, draft),
    };
    const weights = WEIGHTS_BY_INTENT[input.intent] ?? WEIGHTS_FALLBACK;
    let { onTopic: onTopicWeight } = weights;

    const words = input.userMessage.trim().split(/\s+/).length;
    if (words < wendyConfig.supervisor.shortMessageWords) {
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
      const route = selectModelFor("supervisor-rewrite");
      rewritten = await getLLM().chatOnce(
        [
          { role: "system", content: systemPrompt },
          { role: "user",   content: `DOMANDA UTENTE:\n${userMessage}\n\nBOZZA:\n${draft}` },
        ],
        { model: route.model, temperature: route.temperature, maxTokens: route.maxTokens },
      );
    } catch (err) {
      logger.warn({ err, domain, intent }, "rewrite failed — using original draft");
    }

    // ── Re-evaluate post-rewrite ─────────────────────────────────────
    const rewrittenResult = await this.evaluate({ ...input, draft: rewritten });
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
      const logPromise = db.insert(supervisorLogs).values({
        userId:      userId ?? null,
        sessionId:   sessionId ?? null,
        domain,
        intent,
        userMessage: redactSupervisorLogText(userMessage),
        draft:       redactSupervisorLogText(draft),
        finalText:   redactSupervisorLogText(finalText ?? rewritten),
        scoreBefore: failResult.score,
        scoreAfter:  rewrittenResult.score,
        reasons:     JSON.stringify(failResult.reasons),
      });
      withTimeout(logPromise, wendyConfig.supervisor.logTimeoutMs, "supervisor DB log").catch((err: unknown) => {
        logger.warn({ err, ...logFields }, "supervisor DB log failed/timed out");
      });
    }

    logger.info({ ...logFields, originalScore: failResult.score, degraded }, "supervisor rewrite completed");

    return degraded ? draft : rewritten;
  }
}

export const supervisorAgent = new SupervisorAgent();
