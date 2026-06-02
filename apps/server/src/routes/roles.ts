import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { db, professionsTable, sectorsTable, jobPostingSnapshotsTable } from "@workspace/db";

const router = Router();

/** Hook di curiosità onesto: incuriosisce ma rimanda sempre ai lati che pesano. */
function buildCuriosity(growthOutlook: string | null, opportunities: string[]): string {
  const opp = opportunities[0];
  if (opp) {
    return `Dove sta andando: ${opp}. Prima di puntarci, guarda però anche cosa pesa.`;
  }
  if (growthOutlook) {
    return `Prospettiva di crescita: ${growthOutlook}. Affascinante, ma non è per tutti — leggi prima i lati difficili.`;
  }
  return "Ogni ruolo ha una parte che accende e una che pesa: guardale entrambe, di pancia.";
}

/* ─── GET /api/roles  —  lista ruoli/professioni dal DB ─── */
router.get("/", requireAuth, async (req, res) => {
  try {
    const professions = await db
      .select()
      .from(professionsTable)
      .where(eq(professionsTable.isActive, true))
      .orderBy(professionsTable.title);
    res.json(professions);
  } catch (err) {
    req.log?.error?.({ err }, "roles list error");
    res.status(500).json({ error: "Errore nel caricamento dei ruoli" });
  }
});

/* ─── GET /api/roles/:id/insights  —  ritratto ONESTO del ruolo ───
 * Incuriosisce (opportunità, dove sta andando) MA mostra sempre i lati che
 * pesano (svantaggi del settore) e la domanda reale di mercato quando disponibile.
 * Pensato per non vendere un sogno: la scelta deve reggere anche ai contro. */
router.get("/:id/insights", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "ID non valido" });
      return;
    }

    const [profession] = await db
      .select({
        id: professionsTable.id,
        title: professionsTable.title,
        sectorId: professionsTable.sectorId,
        riasecFit: professionsTable.riasecFit,
        growthOutlook: professionsTable.growthOutlook,
      })
      .from(professionsTable)
      .where(eq(professionsTable.id, id))
      .limit(1);

    if (!profession) {
      res.status(404).json({ error: "Ruolo non trovato" });
      return;
    }

    let sector: { id: number; name: string } | null = null;
    let energizers: string[] = [];
    let frictions: string[] = [];
    let opportunities: string[] = [];

    if (profession.sectorId != null) {
      const [s] = await db
        .select({
          id: sectorsTable.id,
          name: sectorsTable.name,
          advantages: sectorsTable.advantages,
          disadvantages: sectorsTable.disadvantages,
          opportunities: sectorsTable.opportunities,
        })
        .from(sectorsTable)
        .where(eq(sectorsTable.id, profession.sectorId))
        .limit(1);
      if (s) {
        sector = { id: s.id, name: s.name };
        energizers = s.advantages ?? [];
        frictions = s.disadvantages ?? [];
        opportunities = s.opportunities ?? [];
      }
    }

    // Domanda reale: ultimo snapshot per la professione (può mancare finché la
    // pipeline di freshness non popola job_posting_snapshots — degrada a null).
    const [snap] = await db
      .select({
        count: jobPostingSnapshotsTable.count,
        period: jobPostingSnapshotsTable.period,
        growthRate: jobPostingSnapshotsTable.growthRate,
        avgSalaryMin: jobPostingSnapshotsTable.avgSalaryMin,
        avgSalaryMax: jobPostingSnapshotsTable.avgSalaryMax,
        topSkills: jobPostingSnapshotsTable.topSkills,
      })
      .from(jobPostingSnapshotsTable)
      .where(eq(jobPostingSnapshotsTable.professionId, id))
      .orderBy(desc(jobPostingSnapshotsTable.period), desc(jobPostingSnapshotsTable.createdAt))
      .limit(1);

    res.json({
      professionId: profession.id,
      roleTitle: profession.title,
      sector,
      energizers,
      frictions,
      opportunities,
      curiosity: buildCuriosity(profession.growthOutlook, opportunities),
      demand: snap ?? null,
    });
  } catch (err) {
    req.log?.error?.({ err }, "role insights error");
    res.status(500).json({ error: "Errore nel caricamento degli insight del ruolo" });
  }
});

/* ─── GET /api/roles/:id  —  singola professione ─── */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID non valido" });
      return;
    }

    const [profession] = await db
      .select()
      .from(professionsTable)
      .where(eq(professionsTable.id, id))
      .limit(1);

    if (!profession) {
      res.status(404).json({ error: "Ruolo non trovato" });
      return;
    }

    res.json(profession);
  } catch (err) {
    req.log?.error?.({ err }, "role get error");
    res.status(500).json({ error: "Errore nel caricamento del ruolo" });
  }
});

export default router;
