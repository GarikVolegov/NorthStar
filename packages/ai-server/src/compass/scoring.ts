/**
 * compass/scoring.ts — cuore PURO della Bussola (nessun IO, nessun DB).
 *
 * Fonde il RIASEC dichiarato (test_sessions) con quello RIVELATO dal
 * comportamento (compass_signals + adapter su simulated_days/diary), deriva
 * ipotesi rankate e fa avanzare lo stage. Testabile in isolamento.
 *
 * Vedi .planning/phases/indeciso-journey/{OVERVIEW,AUDIT}.md
 */
import type { CompassHypothesis, CompassStage } from "@workspace/db";

export const RIASEC_DIMS = ["R", "I", "A", "S", "E", "C"] as const;
export type RiasecDim = typeof RIASEC_DIMS[number];
export type RiasecVector = Record<string, number>;

/** Segnale minimale richiesto dallo scoring (decoupled dalla row DB). */
export interface ScoringSignal {
  weight: number;
  createdAt: Date;
  dims?: Record<string, number> | null; // payload.dims
}

/** Cluster candidato (professione/settore) con il suo profilo RIASEC. */
export interface CandidateCluster {
  clusterId: string;     // "profession:42"
  label: string;         // "UX Designer"
  riasec: string[];      // ["A","I"]
  source?: string;       // "try_a_day" | "specchio" | "skill_bridge" | "test"
}

const DAY_MS = 24 * 60 * 60 * 1000;
// Soglia per dichiarare "è emersa un'ipotesi" (stage hypotheses). Bassa di
// proposito: hypotheses ≠ impegno; experimenting/committed sono spike-driven.
const CONFIDENCE_THRESHOLD = 0.5;

/** Decadimento esponenziale: un segnale di `halfLifeDays` fa pesa metà. */
export function recencyDecay(createdAt: Date, now: Date, halfLifeDays = 30): number {
  const ageDays = Math.max(0, (now.getTime() - createdAt.getTime()) / DAY_MS);
  return Math.pow(0.5, ageDays / halfLifeDays);
}

/**
 * RIASEC rivelato: media pesata (weight × recency) dei `dims` dei segnali,
 * per-dimensione. Output su scala ~1..5 coerente col RIASEC del test.
 */
export function weightedRiasec(signals: ScoringSignal[], now: Date = new Date()): RiasecVector {
  const sum: Record<string, number> = {};
  const totW: Record<string, number> = {};
  for (const s of signals) {
    if (!s.dims) continue;
    const w = Math.max(0, s.weight) * recencyDecay(s.createdAt, now);
    for (const dim of RIASEC_DIMS) {
      const v = s.dims[dim];
      if (typeof v !== "number") continue;
      sum[dim] = (sum[dim] ?? 0) + v * w;
      totW[dim] = (totW[dim] ?? 0) + w;
    }
  }
  const out: RiasecVector = {};
  for (const dim of RIASEC_DIMS) out[dim] = totW[dim] ? sum[dim]! / totW[dim]! : 0;
  return out;
}

/**
 * Fonde dichiarato + rivelato. Il peso del comportamento cresce col numero di
 * segnali (max 70%): più l'utente agisce, più ci fidiamo di ciò che FA.
 */
export function blendRiasec(
  declared: RiasecVector,
  revealed: RiasecVector,
  signalCount: number,
): RiasecVector {
  const w = Math.min(0.7, Math.max(0, signalCount) / 50);
  const out: RiasecVector = {};
  for (const dim of RIASEC_DIMS) {
    out[dim] = (declared[dim] ?? 0) * (1 - w) + (revealed[dim] ?? 0) * w;
  }
  return out;
}

/** Allineamento 0..1 di un cluster col vettore RIASEC fuso. */
export function clusterFit(blended: RiasecVector, riasec: string[]): number {
  const letters = riasec.map((r) => r.charAt(0).toUpperCase()).filter((l) => RIASEC_DIMS.includes(l as RiasecDim));
  if (!letters.length) return 0;
  const avg = letters.reduce((acc, l) => acc + (blended[l] ?? 0), 0) / letters.length;
  return Math.max(0, Math.min(1, avg / 5)); // scala 0..5 → 0..1
}

/**
 * Deriva ipotesi rankate. Mantiene `testedAt`/`verdict` di ipotesi pre-esistenti
 * (merge per clusterId), così uno spike "scartato" non riemerge come nuovo.
 */
export function deriveHypotheses(
  blended: RiasecVector,
  candidates: CandidateCluster[],
  previous: CompassHypothesis[] = [],
  topK = 5,
): CompassHypothesis[] {
  const prevById = new Map(previous.map((h) => [h.clusterId, h]));
  const scored = candidates.map((c) => {
    const prev = prevById.get(c.clusterId);
    const confidence = Math.round(clusterFit(blended, c.riasec) * 100) / 100;
    const source = Array.from(new Set([...(prev?.source ?? []), c.source].filter(Boolean) as string[]));
    return {
      clusterId: c.clusterId,
      label: c.label,
      confidence,
      source,
      testedAt: prev?.testedAt ?? null,
      verdict: prev?.verdict ?? "open",
    } satisfies CompassHypothesis;
  });
  // le ipotesi scartate restano in coda ma non spariscono (storia utile)
  return scored
    .sort((a, b) => {
      if (a.verdict === "discarded" && b.verdict !== "discarded") return 1;
      if (b.verdict === "discarded" && a.verdict !== "discarded") return -1;
      return b.confidence - a.confidence;
    })
    .slice(0, topK);
}

/**
 * Avanza lo stage. NON regredisce da experimenting/committed (quelli sono
 * guidati dagli spike, non dal ricalcolo dei segnali).
 */
export function nextStage(current: CompassStage, hypotheses: CompassHypothesis[]): CompassStage {
  if (current === "experimenting" || current === "committed") return current;
  const strong = hypotheses.filter((h) => h.verdict !== "discarded" && h.confidence >= CONFIDENCE_THRESHOLD);
  return strong.length >= 1 ? "hypotheses" : "zero_ideas";
}

/** Confidenza direzionale globale 0..1 = migliore ipotesi non scartata. */
export function directionConfidence(hypotheses: CompassHypothesis[]): number {
  const open = hypotheses.filter((h) => h.verdict !== "discarded");
  return open.length ? Math.max(...open.map((h) => h.confidence)) : 0;
}
