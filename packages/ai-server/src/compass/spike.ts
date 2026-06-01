/**
 * compass/spike.ts — Career Spike: logica PURA (nessun IO, nessun DB).
 *
 * Trasforma un'ipotesi in un micro-esperimento REVERSIBILE (≤2 settimane) con un
 * kill-criterion deciso PRIMA, e mappa l'esito su una transizione di stage della
 * Bussola. Un `kill` non è un fallimento: è un "no informato" → progresso.
 *
 * Vedi .planning/phases/indeciso-journey/fase-4-commit/PLAN.md
 */

export interface SpikeSuggestion {
  action: string;
  killCriterion: string;
}

/** Decisione presa alla review dello spike. */
export type SpikeDecision = "continue" | "kill";

export interface SpikeResolution {
  status: "completed_continue" | "completed_kill";
  /** stage risultante della Bussola dopo l'esito. */
  stage: "experimenting" | "committed" | "hypotheses";
  /** verdetto da scrivere sull'ipotesi testata. */
  verdict: "confirmed" | "discarded";
  /** segno del segnale spike_outcome (verso/via dalle dimensioni dell'ipotesi). */
  signalValence: number; // -1..1
  /** peso esperienziale: un esito vissuto pesa molto più di uno swipe. */
  signalWeight: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Soglia di energia per promuovere "continue" a `committed`. */
export const COMMIT_ENERGY_THRESHOLD = 0.4;
const DEFAULT_KILL =
  "Se dopo la prima sessione ti annoia più di quanto ti incuriosisce, fermati: è un no informato, non un fallimento.";

/** Data di review di default: start + N giorni (default 14). */
export function spikeReviewDate(start: Date, days = 14): Date {
  return new Date(start.getTime() + days * DAY_MS);
}

/**
 * Propone 1–3 micro-esperimenti PICCOLI e verificabili per un'ipotesi, con un
 * kill-criterion non vuoto. Deterministico: niente azioni grandi ("iscriviti a
 * una laurea"), solo bet da poche ore / 2 settimane.
 */
export function proposeSpike(
  hypothesisLabel: string,
  opts: { firstSkill?: string | undefined; killCriterion?: string | undefined } = {},
): SpikeSuggestion[] {
  const label = hypothesisLabel.trim() || "questa direzione";
  const kill = (opts.killCriterion?.trim() || DEFAULT_KILL);
  const suggestions: SpikeSuggestion[] = [
    { action: `Completa il primo modulo di un corso introduttivo su "${label}" (max ~3 ore).`, killCriterion: kill },
    { action: `Intervista 1 persona che fa "${label}": 20 minuti, 3 domande sulla giornata-tipo reale.`, killCriterion: kill },
  ];
  if (opts.firstSkill?.trim()) {
    suggestions.push({
      action: `Prova la competenza-ponte "${opts.firstSkill.trim()}" con un micro-progetto di ~2 ore.`,
      killCriterion: kill,
    });
  }
  return suggestions;
}

/**
 * Mappa l'esito della review su una transizione di stage.
 * - continue + energia alta → `committed` (l'ipotesi ha retto alla prova).
 * - continue + energia bassa → resta `experimenting` (continua a testare).
 * - kill → `hypotheses`, ipotesi marcata `discarded` (testata e scartata: dato).
 */
export function resolveSpikeOutcome(decision: SpikeDecision, energy: number): SpikeResolution {
  const e = Math.max(-1, Math.min(1, Number.isFinite(energy) ? energy : 0));
  if (decision === "kill") {
    return { status: "completed_kill", stage: "hypotheses", verdict: "discarded", signalValence: -1, signalWeight: 3 };
  }
  const committed = e >= COMMIT_ENERGY_THRESHOLD;
  return {
    status: "completed_continue",
    stage: committed ? "committed" : "experimenting",
    verdict: "confirmed",
    signalValence: Math.max(0.2, e),
    signalWeight: 3,
  };
}

/** Dims del segnale spike_outcome: il RIASEC dell'ipotesi scalato dalla valence. */
export function spikeOutcomeDims(
  hypothesisRiasec: string[],
  signalValence: number,
  baseValue = 4,
): Record<string, number> {
  const dims: Record<string, number> = {};
  for (const r of hypothesisRiasec) {
    const l = r.charAt(0).toUpperCase();
    dims[l] = (dims[l] ?? 0) + baseValue * signalValence;
  }
  return dims;
}
