/**
 * job-monitor executor — surfaces matching job posting snapshots for a role/city pair.
 *
 * parameters: { role: string, city?: string, seniority?: string, count?: number }
 */
import { db, jobPostingSnapshotsTable } from "@workspace/db";
import { desc, ilike, and } from "drizzle-orm";
import { rootLogger } from "../../middleware/logger.js";
import type { RoutineExecutor, RoutineResult } from "../routine-types.js";

const log = rootLogger.child({ module: "executor:job-monitor" });

export const jobMonitorExecutor: RoutineExecutor = async (routine, _user): Promise<RoutineResult> => {
  const params  = routine.parameters as { role?: string; city?: string; seniority?: string; count?: number };
  const role    = params.role   ?? "developer";
  const city    = params.city;
  const limit   = params.count  ?? 5;
  const today   = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });

  try {
    const conditions = [ilike(jobPostingSnapshotsTable.roleTitle, `%${role}%`)];
    if (city) {
      conditions.push(ilike(jobPostingSnapshotsTable.geography, `%${city}%`));
    }

    const rows = await db
      .select({
        roleTitle:   jobPostingSnapshotsTable.roleTitle,
        count:       jobPostingSnapshotsTable.count,
        geography:   jobPostingSnapshotsTable.geography,
        topSkills:   jobPostingSnapshotsTable.topSkills,
        growthRate:  jobPostingSnapshotsTable.growthRate,
        period:      jobPostingSnapshotsTable.period,
      })
      .from(jobPostingSnapshotsTable)
      .where(and(...conditions))
      .orderBy(desc(jobPostingSnapshotsTable.count))
      .limit(limit);

    const locationLabel = city ? ` a ${city}` : "";

    if (rows.length === 0) {
      return {
        title:     `🔍 Nessuna offerta trovata — ${today}`,
        body:      `Nessuna offerta trovata per **${role}**${locationLabel}.\n\nProva a modificare i parametri della routine o controlla le ultime offerte manualmente.`,
        ctaLabel:  "Vedi tutte le offerte",
        ctaTarget: "/jobs",
        metadata:  { role, city, jobCount: 0, period: today },
      };
    }

    const lines = rows.map((r) => {
      const skills = r.topSkills.slice(0, 3).join(", ");
      const trend  = r.growthRate != null
        ? ` — trend: ${r.growthRate > 0 ? "+" : ""}${(r.growthRate * 100).toFixed(0)}%`
        : "";
      return `- **${r.roleTitle}** (${r.count} annunci, ${r.geography})${trend}${skills ? `\n  Skill: ${skills}` : ""}`;
    });

    const body = [
      `Trovate **${rows.length}** snapshot per ruoli **${role}**${locationLabel}:\n`,
      lines.join("\n"),
    ].join("\n");

    return {
      title:     `🔍 ${rows.length} offerte ${role}${locationLabel} — ${today}`,
      body,
      ctaLabel:  "Vedi tutte le offerte",
      ctaTarget: "/jobs",
      metadata:  { role, city, jobCount: rows.length, period: today },
    };
  } catch (err) {
    log.warn({ err, routineId: routine.id }, "[job-monitor] query failed");
    return {
      title:     `🔍 Monitoraggio offerte — ${today}`,
      body:      `Non è stato possibile recuperare le offerte per **${role}** al momento. Riprova più tardi.`,
      ctaLabel:  "Vedi tutte le offerte",
      ctaTarget: "/jobs",
      metadata:  { role, city, jobCount: 0, error: String(err) },
    };
  }
};
