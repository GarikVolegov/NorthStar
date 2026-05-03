import { Router, type IRouter } from "express";
import { db, userFavoritesTable, sectorsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/favorites/:userId", async (req, res): Promise<void> => {
  const userId = parseInt(String(req.params.userId), 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const favorites = await db
    .select()
    .from(userFavoritesTable)
    .where(eq(userFavoritesTable.userId, userId));

  const sectorIds = favorites
    .filter((f) => f.type === "sector" && f.sectorId != null)
    .map((f) => f.sectorId!);

  const sectors = sectorIds.length > 0 ? await db.select().from(sectorsTable) : [];

  const enriched = favorites.map((f) => ({
    ...f,
    sector:
      f.type === "sector" && f.sectorId
        ? (() => {
            const s = sectors.find((sec) => sec.id === f.sectorId);
            return s
              ? { id: s.id, name: s.name, icon: s.icon, description: s.description,
                  avgSalaryMin: s.avgSalaryMin, avgSalaryMax: s.avgSalaryMax,
                  growthRate: s.growthRate, automationRisk: s.automationRisk, trend: s.trend }
              : null;
          })()
        : null,
  }));

  res.json(enriched);
});

router.post("/favorites", async (req, res): Promise<void> => {
  const { userId, type, sectorId, articleUrl, articleTitle, articleDescription, articleSource, articleImage, articleCategory } = req.body;

  if (!userId || !type || !["sector", "news"].includes(type)) {
    res.status(400).json({ error: "Dati non validi" });
    return;
  }

  if (type === "sector" && sectorId) {
    const [existing] = await db.select().from(userFavoritesTable)
      .where(and(eq(userFavoritesTable.userId, userId), eq(userFavoritesTable.sectorId, sectorId)));
    if (existing) { res.json(existing); return; }
  }

  if (type === "news" && articleUrl) {
    const [existing] = await db.select().from(userFavoritesTable)
      .where(and(eq(userFavoritesTable.userId, userId), eq(userFavoritesTable.articleUrl, articleUrl)));
    if (existing) { res.json(existing); return; }
  }

  const [fav] = await db.insert(userFavoritesTable).values({
    userId, type,
    sectorId: sectorId ?? null,
    articleUrl: articleUrl ?? null,
    articleTitle: articleTitle ?? null,
    articleDescription: articleDescription ?? null,
    articleSource: articleSource ?? null,
    articleImage: articleImage ?? null,
    articleCategory: articleCategory ?? null,
  }).returning();

  res.status(201).json(fav);
});

router.delete("/favorites/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
  await db.delete(userFavoritesTable).where(eq(userFavoritesTable.id, id));
  res.json({ ok: true });
});

export default router;
