import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { userObjectivesTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router = Router();

const createObjectiveSchema = z.object({
  text: z.string().min(3).max(200),
  category: z.string().default("altro"),
  dueDate: z.string().optional(),
});

const updateObjectiveSchema = z.object({
  text: z.string().min(3).max(200).optional(),
  progress: z.number().min(0).max(100).optional(),
  completed: z.boolean().optional(),
  dueDate: z.string().nullable().optional(),
});

const SEED_OBJECTIVES: Record<string, Array<{ text: string; category: string }>> = {
  indeciso: [
    { text: "Completa il test di personalità", category: "scoperta" },
    { text: "Esplora 3 settori professionali", category: "esplorazione" },
    { text: "Scegli il tuo percorso", category: "decisione" },
  ],
  dipendente: [
    { text: "Identifica 5 competenze chiave", category: "carriera" },
    { text: "Simula 3 colloqui di lavoro", category: "preparazione" },
    { text: "Invia 5 candidature", category: "ricerca" },
  ],
  autonomo: [
    { text: "Valida un'idea di business", category: "business" },
    { text: "Analizza 3 settori di mercato", category: "mercato" },
    { text: "Crea un business plan", category: "business" },
  ],
  azienda: [
    { text: "Esplora 5 profili personalità", category: "selezione" },
    { text: "Pubblica un annuncio di lavoro", category: "reclutamento" },
    { text: "Analizza 3 settori del mercato", category: "mercato" },
  ],
  investitore: [
    { text: "Analizza 5 settori in crescita", category: "analisi" },
    { text: "Confronta 2 settori tra loro", category: "analisi" },
    { text: "Leggi 3 report di mercato", category: "ricerca" },
  ],
};

router.get("/", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const items = await db
    .select()
    .from(userObjectivesTable)
    .where(eq(userObjectivesTable.userId, userId))
    .orderBy(desc(userObjectivesTable.createdAt));

  res.json(items);
});

router.post("/", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const data = createObjectiveSchema.parse(req.body);

  const [item] = await db
    .insert(userObjectivesTable)
    .values({
      userId,
      text: data.text,
      category: data.category,
      dueDate: data.dueDate ?? null,
    })
    .returning();

  res.status(201).json(item);
});

router.post("/seed", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const journeyType = req.user!.journeyType ?? "indeciso";

  const existing = await db
    .select({ id: userObjectivesTable.id })
    .from(userObjectivesTable)
    .where(eq(userObjectivesTable.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    res.json({ message: "Obiettivi già presenti", count: existing.length });
    return;
  }

  const defaults = SEED_OBJECTIVES[journeyType] ?? SEED_OBJECTIVES.indeciso;

  const inserted = await db
    .insert(userObjectivesTable)
    .values(defaults.map((o) => ({ userId, text: o.text, category: o.category })))
    .returning();

  res.status(201).json({ message: "Obiettivi creati", objectives: inserted });
});

router.patch("/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const id = parseInt(req.params.id);
  const data = updateObjectiveSchema.parse(req.body);

  const [existing] = await db
    .select()
    .from(userObjectivesTable)
    .where(and(eq(userObjectivesTable.id, id), eq(userObjectivesTable.userId, userId)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Obiettivo non trovato" });
    return;
  }

  const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };
  if (data.completed === true) {
    updateData.completedAt = new Date();
    updateData.progress = 100;
  }
  if (data.completed === false) {
    updateData.completedAt = null;
  }

  const [updated] = await db
    .update(userObjectivesTable)
    .set(updateData)
    .where(eq(userObjectivesTable.id, id))
    .returning();

  res.json(updated);
});

router.delete("/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const id = parseInt(req.params.id);

  const [existing] = await db
    .select()
    .from(userObjectivesTable)
    .where(and(eq(userObjectivesTable.id, id), eq(userObjectivesTable.userId, userId)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Obiettivo non trovato" });
    return;
  }

  await db.delete(userObjectivesTable).where(eq(userObjectivesTable.id, id));
  res.status(204).send();
});

export default router;
