import { Router } from "express";
import { z } from "zod/v4";
import { eq, and } from "drizzle-orm";
import { db, newsSubscriptionsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router = Router();

const FREE_CATEGORIES = [
  "general", "technology", "business", "science", "health", "finance", "education",
];

router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const subs = await db
      .select({ category: newsSubscriptionsTable.category })
      .from(newsSubscriptionsTable)
      .where(eq(newsSubscriptionsTable.userId, userId));

    res.json({ subscriptions: subs.map((s) => s.category) });
  } catch (err) {
    req.log?.error?.({ err }, "news subscriptions get error");
    res.status(500).json({ error: "Errore nel caricamento" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const parsed = z.object({ category: z.enum(FREE_CATEGORIES as [string, ...string[]]) }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Categoria non valida" });
      return;
    }

    const { category } = parsed.data;
    await db.insert(newsSubscriptionsTable).values({ userId, category }).onConflictDoNothing();
    res.json({ ok: true, category });
  } catch (err) {
    req.log?.error?.({ err }, "news subscribe error");
    res.status(500).json({ error: "Errore nell'iscrizione" });
  }
});

router.delete("/:category", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { category } = req.params;
    if (!category || !FREE_CATEGORIES.includes(category)) {
      res.status(400).json({ error: "Categoria non valida" });
      return;
    }

    await db
      .delete(newsSubscriptionsTable)
      .where(and(eq(newsSubscriptionsTable.userId, userId), eq(newsSubscriptionsTable.category, category)));

    res.json({ ok: true, category });
  } catch (err) {
    req.log?.error?.({ err }, "news unsubscribe error");
    res.status(500).json({ error: "Errore nella rimozione" });
  }
});

export default router;
