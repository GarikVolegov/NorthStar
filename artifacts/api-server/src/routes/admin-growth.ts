import { Router } from "express";
import { db, growthArticlesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();
const ADMIN_KEY = process.env.ADMIN_KEY ?? "northstar-admin";

function adminAuth(req: any, res: any, next: any) {
  if (req.headers["x-admin-key"] !== ADMIN_KEY) {
    res.status(401).json({ error: "Non autorizzato" }); return;
  }
  next();
}

// GET /admin/growth-queue — articoli in coda (status = 'pending')
router.get("/admin/growth-queue", adminAuth, async (_req, res): Promise<void> => {
  try {
    const pending = await db
      .select()
      .from(growthArticlesTable)
      .where(eq(growthArticlesTable.status, "pending"))
      .orderBy(sql`${growthArticlesTable.createdAt} desc`);
    const publishedCount = await db
      .select({ cnt: sql<number>`count(*)` })
      .from(growthArticlesTable)
      .where(eq(growthArticlesTable.status, "published"));
    const rejectedCount = await db
      .select({ cnt: sql<number>`count(*)` })
      .from(growthArticlesTable)
      .where(eq(growthArticlesTable.status, "rejected"));
    res.json({
      queue: pending,
      stats: {
        pending: pending.length,
        published: Number(publishedCount[0]?.cnt ?? 0),
        rejected: Number(rejectedCount[0]?.cnt ?? 0),
      },
    });
  } catch (e) {
    res.status(500).json({ error: "Errore caricamento coda" });
  }
});

// POST /admin/growth-queue/:id/approve — pubblica articolo
router.post("/admin/growth-queue/:id/approve", adminAuth, async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const body = req.body;
    const [updated] = await db
      .update(growthArticlesTable)
      .set({
        status: "published",
        title: body.title ?? undefined,
        description: body.description ?? undefined,
        content: body.content ?? undefined,
        tags: body.tags ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(growthArticlesTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Articolo non trovato" }); return; }
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: "Errore approvazione articolo" });
  }
});

// POST /admin/growth-queue/:id/reject — scarta articolo
router.post("/admin/growth-queue/:id/reject", adminAuth, async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(growthArticlesTable)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(growthArticlesTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Articolo non trovato" }); return; }
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: "Errore rifiuto articolo" });
  }
});

// DELETE /admin/growth-queue/:id — elimina definitivamente
router.delete("/admin/growth-queue/:id", adminAuth, async (req, res): Promise<void> => {
  try {
    await db.delete(growthArticlesTable).where(eq(growthArticlesTable.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Errore eliminazione articolo" });
  }
});

export default router;
