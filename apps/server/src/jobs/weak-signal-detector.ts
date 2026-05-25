/**
 * weak-signal-detector.ts — rileva professioni/skill emergenti dai job posting.
 *
 * Logica:
 *   1. Legge job_posting_snapshots degli ultimi 2 periodi (mese corrente vs precedente)
 *   2. Per ogni role_title: calcola growthRate = (count_new - count_old) / count_old
 *   3. Se growthRate > threshold E count > minCount → crea/aggiorna weak_signal
 *   4. Ricalcola strength per tutti i segnali esistenti
 *   5. Aggiorna status (emerging → confirmed se strength > 0.6 + count > 50)
 *
 * Frequency: settimanale (configurabile via WEAK_SIGNAL_INTERVAL_D env)
 * Privacy: opera su aggregati anonimi, nessun PII
 */
import { db, weakSignalsTable, jobPostingSnapshotsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { rootLogger } from "../middleware/logger";

const log = rootLogger.child({ module: "weak-signal-detector" });

const GROWTH_THRESHOLD = parseFloat(process.env.WEAK_SIGNAL_GROWTH_THRESHOLD || "1.5"); // 150% crescita
const MIN_COUNT        = parseInt(process.env.WEAK_SIGNAL_MIN_COUNT || "30");
const CONFIRM_STRENGTH = parseFloat(process.env.WEAK_SIGNAL_CONFIRM_STRENGTH || "0.60");
const CONFIRM_COUNT    = parseInt(process.env.WEAK_SIGNAL_CONFIRM_COUNT || "50");

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function prevPeriod(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function threeMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface SnapshotRow {
  roleTitle:  string;
  period:     string;
  count:      number;
  geography:  string;
  topSkills:  string[];
}

export async function runWeakSignalDetector(): Promise<{
  signalsCreated:  number;
  signalsUpdated:  number;
  signalsConfirmed: number;
  durationMs:      number;
}> {
  const t0      = Date.now();
  let created   = 0;
  let updated   = 0;
  let confirmed = 0;

  log.info("[weak-signal] detector starting");

  try {
    const cur  = currentPeriod();
    const prev = prevPeriod();

    // Recupera snapshot degli ultimi 2 mesi
    const rows = await db
      .select({
        roleTitle: jobPostingSnapshotsTable.roleTitle,
        period:    jobPostingSnapshotsTable.period,
        count:     jobPostingSnapshotsTable.count,
        geography: jobPostingSnapshotsTable.geography,
        topSkills: jobPostingSnapshotsTable.topSkills,
      })
      .from(jobPostingSnapshotsTable)
      .where(
        sql`${jobPostingSnapshotsTable.period} IN (${cur}, ${prev})`,
      )
      .orderBy(desc(jobPostingSnapshotsTable.count));

    // Raggruppa per (roleTitle, geography)
    const byRole = new Map<string, { cur?: SnapshotRow; prev?: SnapshotRow }>();

    for (const row of rows) {
      const key = `${row.roleTitle}||${row.geography}`;
      if (!byRole.has(key)) byRole.set(key, {});
      const entry = byRole.get(key)!;
      if (row.period === cur)  entry.cur  = row;
      if (row.period === prev) entry.prev = row;
    }

    for (const [, entry] of byRole) {
      if (!entry.cur) continue;

      const curCount  = entry.cur.count;
      const prevCount = entry.prev?.count ?? 0;

      // Salta se il volume è troppo basso
      if (curCount < MIN_COUNT) continue;

      // Calcola crescita
      const growthRate = prevCount > 0 ? (curCount - prevCount) / prevCount : 2.0;

      // Non interessante se cresce meno del threshold
      if (growthRate < GROWTH_THRESHOLD && prevCount > 0) continue;

      const roleTitle = entry.cur.roleTitle;
      const geography = [entry.cur.geography];

      // Calcola strength composito: job_posting (40%) + growth (60%)
      const countNorm   = Math.min(curCount / 500, 1.0);
      const growthNorm  = Math.min(growthRate / 5.0, 1.0);
      const strength    = countNorm * 0.40 + growthNorm * 0.60;

      // Cerca segnale esistente
      const existing = await db
        .select({ id: weakSignalsTable.id, status: weakSignalsTable.status, strength: weakSignalsTable.strength })
        .from(weakSignalsTable)
        .where(
          and(
            eq(weakSignalsTable.title, roleTitle),
            eq(weakSignalsTable.signalType, "new_job_title"),
          ),
        )
        .limit(1);

      const evidence = {
        jobPostingCount: curCount,
      };

      if (existing[0]) {
        // Aggiorna segnale esistente
        const newStatus = (
          strength >= CONFIRM_STRENGTH && curCount >= CONFIRM_COUNT
            ? "confirmed"
            : existing[0].status
        ) as "emerging" | "confirmed" | "mainstream" | "faded";

        await db
          .update(weakSignalsTable)
          .set({
            strength,
            geographies:          geography,
            confirmationEvidence: evidence,
            lastSeenAt:           new Date(),
            updatedAt:            new Date(),
            status:               newStatus,
          })
          .where(eq(weakSignalsTable.id, existing[0].id));

        if (newStatus === "confirmed" && existing[0].status !== "confirmed") confirmed++;
        updated++;
      } else {
        // Crea nuovo segnale
        const status = (
          strength >= CONFIRM_STRENGTH && curCount >= CONFIRM_COUNT ? "confirmed" : "emerging"
        ) as "emerging" | "confirmed";

        await db.insert(weakSignalsTable).values({
          signalType:           "new_job_title",
          title:                roleTitle,
          description:          `Ruolo "${roleTitle}" in crescita del ${Math.round(growthRate * 100)}% rispetto al mese precedente (${curCount} annunci in ${entry.cur.geography}).`,
          sources:              ["job_posting_snapshot"],
          strength,
          geographies:          geography,
          linkedSectorIds:      [],
          linkedRoleIds:        [],
          linkedSkillIds:       entry.cur.topSkills.slice(0, 5),
          status,
          confirmationEvidence: evidence,
        });

        if (status === "confirmed") confirmed++;
        created++;
      }
    }

    // Marca come faded i segnali non aggiornati da 3 mesi
    const threeAgo = threeMonthsAgo();
    await db
      .update(weakSignalsTable)
      .set({ status: "faded", updatedAt: new Date() })
      .where(
        and(
          eq(weakSignalsTable.status, "emerging"),
          sql`${weakSignalsTable.lastSeenAt} < ${threeAgo + "-01"}::date`,
        ),
      );

    const durationMs = Date.now() - t0;
    log.info({ created, updated, confirmed, durationMs }, "[weak-signal] detector complete");

    return { signalsCreated: created, signalsUpdated: updated, signalsConfirmed: confirmed, durationMs };
  } catch (err) {
    log.error({ err }, "[weak-signal] detector error");
    return { signalsCreated: 0, signalsUpdated: 0, signalsConfirmed: 0, durationMs: Date.now() - t0 };
  }
}
