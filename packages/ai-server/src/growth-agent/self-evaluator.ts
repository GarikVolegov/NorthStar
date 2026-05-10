/**
 * Self-Evaluator — the agent evaluates its own readiness to answer.
 *
 * WHAT IT DOES
 * ─────────────
 * Before generating the final response, this module asks:
 * "Do I have enough context to give a HIGH-QUALITY answer?"
 *
 * It scores 4 dimensions:
 *
 *  context_coverage  How well the retrieved RAG chunks cover the question.
 *                    Low = the KB has almost nothing relevant.
 *
 *  cot_confidence    Reuses the confidence field from the CoT result.
 *                    Low = CoT couldn't identify a clear problem pattern.
 *
 *  question_clarity  Is the user's message specific enough to answer well?
 *                    Low = too vague ("come sto?", "aiutami")
 *
 *  memory_coverage   Does the agent know enough about this user?
 *                    Low = first session, no biographical facts yet.
 *
 * COMPOSITE SCORE
 * ────────────────
 * weighted average:
 *   context_coverage  × 0.35
 *   cot_confidence    × 0.30
 *   question_clarity  × 0.25
 *   memory_coverage   × 0.10
 *
 * LEVELS
 * ───────
 *   >= 0.72  →  high    → respond normally
 *   >= 0.45  →  medium  → respond with hedged language
 *   <  0.45  →  low     → don't fake an answer — ask for clarification
 *
 * COST
 * ─────
 * context_coverage + question_clarity are computed locally (no API call).
 * The evaluator only calls the API if context_coverage is ambiguous.
 * In practice: ~0 extra cost for most messages.
 */
import type { RetrievedChunk } from "./retriever";
import type { CoTResult } from "./chain-of-thought";
import { openai } from "../client";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface EvalResult {
  score: number;           // 0-1 composite
  level: ConfidenceLevel;
  dimensions: {
    contextCoverage:  number;
    cotConfidence:    number;
    questionClarity:  number;
    memoryCoverage:   number;
  };
  reasons: string[];       // human-readable reasons for low/medium score
}

// ── Weights ────────────────────────────────────────────────────────────────
const W = {
  contextCoverage:  0.35,
  cotConfidence:    0.30,
  questionClarity:  0.25,
  memoryCoverage:   0.10,
};

// ── Local heuristics (no API call) ──────────────────────────────────────

/**
 * Scores how well the retrieved chunks cover the question.
 * Uses average similarity score of top chunks as proxy.
 */
function scoreContextCoverage(
  documentChunks: RetrievedChunk[],
  webResults: RetrievedChunk[],
): number {
  const all = [...documentChunks, ...webResults];
  if (all.length === 0) return 0.15; // nothing retrieved at all
  const avg = all.slice(0, 5).reduce((s, c) => s + c.score, 0) / Math.min(all.length, 5);
  // Map similarity score to coverage:
  // score >= 0.80 → 1.0 (very relevant)
  // score ~  0.50 → 0.4 (marginally relevant)
  // score <  0.35 → 0.1 (noise)
  if (avg >= 0.80) return 1.0;
  if (avg >= 0.65) return 0.75;
  if (avg >= 0.50) return 0.50;
  if (avg >= 0.35) return 0.30;
  return 0.10;
}

/**
 * Scores how clear and specific the user's message is.
 * Short/vague messages score low.
 */
function scoreQuestionClarity(message: string): number {
  const words = message.trim().split(/\s+/).length;
  const hasSpecificContent =
    message.length > 40 &&
    !/^(aiutami|non so|dimmi|ciao|hey|cosa faccio)[.!?]?$/i.test(message.trim());

  if (words >= 20 && hasSpecificContent) return 0.90;
  if (words >= 10 && hasSpecificContent) return 0.75;
  if (words >= 6)  return 0.55;
  if (words >= 3)  return 0.30;
  return 0.10; // 1-2 word messages
}

/**
 * Scores how much biographical context we have about this user.
 * More memory facts → higher score.
 */
function scoreMemoryCoverage(memoryFactCount: number): number {
  if (memoryFactCount >= 6) return 1.0;
  if (memoryFactCount >= 3) return 0.75;
  if (memoryFactCount >= 1) return 0.50;
  return 0.20; // new user, no memory yet
}

// ── Reason builder ─────────────────────────────────────────────────────────────

function buildReasons(
  dims: EvalResult["dimensions"],
  level: ConfidenceLevel,
): string[] {
  if (level === "high") return [];
  const reasons: string[] = [];
  if (dims.contextCoverage < 0.40)
    reasons.push("La knowledge base non contiene documenti rilevanti per questa domanda");
  if (dims.cotConfidence < 0.50)
    reasons.push("Il problema descritto è ambiguo o non abbastanza dettagliato");
  if (dims.questionClarity < 0.45)
    reasons.push("La domanda è troppo vaga per una risposta precisa");
  if (dims.memoryCoverage < 0.35)
    reasons.push("Non ho ancora abbastanza contesto biografico su di te");
  return reasons;
}

// ── MAIN EVALUATOR ──────────────────────────────────────────────────────────

export interface EvaluatorInput {
  userMessage: string;
  documentChunks: RetrievedChunk[];
  webResults: RetrievedChunk[];
  cot: CoTResult | null;
  memoryFactCount: number;
}

/**
 * Evaluates agent readiness. Purely local heuristics — no API call needed.
 * Runs in parallel with final prompt building (zero latency impact).
 */
export function evaluateSelf(input: EvaluatorInput): EvalResult {
  const {
    userMessage,
    documentChunks,
    webResults,
    cot,
    memoryFactCount,
  } = input;

  const dims: EvalResult["dimensions"] = {
    contextCoverage: scoreContextCoverage(documentChunks, webResults),
    cotConfidence:   cot?.confidence ?? 0.40,  // default low if CoT skipped
    questionClarity: scoreQuestionClarity(userMessage),
    memoryCoverage:  scoreMemoryCoverage(memoryFactCount),
  };

  const score =
    dims.contextCoverage  * W.contextCoverage  +
    dims.cotConfidence    * W.cotConfidence    +
    dims.questionClarity  * W.questionClarity  +
    dims.memoryCoverage   * W.memoryCoverage;

  const level: ConfidenceLevel =
    score >= 0.72 ? "high" :
    score >= 0.45 ? "medium" : "low";

  return {
    score: Math.round(score * 100) / 100,
    level,
    dimensions: dims,
    reasons: buildReasons(dims, level),
  };
}
