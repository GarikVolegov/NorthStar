/**
 * compass/tournament.ts — Il Torneo: logica PURA (nessun IO, nessun DB).
 *
 * L'indeciso costruisce per SOTTRAZIONE: sa dire "non questo" meglio di "questo".
 * Il Torneo mette le direzioni candidate in coppie e gli chiede solo "quale ti
 * tira di più?". Ogni scelta diventa un compass_signal(tournament_choice) i cui
 * `dims` sono derivati SERVER-side dal RIASEC dei due cluster (anti-gaming):
 * il vincitore spinge verso le sue lettere, il perdente spinge via dalle proprie.
 *
 * Event-sourced: lo standing provvisorio si ricostruisce sempre dallo stream di
 * scelte, quindi un torneo è ripartibile senza stato di bracket persistito.
 *
 * Vedi .planning/phases/indeciso-journey/fase-2-esperienza/PLAN.md
 */
import { RIASEC_DIMS } from "./scoring";
import type { CandidateCluster } from "./scoring";

/** Una scelta a coppie già espressa (ricostruita dai segnali). */
export interface TournamentChoice {
  winnerId: string; // clusterId vincitore ("profession:42")
  loserId: string;  // clusterId perdente
}

/** Standing provvisorio di un cluster nel torneo. */
export interface TournamentStanding {
  clusterId: string;
  label: string;
  wins: number;
  losses: number;
  comparisons: number;
  score: number; // wins - losses (trasparente, niente Elo opaco)
}

/** Numero di confronti-obiettivo per un pool dato (copertura senza sfinire). */
export function tournamentTarget(poolSize: number): number {
  if (poolSize < 2) return 0;
  return Math.ceil(poolSize * 1.5);
}

/**
 * Costruisce il pool che si sfida: prima i cluster delle ipotesi correnti (i più
 * rilevanti), poi riempe con altri candidati in ordine deterministico fino a
 * `size`. Deterministico ⇒ il pool è riproducibile senza persistere il bracket.
 */
export function selectTournamentPool(
  candidates: CandidateCluster[],
  hypothesisClusterIds: string[],
  size = 8,
): CandidateCluster[] {
  const byId = new Map(candidates.map((c) => [c.clusterId, c]));
  const pool: CandidateCluster[] = [];
  const used = new Set<string>();

  // 1) le ipotesi correnti, nell'ordine dato (già rankate per confidence)
  for (const id of hypothesisClusterIds) {
    const c = byId.get(id);
    if (c && !used.has(id)) { pool.push(c); used.add(id); }
    if (pool.length >= size) return pool;
  }

  // 2) riempi con i candidati che hanno un RIASEC definito, ordine stabile
  const fill = candidates
    .filter((c) => !used.has(c.clusterId) && c.riasec.length > 0)
    .sort((a, b) => a.clusterId.localeCompare(b.clusterId));
  for (const c of fill) {
    pool.push(c); used.add(c.clusterId);
    if (pool.length >= size) break;
  }
  return pool;
}

/** Ricostruisce gli standing dallo stream di scelte (solo cluster nel pool). */
export function rankByChoices(
  pool: CandidateCluster[],
  choices: TournamentChoice[],
): TournamentStanding[] {
  const inPool = new Set(pool.map((c) => c.clusterId));
  const wins = new Map<string, number>();
  const losses = new Map<string, number>();
  for (const ch of choices) {
    if (inPool.has(ch.winnerId)) wins.set(ch.winnerId, (wins.get(ch.winnerId) ?? 0) + 1);
    if (inPool.has(ch.loserId)) losses.set(ch.loserId, (losses.get(ch.loserId) ?? 0) + 1);
  }
  return pool
    .map((c) => {
      const w = wins.get(c.clusterId) ?? 0;
      const l = losses.get(c.clusterId) ?? 0;
      return { clusterId: c.clusterId, label: c.label, wins: w, losses: l, comparisons: w + l, score: w - l };
    })
    .sort((a, b) => (b.score - a.score) || a.clusterId.localeCompare(b.clusterId));
}

const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Prossima coppia da confrontare, adattiva e deterministica.
 * Tra le coppie NON ancora confrontate, preferisce quelle i cui membri sono stati
 * meno campionati (copertura) e più vicini di punteggio (massima informazione).
 * Ritorna null quando il torneo ha raggiunto il target o non restano coppie.
 */
export function nextTournamentPair(
  pool: CandidateCluster[],
  choices: TournamentChoice[],
  target = tournamentTarget(pool.length),
): [CandidateCluster, CandidateCluster] | null {
  if (pool.length < 2 || choices.length >= target) return null;

  const standings = rankByChoices(pool, choices);
  const scoreOf = new Map(standings.map((s) => [s.clusterId, s.score]));
  const compsOf = new Map(standings.map((s) => [s.clusterId, s.comparisons]));
  const seen = new Set(choices.map((c) => pairKey(c.winnerId, c.loserId)));

  let best: [CandidateCluster, CandidateCluster] | null = null;
  let bestRank: [number, number, string] | null = null; // [sampling, closeness, tiebreak]

  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i]!, b = pool[j]!;
      if (seen.has(pairKey(a.clusterId, b.clusterId))) continue;
      const sampling = (compsOf.get(a.clusterId) ?? 0) + (compsOf.get(b.clusterId) ?? 0);
      const closeness = Math.abs((scoreOf.get(a.clusterId) ?? 0) - (scoreOf.get(b.clusterId) ?? 0));
      const tiebreak = pairKey(a.clusterId, b.clusterId);
      const rank: [number, number, string] = [sampling, closeness, tiebreak];
      if (!bestRank || rank[0] < bestRank[0] ||
          (rank[0] === bestRank[0] && rank[1] < bestRank[1]) ||
          (rank[0] === bestRank[0] && rank[1] === bestRank[1] && rank[2] < bestRank[2])) {
        bestRank = rank;
        best = [a, b];
      }
    }
  }
  return best;
}

/**
 * Dims del segnale tournament_choice, derivati dal RIASEC dei due cluster.
 * Il vincitore spinge verso le sue lettere (+winnerValue); il perdente spinge
 * VIA dalle proprie (−loserValue·loserAversion) — così le scelte registrano sia
 * l'attrazione sia il rifiuto (la sottrazione è il cuore del Torneo).
 */
export function tournamentChoiceDims(
  winnerRiasec: string[],
  loserRiasec: string[],
  opts: { winnerValue?: number; loserAversion?: number } = {},
): Record<string, number> {
  const winnerValue = opts.winnerValue ?? 4;
  const loserAversion = opts.loserAversion ?? 0.5;
  const norm = (r: string): string => r.charAt(0).toUpperCase();
  const valid = (l: string): boolean => (RIASEC_DIMS as readonly string[]).includes(l);

  const dims: Record<string, number> = {};
  for (const r of winnerRiasec) {
    const l = norm(r);
    if (valid(l)) dims[l] = (dims[l] ?? 0) + winnerValue;
  }
  for (const r of loserRiasec) {
    const l = norm(r);
    if (valid(l)) dims[l] = (dims[l] ?? 0) - winnerValue * loserAversion;
  }
  return dims;
}
