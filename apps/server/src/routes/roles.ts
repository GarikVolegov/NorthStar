import { Router } from "express";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { db, professionsTable } from "@workspace/db";

const router = Router();

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
