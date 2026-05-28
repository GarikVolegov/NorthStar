/**
 * chronotype-detector.ts — Inferisce il cronotype dell'utente dai pattern di utilizzo
 *
 * Cronotype: tendenza individuale a preferire attività nelle diverse fasce orarie.
 * - morning      (mattutino): picco cognitivo 6-12
 * - intermediate (intermedio): picco 10-16
 * - evening      (serale):    picco 17-23
 *
 * Fonte scientifica:
 * - Roenneberg et al. (2007): "Epidemiology of the human circadian clock"
 * - Hut et al. (2013): "Latitudinal clines of circadian clock gene"
 * Distribuzione tipica: ~25% mattutini, ~50% intermedi, ~25% serali.
 *
 * Metodo: conta richieste Wendy per fascia oraria (locale dell'utente),
 * normalizza sul totale e identifica la fascia dominante.
 *
 * Confidence: basata sul numero di sessioni analizzate.
 * - < 5 sessioni: confidence 0 (cronotype non dichiarato)
 * - 5-20 sessioni: confidence 0.3-0.6
 * - > 30 sessioni: confidence max 0.85
 *
 * Privacy: opera su aggregati di timestamp, nessun PII.
 * Richiede consent "chronotype" attivo.
 */

import { db, aiRequestLogTable } from "@workspace/db";
import { sql } from "drizzle-orm";

export type Chronotype = "morning" | "intermediate" | "evening";

export interface ChronotypeResult {
  chronotype: Chronotype;
  /** Confidence 0-1 */
  confidence: number;
  /** Distribuzione percentuale (0-1) per fascia: morning, daytime, evening */
  distribution: {
    morning: number;   // 6-11
    daytime: number;   // 12-17
    evening: number;   // 18-23
    night: number;     // 0-5
  };
  /** Ora di picco (0-23) */
  peakHour: number;
  /** Numero di sessioni analizzate */
  sessionsAnalyzed: number;
}

/**
 * Rileva il cronotype di un utente analizzando le ultime N settimane
 * di richieste Wendy (ai_request_log).
 *
 * @param userId - ID utente
 * @param timezone - Timezone IANA dell'utente (default "Europe/Rome")
 * @param weeksBack - Quante settimane di storia analizzare (default 8)
 */
export async function detectChronotype(
  userId: number,
  timezone = "Europe/Rome",
  weeksBack = 8,
): Promise<ChronotypeResult> {
  const since = new Date();
  since.setDate(since.getDate() - weeksBack * 7);

  // Estrae solo l'ora locale per ogni richiesta
  // Usa AT TIME ZONE di PostgreSQL per convertire direttamente nel fuso dell'utente
  const rows = await db
    .select({
      localHour: sql<number>`EXTRACT(HOUR FROM ${aiRequestLogTable.createdAt} AT TIME ZONE ${timezone})`,
    })
    .from(aiRequestLogTable)
    .where(
      sql`${aiRequestLogTable.userId} = ${userId}
        AND ${aiRequestLogTable.createdAt} >= ${since.toISOString()}
        AND ${aiRequestLogTable.intent} != 'navigation'`,
    ) as { localHour: number }[];

  const sessionsAnalyzed = rows.length;

  if (sessionsAnalyzed < 5) {
    return {
      chronotype: "intermediate",
      confidence: 0,
      distribution: { morning: 0, daytime: 0, evening: 0, night: 0 },
      peakHour: 12,
      sessionsAnalyzed,
    };
  }

  // Conta per fascia oraria
  const hourCounts = new Array(24).fill(0) as number[];
  for (const row of rows) {
    const h = Math.floor(Number(row.localHour));
    if (h >= 0 && h < 24) {
      hourCounts[h] = (hourCounts[h] ?? 0) + 1;
    }
  }

  // Aggrega per fascia
  const morning = hourCounts.slice(6, 12).reduce((a, b) => a + b, 0);  // 6-11
  const daytime = hourCounts.slice(12, 18).reduce((a, b) => a + b, 0); // 12-17
  const evening = hourCounts.slice(18, 24).reduce((a, b) => a + b, 0); // 18-23
  const night   = [...hourCounts.slice(0, 6)].reduce((a, b) => a + b, 0); // 0-5

  const total = sessionsAnalyzed || 1;
  const distribution = {
    morning: Math.round((morning / total) * 1000) / 1000,
    daytime: Math.round((daytime / total) * 1000) / 1000,
    evening: Math.round((evening / total) * 1000) / 1000,
    night: Math.round((night / total) * 1000) / 1000,
  };

  // Ora di picco (0-23)
  let peakHour = 0;
  let maxCount = 0;
  for (let h = 0; h < 24; h++) {
    if ((hourCounts[h] ?? 0) > maxCount) {
      maxCount = hourCounts[h] ?? 0;
      peakHour = h;
    }
  }

  // Determina cronotype:
  // La fascia dominante (morning vs daytime+evening) determina il tipo
  // morning: > 40% utilizzo 6-11
  // evening: > 40% utilizzo 18-23 O peak dopo le 19
  // intermediate: tutto il resto
  let chronotype: Chronotype;
  if (distribution.morning > 0.4 && distribution.morning > distribution.evening) {
    chronotype = "morning";
  } else if (distribution.evening > 0.4 || peakHour >= 19) {
    chronotype = "evening";
  } else {
    chronotype = "intermediate";
  }

  // Confidence basata su sessioni (aumenta con più dati)
  // 5 → 0.25, 15 → 0.5, 30+ → 0.85
  const confidence = Math.min(0.85, Math.round((sessionsAnalyzed / 30) * 0.85 * 100) / 100);

  return {
    chronotype,
    confidence,
    distribution,
    peakHour,
    sessionsAnalyzed,
  };
}

/**
 * Ore di picco per fascia oraria — utile per Wendy nel suggerire
 * il momento ottimale per tasks cognitivamente impegnativi.
 */
export const CHRONOTYPE_PEAK_HOURS: Record<Chronotype, { start: number; end: number; label: string }> = {
  morning:      { start: 7,  end: 11, label: "Mattina presto (7-11)" },
  intermediate: { start: 10, end: 14, label: "Mattina tarda / primo pomeriggio (10-14)" },
  evening:      { start: 18, end: 22, label: "Sera (18-22)" },
};
