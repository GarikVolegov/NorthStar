import { Router } from "express";
import { eq, count } from "drizzle-orm";
import { db, pool, sectorsTable, professionsTable, testSessionsTable } from "@workspace/db";

const router = Router();

/* ─── GET /api/sectors  —  lista settori dal DB (public) ─── */
router.get("/", async (req, res) => {
  try {
    const sectors = await db.select().from(sectorsTable).orderBy(sectorsTable.name);
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

    const [sector] = await db.select().from(sectorsTable).where(eq(sectorsTable.id, id)).limit(1);
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
      growthProjection: {
        shortTerm: String(Math.round(gr * 1.0)),
        midTerm:   String(Math.round(gr * 2.5)),
        longTerm:  String(Math.round(gr * 5.0)),
      },
    });
  } catch (err) {
    req.log?.error?.({ err }, "sector stats error");
    res.status(500).json({ error: "Errore nel caricamento delle statistiche" });
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
      .where(eq(professionsTable.sectorId, id))
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

    const [sector] = await db.select().from(sectorsTable).where(eq(sectorsTable.id, id)).limit(1);
    if (!sector) { res.status(404).json({ error: "Settore non trovato" }); return; }

    const professions = await db
      .select()
      .from(professionsTable)
      .where(eq(professionsTable.sectorId, id))
      .orderBy(professionsTable.title);

    res.json({ ...sector, professions });
  } catch (err) {
    req.log?.error?.({ err }, "sector get error");
    res.status(500).json({ error: "Errore nel caricamento del settore" });
  }
});

export default router;
