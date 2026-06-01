/**
 * adapters.ts — trasformazioni PURE riga-DB → segnale/candidato per la Bussola.
 *
 * Nessun import di `@workspace/db` (niente pool): testabile senza DATABASE_URL.
 * Il wrapper IO `recompute.ts` fa le query e passa le righe qui.
 */
import type { ScoringSignal, CandidateCluster } from "@workspace/ai-server";

/** compass_signals (Specchio/Torneo/…): i dims sono già nel payload. */
export function signalsFromCompass(
  rows: { payload: Record<string, unknown> | null; weight: number; createdAt: Date }[],
): ScoringSignal[] {
  return rows.map((r) => ({
    weight: r.weight,
    createdAt: r.createdAt,
    dims: (r.payload?.dims as Record<string, number> | undefined) ?? null,
  }));
}

/**
 * simulated_days completati: un debrief con alta energia/interesse è un segnale
 * forte verso le dimensioni RIASEC di QUELLA professione.
 */
export function signalsFromSimulatedDays(
  rows: { debriefJson: unknown; completedAt: Date | null; riasecFit: string[] | null }[],
): ScoringSignal[] {
  const out: ScoringSignal[] = [];
  for (const r of rows) {
    if (!r.completedAt) continue;
    const radar = (r.debriefJson as { radar?: Record<string, number> } | null)?.radar;
    if (!radar) continue;
    const energy = ((radar.energy ?? 0) + (radar.interest ?? 0)) / 2; // 0..100
    const value = Math.max(0, Math.min(5, energy / 20));               // → 0..5
    const dims: Record<string, number> = {};
    for (const letter of r.riasecFit ?? []) dims[letter.charAt(0).toUpperCase()] = value;
    out.push({ weight: 1.5, createdAt: r.completedAt, dims }); // esperienziale → pesa di più
  }
  return out;
}

/** diary_entries(indizi): dims diretti dal prompt_payload, pesati per energia. */
export function signalsFromDiaryIndizi(
  rows: { promptPayload: unknown; createdAt: Date }[],
): ScoringSignal[] {
  const out: ScoringSignal[] = [];
  for (const r of rows) {
    const p = r.promptPayload as { dims?: Record<string, number>; energia?: number } | null;
    if (!p?.dims) continue;
    const w = 1 + Math.max(0, Math.min(1, (p.energia ?? 3) / 5)); // 1..2
    out.push({ weight: w, createdAt: r.createdAt, dims: p.dims });
  }
  return out;
}

/** professioni attive → cluster candidati per le ipotesi. */
export function candidatesFromProfessions(
  rows: { id: number; title: string; riasecFit: string[] | null }[],
): CandidateCluster[] {
  return rows.map((r) => ({
    clusterId: `profession:${r.id}`,
    label: r.title,
    riasec: r.riasecFit ?? [],
    source: "catalog",
  }));
}

/** riepilogo energia per la hub (contesti che danno energia ≥4). */
export function buildEnergyProfile(
  diaryRows: { promptPayload: unknown }[],
): Record<string, unknown> {
  const energizers: string[] = [];
  for (const r of diaryRows) {
    const p = r.promptPayload as { contesto?: string; energia?: number } | null;
    if (p?.contesto && (p.energia ?? 0) >= 4) energizers.push(p.contesto);
  }
  return { energizers: Array.from(new Set(energizers)) };
}
