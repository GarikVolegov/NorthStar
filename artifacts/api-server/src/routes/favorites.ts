import { Router, type IRouter } from "express";
import { db, userFavoritesTable, sectorsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware, optionalAuthMiddleware } from "../lib/auth-jwt.js";

const router: IRouter = Router();

// ─── GET /api/favorites/:userId — backward compat (apiFetch manda auth) ─────
router.get("/favorites/:userId", optionalAuthMiddleware, async (req, res): Promise<void> => {
  // Usa l'userId dall'auth token se disponibile (sicuro), altrimenti il parametro (legacy)
  const authUserId = res.locals.userId as number | undefined;
  const paramUserId = parseInt(String(req.params.userId), 10);
  const userId = authUserId ?? paramUserId;
  if (!userId || isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const favorites = await db
    .select()
    .from(userFavoritesTable)
    .where(eq(userFavoritesTable.userId, userId));

  const sectorIds = favorites
    .filter((f) => f.type === "sector" && f.sectorId != null)
    .map((f) => f.sectorId!);

  const sectors = sectorIds.length > 0
    ? await db.select().from(sectorsTable)
    : [];

  const enriched = favorites.map((f) => ({
    ...f,
    sector:
      f.type === "sector" && f.sectorId
        ? (() => {
            const s = sectors.find((sec) => sec.id === f.sectorId);
            return s
              ? {
                  id: s.id, name: s.name, icon: s.icon, description: s.description,
                  avgSalaryMin: s.avgSalaryMin, avgSalaryMax: s.avgSalaryMax,
                  growthRate: s.growthRate, automationRisk: s.automationRisk, trend: s.trend,
                }
              : null;
          })()
        : null,
  }));

  res.json(enriched);
});

// ─── GET /api/favorites — preferiti dell'utente autenticato ──────────────────
router.get("/favorites", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;

  const favorites = await db
    .select()
    .from(userFavoritesTable)
    .where(eq(userFavoritesTable.userId, userId));

  const sectorIds = favorites
    .filter((f) => f.type === "sector" && f.sectorId != null)
    .map((f) => f.sectorId!);

  const sectors = sectorIds.length > 0
    ? await db.select().from(sectorsTable)
    : [];

  const enriched = favorites.map((f) => ({
    ...f,
    sector:
      f.type === "sector" && f.sectorId
        ? (() => {
            const s = sectors.find((sec) => sec.id === f.sectorId);
            return s
              ? {
                  id: s.id, name: s.name, icon: s.icon, description: s.description,
                  avgSalaryMin: s.avgSalaryMin, avgSalaryMax: s.avgSalaryMax,
                  growthRate: s.growthRate, automationRisk: s.automationRisk, trend: s.trend,
                }
              : null;
          })()
        : null,
  }));

  res.json(enriched);
});

// ─── POST /api/favorites ──────────────────────────────────────────────────────
router.post("/favorites", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const {
    type, sectorId, articleUrl, articleTitle,
    articleDescription, articleSource, articleImage, articleCategory,
  } = req.body as {
    type: string; sectorId?: number; articleUrl?: string; articleTitle?: string;
    articleDescription?: string; articleSource?: string; articleImage?: string;
    articleCategory?: string;
  };

  if (!type || !["sector", "news"].includes(type)) {
    res.status(400).json({ error: "Tipo non valido (sector | news)" });
    return;
  }

  if (type === "sector" && sectorId) {
    const [existing] = await db
      .select()
      .from(userFavoritesTable)
      .where(and(eq(userFavoritesTable.userId, userId), eq(userFavoritesTable.sectorId, sectorId)));
    if (existing) { res.json(existing); return; }
  }

  if (type === "news" && articleUrl) {
    const [existing] = await db
      .select()
      .from(userFavoritesTable)
      .where(and(eq(userFavoritesTable.userId, userId), eq(userFavoritesTable.articleUrl, articleUrl)));
    if (existing) { res.json(existing); return; }
  }

  const [fav] = await db.insert(userFavoritesTable).values({
    userId,
    type,
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

// ─── DELETE /api/favorites/:id ────────────────────────────────────────────────
router.delete("/favorites/:id", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [existing] = await db
    .select({ userId: userFavoritesTable.userId })
    .from(userFavoritesTable)
    .where(eq(userFavoritesTable.id, id));

  if (!existing || existing.userId !== userId) {
    res.status(404).json({ error: "Preferito non trovato" });
    return;
  }

  await db.delete(userFavoritesTable).where(eq(userFavoritesTable.id, id));
  res.json({ ok: true });
});

export default router;
