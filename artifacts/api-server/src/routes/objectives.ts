import { Router, type IRouter } from "express";
import { db, userObjectivesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/objectives/:userId", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const objectives = await db
    .select()
    .from(userObjectivesTable)
    .where(eq(userObjectivesTable.userId, userId));

  res.json(objectives);
});

router.post("/objectives", async (req, res): Promise<void> => {
  const { userId, text } = req.body;
  if (!userId || !text?.trim()) { res.status(400).json({ error: "userId e text richiesti" }); return; }

  const [obj] = await db.insert(userObjectivesTable).values({
    userId,
    text: text.trim(),
  }).returning();

  res.status(201).json(obj);
});

router.patch("/objectives/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const { completed } = req.body;
  if (typeof completed !== "boolean") { res.status(400).json({ error: "completed (boolean) richiesto" }); return; }

  const [obj] = await db
    .update(userObjectivesTable)
    .set({ completed })
    .where(eq(userObjectivesTable.id, id))
    .returning();

  if (!obj) { res.status(404).json({ error: "Obiettivo non trovato" }); return; }
  res.json(obj);
});

router.delete("/objectives/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
  await db.delete(userObjectivesTable).where(eq(userObjectivesTable.id, id));
  res.json({ ok: true });
});

export default router;
