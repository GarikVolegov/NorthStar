import { Router } from "express";
import { and, desc, eq, count } from "drizzle-orm";
import { db, pool, sectorsTable, professionsTable, testSessionsTable, jobPostingSnapshotsTable } from "@workspace/db";

const router = Router();

/* ─── GET /api/sectors  —  lista settori dal DB (public) ─── */
router.get("/", async (req, res) => {
  try {
    const sectors = await db
      .select()
      .from(sectorsTable)
      .where(eq(sectorsTable.isActive, true))
      .orderBy(sectorsTable.name);
    res.json(sectors);
  } catch (err) {
    req.log?.error?.({ err }, "sectors list error");
    res.status(500).json({ error: "Errore nel caricamento dei settori" });
  }
});

/* ─── GET /api/sectors/:id/stats  —  statistiche settore ─── */
router.get("/:id/stats", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

    const [sector] = await db
      .select()
      .from(sectorsTable)
      .where(and(eq(sectorsTable.id, id), eq(sectorsTable.isActive, true)))
      .limit(1);
    if (!sector) { res.status(404).json({ error: "Settore non trovato" }); return; }

    const [rolesCount] = await db.select({ cnt: count() }).from(professionsTable).where(eq(professionsTable.sectorId, id));

    // timesPicked = utenti che hanno confermato questo settore
    const [pickedRow] = await db
      .select({ cnt: count() })
      .from(testSessionsTable)
      .where(eq(testSessionsTable.confirmedSectorId, id));

    // avgMatchScore = media dei matchScore nelle raccomandazioni
    const { rows: avgRows } = await pool.query<{ avg: string }>(`
      SELECT coalesce(avg((r->>'matchScore')::numeric), 0) AS avg
      FROM test_sessions,
      jsonb_array_elements(
        CASE WHEN jsonb_typeof(recommendations::jsonb) = 'array'
             THEN recommendations::jsonb ELSE '[]'::jsonb END
      ) AS r
      WHERE (r->>'sectorId')::int = $1
    `, [id]);

    const gr = sector.growthRate ?? 5;
    const timesPicked   = Number(pickedRow?.cnt ?? 0);
    const avgMatchScore = Math.round(Number(avgRows[0]?.avg ?? 0));

    res.json({
      growthRate:     gr,
      automationRisk: sector.automationRisk,
      scalability:    sector.scalability,
      trend:          sector.trend,
      avgSalaryMin:   sector.avgSalaryMin,
      avgSalaryMax:   sector.avgSalaryMax,
      timeToAutonomy: sector.timeToAutonomy,
      rolesCount:     Number(rolesCount?.cnt ?? 0),
      timesPicked,
      avgMatchScore,
      // Proiezione di crescita RIMOSSA: era gr×{1,2.5,5}, costanti inventate.
      // La crescita reale arriva dai job_posting_snapshots (growth_rate vs periodo
      // precedente) ed è esposta da /api/sectors/:id/market, non fabbricata qui.
      growthProjection: null,
    });
  } catch (err) {
    req.log?.error?.({ err }, "sector stats error");
    res.status(500).json({ error: "Errore nel caricamento delle statistiche" });
  }
});

/* ─── GET /api/sectors/:id/market  —  domanda REALE di mercato del settore ───
 * Aggrega i job_posting_snapshots dell'ultimo periodo per il settore. Onesto:
 * se non ci sono ancora snapshot (pipeline freshness non eseguita) ritorna
 * hasData:false invece di numeri inventati. Si accende da solo quando i dati
 * reali vengono popolati. */
