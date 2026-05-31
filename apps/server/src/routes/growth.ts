import { Router } from "express";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db, growthArticlesTable } from "@workspace/db";
import { optionalAuth } from "../middleware/auth";
import { requireAuth } from "../middleware/require-auth";
import { clampContentLimit, readContentSearchQuery } from "../lib/content-search";

const router = Router();

const CATEGORY_LABELS: Record<string, string> = {
  "crescita-professionale": "Crescita professionale",
  "benessere-mentale": "Benessere mentale",
  autoconsapevolezza: "Autoconsapevolezza",
  produttivita: "Produttivita",
  leadership: "Leadership",
  business: "Business",
};

function isSql(condition: SQL | undefined): condition is SQL {
  return condition !== undefined;
}

function mapArticle(article: typeof growthArticlesTable.$inferSelect) {
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    category: article.category,
    subcategory: article.subcategory,
    description: article.description,
    content: article.content,
    tags: article.tags ?? [],
    difficulty: article.difficulty,
    personalityMatches: article.personalityMatches ?? [],
    sectorLinks: article.sectorLinks ?? [],
    readTimeMinutes: article.readTimeMinutes,
    viewCount: article.viewCount,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
  };
}

router.get("/categorie", async (_req, res) => {
  try {
    const rows = await db
      .select({
        category: growthArticlesTable.category,
        count: sql<number>`count(*)::int`,
      })
      .from(growthArticlesTable)
      .where(eq(growthArticlesTable.status, "published"))
      .groupBy(growthArticlesTable.category);

    res.json(
      rows.map((row) => ({
        id: row.category,
        label: CATEGORY_LABELS[row.category] ?? row.category.replace(/-/g, " "),
        description: `Guide e strumenti per ${row.category.replace(/-/g, " ")}.`,
        count: Number(row.count) || 0,
      })),
    );
  } catch (err) {
    _req.log?.error?.({ err }, "growth categories error");
    res.status(500).json({ error: "Errore nel caricamento delle categorie" });
  }
});

router.get("/per-te", optionalAuth, async (req, res) => {
  try {
    const articles = await db
      .select()
      .from(growthArticlesTable)
      .where(eq(growthArticlesTable.status, "published"))
      .orderBy(desc(growthArticlesTable.updatedAt))
      .limit(6);
    res.json({
      articles: articles.map(mapArticle),
      hasProfile: !!req.user || articles.length > 0,
      types: [],
      italianTypes: [],
    });
  } catch (err) {
    req.log?.error?.({ err }, "growth personalized error");
    res.status(500).json({ articles: [], hasProfile: false, types: [], italianTypes: [] });
  }
});

router.get("/", async (req, res) => {
  try {
    const limit = clampContentLimit(req.query.limit as string | undefined, 20, 100);
    const category =
      typeof req.query.category === "string" ? req.query.category : "";
    const search = readContentSearchQuery(req.query as Record<string, string | string[] | undefined>);
    const where = [
      eq(growthArticlesTable.status, "published"),
      category ? eq(growthArticlesTable.category, category) : undefined,
      search
        ? or(
            ilike(growthArticlesTable.title, `%${search}%`),
            ilike(growthArticlesTable.description, `%${search}%`),
            sql`${growthArticlesTable.content} ILIKE ${`%${search}%`}`,
            sql`${growthArticlesTable.tags}::text ILIKE ${`%${search}%`}`,
            sql`${growthArticlesTable.personalityMatches}::text ILIKE ${`%${search}%`}`,
            sql`${growthArticlesTable.sectorLinks}::text ILIKE ${`%${search}%`}`,
          )
        : undefined,
    ].filter(isSql);

    const articles = await db
      .select()
      .from(growthArticlesTable)
      .where(and(...where))
      .orderBy(desc(growthArticlesTable.updatedAt))
      .limit(limit);

    res.json({ articles: articles.map(mapArticle), total: articles.length });
  } catch (err) {
    req.log?.error?.({ err }, "growth list error");
    res.status(500).json({ error: "Errore nel caricamento degli articoli" });
  }
});

router.post("/:id/salva", requireAuth(), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }
  res.json({ saved: true });
});

router.get("/:slug", async (req, res) => {
  try {
    const [article] = await db
      .select()
      .from(growthArticlesTable)
      .where(
        and(
          eq(growthArticlesTable.slug, req.params.slug),
          eq(growthArticlesTable.status, "published"),
        ),
      )
      .limit(1);
    if (!article) {
      res.status(404).json({ error: "Articolo non trovato" });
      return;
    }
    await db
      .update(growthArticlesTable)
      .set({ viewCount: (article.viewCount ?? 0) + 1 })
      .where(eq(growthArticlesTable.id, article.id));
    const related = await db
      .select()
      .from(growthArticlesTable)
      .where(
        and(
          eq(growthArticlesTable.status, "published"),
          eq(growthArticlesTable.category, article.category),
        ),
      )
      .orderBy(desc(growthArticlesTable.updatedAt))
      .limit(4);
    res.json({
      ...mapArticle(article),
      related: related
        .filter((item) => item.id !== article.id)
        .slice(0, 3)
        .map(mapArticle),
    });
  } catch (err) {
    req.log?.error?.({ err }, "growth article error");
    res.status(500).json({ error: "Errore nel caricamento dell'articolo" });
  }
});

export default router;
