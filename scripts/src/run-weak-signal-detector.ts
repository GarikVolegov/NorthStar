/**
 * run-weak-signal-detector.ts — script CLI per triggerare manualmente
 * il weak signal detector senza aspettare il cron settimanale.
 *
 * Usare DOPO seed-rag.ts per vedere i segnali deboli generati.
 *
 * Eseguire con:
 *   pnpm --filter @workspace/scripts run rag:weak-signals
 */
import "dotenv/config";
import { eq, desc } from "drizzle-orm";
import { db, weakSignalsTable, jobPostingSnapshotsTable } from "@workspace/db";
import { sql, and } from "drizzle-orm";

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function prevPeriod(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const GROWTH_THRESHOLD = 1.5;
const MIN_COUNT        = 30;
const CONFIRM_STRENGTH = 0.60;
const CONFIRM_COUNT    = 50;

async function main() {
  console.log("🔍 Weak Signal Detector — avvio manuale");

  const cur  = currentPeriod();
  const prev = prevPeriod();

  console.log(`  Periodi analizzati: ${prev} → ${cur}`);

  const rows = await db
    .select({
      roleTitle: jobPostingSnapshotsTable.roleTitle,
      period:    jobPostingSnapshotsTable.period,
      count:     jobPostingSnapshotsTable.count,
      geography: jobPostingSnapshotsTable.geography,
      topSkills: jobPostingSnapshotsTable.topSkills,
    })
    .from(jobPostingSnapshotsTable)
    .where(sql`${jobPostingSnapshotsTable.period} IN (${cur}, ${prev})`);

  const byRole = new Map<string, { cur?: typeof rows[0]; prev?: typeof rows[0] }>();
  for (const row of rows) {
    const key = `${row.roleTitle}||${row.geography}`;
    if (!byRole.has(key)) byRole.set(key, {});
    const entry = byRole.get(key)!;
    if (row.period === cur)  entry.cur  = row;
    if (row.period === prev) entry.prev = row;
  }

  console.log(`\n  Analisi di ${byRole.size} combinazioni ruolo/geografia`);

  let created = 0, updated = 0, confirmed = 0;

  for (const [, entry] of byRole) {
    if (!entry.cur) continue;

    const curCount  = entry.cur.count;
    const prevCount = entry.prev?.count ?? 0;
    if (curCount < MIN_COUNT) continue;

    const growthRate = prevCount > 0 ? (curCount - prevCount) / prevCount : 2.0;
    if (growthRate < GROWTH_THRESHOLD && prevCount > 0) continue;

    const countNorm  = Math.min(curCount / 500, 1.0);
    const growthNorm = Math.min(growthRate / 5.0, 1.0);
    const strength   = countNorm * 0.40 + growthNorm * 0.60;

    const roleTitle = entry.cur.roleTitle;
    const geography = [entry.cur.geography];

    const existing = await db
      .select({ id: weakSignalsTable.id, status: weakSignalsTable.status })
      .from(weakSignalsTable)
      .where(and(eq(weakSignalsTable.title, roleTitle), eq(weakSignalsTable.signalType, "new_job_title")))
      .limit(1);

    const newStatus = strength >= CONFIRM_STRENGTH && curCount >= CONFIRM_COUNT ? "confirmed" : "emerging";

    if (existing[0]) {
      await db.update(weakSignalsTable).set({
        strength,
        geographies: geography,
        lastSeenAt:  new Date(),
        updatedAt:   new Date(),
        status:      newStatus as any,
        confirmationEvidence: { jobPostingCount: curCount },
      }).where(eq(weakSignalsTable.id, existing[0].id));

      if (newStatus === "confirmed" && existing[0].status !== "confirmed") confirmed++;
      updated++;
    } else {
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
        status:               newStatus as any,
        confirmationEvidence: { jobPostingCount: curCount },
      });
      if (newStatus === "confirmed") confirmed++;
      created++;
    }

    const icon = newStatus === "confirmed" ? "✅" : "🟡";
    console.log(`  ${icon} [${newStatus.padEnd(9)}] ${roleTitle.padEnd(30)} strength=${strength.toFixed(2)} growth=+${Math.round(growthRate*100)}% count=${curCount}`);
  }

  console.log(`\n📊 Risultati:`);
  console.log(`   Creati:    ${created}`);
  console.log(`   Aggiornati: ${updated}`);
  console.log(`   Confermati: ${confirmed}`);

  // Mostra tutti i segnali confermati
  const confirmed_list = await db
    .select({ title: weakSignalsTable.title, strength: weakSignalsTable.strength, geographies: weakSignalsTable.geographies })
    .from(weakSignalsTable)
    .where(eq(weakSignalsTable.status, "confirmed"))
    .orderBy(desc(weakSignalsTable.strength));

  if (confirmed_list.length > 0) {
    console.log(`\n✅ Segnali confermati (${confirmed_list.length}):`);
    for (const s of confirmed_list) {
      console.log(`   • ${s.title} [geo: ${s.geographies.join(",")}] strength=${s.strength.toFixed(2)}`);
    }
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Errore:", e);
  process.exit(1);
});
