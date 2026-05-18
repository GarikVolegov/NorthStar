import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { db, userFavoritesTable } from "@workspace/db";

const router = Router();

/* ─── GET /api/favorites/:userId  ─── */
router.get("/:userId", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId) || userId !== req.user!.id) {
      res.json({ favorites: [] }); return;
    }

    const favorites = await db
      .select()
      .from(userFavoritesTable)
      .where(eq(userFavoritesTable.userId, userId));

    res.json(favorites);
  } catch (err) {
    req.log?.error?.({ err }, "favorites get error");
    res.json([]);
  }
});

/* ─── POST /api/favorites  —  aggiungi preferito ─── */
router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { type, sectorId, articleUrl, articleTitle, articleDescription, articleSource, articleImage, articleCategory, growthArticleId } = req.body;

    if (!type) { res.status(400).json({ error: "type richiesto" }); return; }

    await db.insert(userFavoritesTable).values({
      userId, type, sectorId, articleUrl, articleTitle,
      articleDescription, articleSource, articleImage, articleCategory, growthArticleId,
    }).onConflictDoNothing();

    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "favorites add error");
    res.status(500).json({ error: "Errore aggiunta preferito" });
  }
});

/* ─── DELETE /api/favorites/:id  ─── */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const userId = req.user!.id;

    await db.delete(userFavoritesTable).where(and(eq(userFavoritesTable.id, id), eq(userFavoritesTable.userId, userId)));
    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "favorites delete error");
    res.status(500).json({ error: "Errore rimozione preferito" });
  }
});

export default router;
