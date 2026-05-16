import { Router } from "express";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { db, sectorsTable, professionsTable } from "@workspace/db";

const router = Router();

/* ─── GET /api/sectors  —  lista settori dal DB ─── */
router.get("/", requireAuth, async (req, res) => {
  try {
    const sectors = await db
      .select()
      .from(sectorsTable)
      .orderBy(sectorsTable.name);
    res.json(sectors);
  } catch (err) {
    req.log?.error?.({ err }, "sectors list error");
    res.status(500).json({ error: "Errore nel caricamento dei settori" });
  }
});

/* ─── GET /api/sectors/:id  —  singolo settore con professioni ─── */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID non valido" });
      return;
    }

    const [sector] = await db
      .select()
      .from(sectorsTable)
      .where(eq(sectorsTable.id, id))
      .limit(1);

    if (!sector) {
      res.status(404).json({ error: "Settore non trovato" });
      return;
    }

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