router.get("/:id/market", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

    const rows = await db
      .select({
        count: jobPostingSnapshotsTable.count,
        period: jobPostingSnapshotsTable.period,
        growthRate: jobPostingSnapshotsTable.growthRate,
        avgSalaryMin: jobPostingSnapshotsTable.avgSalaryMin,
        avgSalaryMax: jobPostingSnapshotsTable.avgSalaryMax,
        topSkills: jobPostingSnapshotsTable.topSkills,
        source: jobPostingSnapshotsTable.source,
      })
      .from(jobPostingSnapshotsTable)
      .where(eq(jobPostingSnapshotsTable.sectorId, id))
      .orderBy(desc(jobPostingSnapshotsTable.period))
      .limit(50);

    if (rows.length === 0) {
      res.json({ hasData: false });
      return;
    }

    // Aggrega solo l'ultimo periodo disponibile (il più recente).
    const latestPeriod = rows[0]!.period;
    const latest = rows.filter((r) => r.period === latestPeriod);

    const totalCount = latest.reduce((sum, r) => sum + (r.count ?? 0), 0);
    const growthVals = latest.map((r) => r.growthRate).filter((g): g is number => g != null);
    const avgGrowth = growthVals.length ? growthVals.reduce((a, b) => a + b, 0) / growthVals.length : null;
    const salMins = latest.map((r) => r.avgSalaryMin).filter((n): n is number => n != null);
    const salMaxs = latest.map((r) => r.avgSalaryMax).filter((n): n is number => n != null);
    const skillFreq = new Map<string, number>();
    for (const r of latest) for (const s of r.topSkills ?? []) skillFreq.set(s, (skillFreq.get(s) ?? 0) + 1);
    const topSkills = [...skillFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s]) => s);
    const sources = [...new Set(latest.map((r) => r.source).filter(Boolean))];

    res.json({
      hasData: true,
      period: latestPeriod,
      count: totalCount,
      growthRate: avgGrowth,
      avgSalaryMin: salMins.length ? Math.min(...salMins) : null,
      avgSalaryMax: salMaxs.length ? Math.max(...salMaxs) : null,
      topSkills,
      sources,
    });
  } catch (err) {
    req.log?.error?.({ err }, "sector market error");
    res.status(500).json({ error: "Errore nel caricamento della domanda di mercato" });
  }
});

/* ─── GET /api/sectors/market-demand  —  domanda reale aggregata per settore ───
 * Per la piramide /settori: ordina i settori anche sui DATI reali, non solo sul
 * profilo. Somma gli annunci dell'ultimo periodo per settore. Vuoto finche' la
 * pipeline freshness non gira. */
router.get("/market-demand", async (req, res) => {
  try {
    const { rows } = await pool.query<{ sector_id: number; demand: string; period: string }>(`
      WITH latest AS (
        SELECT max(period) AS p FROM job_posting_snapshots
      )
      SELECT sector_id, sum(count)::int AS demand, max(period) AS period
      FROM job_posting_snapshots, latest
      WHERE period = latest.p AND sector_id IS NOT NULL
      GROUP BY sector_id
    `);
    res.json({
      period: rows[0]?.period ?? null,
      demand: rows.map((r) => ({ sectorId: Number(r.sector_id), count: Number(r.demand) })),
    });
  } catch (err) {
    req.log?.error?.({ err }, "sectors market-demand error");
    res.status(500).json({ error: "Errore nel caricamento della domanda per settore" });
  }
});

/* ─── GET /api/sectors/:id/roles  —  professioni del settore ─── */
router.get("/:id/roles", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

    const roles = await db
      .select({
        id:           professionsTable.id,
        title:        professionsTable.title,
        description:  professionsTable.description,
        salaryRange:  professionsTable.salaryRange,
        growthOutlook: professionsTable.growthOutlook,
        skills:       professionsTable.skills,
        riasecFit:    professionsTable.riasecFit,
        workModes:    professionsTable.workModes,
        autonomyScore: professionsTable.autonomyScore,
        stabilityScore: professionsTable.stabilityScore,
      })
      .from(professionsTable)
      .where(and(eq(professionsTable.sectorId, id), eq(professionsTable.isActive, true)))
      .orderBy(professionsTable.title);

    res.json(roles);
  } catch (err) {
    req.log?.error?.({ err }, "sector roles error");
    res.status(500).json({ error: "Errore nel caricamento dei ruoli" });
  }
});

/* ─── GET /api/sectors/:id  —  singolo settore con professioni (public) ─── */
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

    const [sector] = await db
      .select()
      .from(sectorsTable)
      .where(and(eq(sectorsTable.id, id), eq(sectorsTable.isActive, true)))
      .limit(1);
    if (!sector) { res.status(404).json({ error: "Settore non trovato" }); return; }

    const professions = await db
      .select()
      .from(professionsTable)
      .where(and(eq(professionsTable.sectorId, id), eq(professionsTable.isActive, true)))
      .orderBy(professionsTable.title);

    res.json({ ...sector, professions });
  } catch (err) {
    req.log?.error?.({ err }, "sector get error");
    res.status(500).json({ error: "Errore nel caricamento del settore" });
  }
});

export default router;
