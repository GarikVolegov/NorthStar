import { Router } from "express";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db, growthArticlesTable, testSessionsTable } from "@workspace/db";
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

type GrowthPersonalization = "profile" | "generic";

const RIASEC_LABELS: Record<string, string> = {
  R: "Realistico",
  I: "Investigativo",
  A: "Artistico",
  S: "Sociale",
  E: "Imprenditoriale",
  C: "Convenzionale",
};

const RIASEC_CODES_BY_LABEL = Object.entries(RIASEC_LABELS).reduce<Record<string, string>>(
  (acc, [code, label]) => {
    acc[label.toLowerCase()] = code;
    return acc;
  },
  {},
);

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

function normalizeProfileTypes(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((type): type is string => typeof type === "string" && type.trim().length > 0)
    .map((type) => type.trim())
    .slice(0, 3);
}

function inferTypesFromScores(scores: unknown): string[] {
  if (!scores || typeof scores !== "object" || Array.isArray(scores)) return [];
  return Object.entries(scores as Record<string, unknown>)
    .map(([type, rawScore]) => [type.toUpperCase(), Number(rawScore)] as const)
    .filter(([type, score]) => type in RIASEC_LABELS && Number.isFinite(score) && score > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([type]) => type);
}

function toItalianTypes(types: string[]): string[] {
  return types.map((type) => RIASEC_LABELS[type] ?? type);
}

function toComparableTypeSet(types: string[]): Set<string> {
  const comparable = new Set<string>();
  for (const type of types) {
    const normalized = type.trim().toLowerCase();
    if (!normalized) continue;
    comparable.add(normalized);
    const code = RIASEC_CODES_BY_LABEL[normalized];
    if (code) comparable.add(code.toLowerCase());
    const label = RIASEC_LABELS[type.toUpperCase()];
    if (label) comparable.add(label.toLowerCase());
  }
  return comparable;
}

function scoreArticleForProfile(
  article: typeof growthArticlesTable.$inferSelect,
  profileTypes: Set<string>,
): number {
  const matches = Array.isArray(article.personalityMatches) ? article.personalityMatches : [];
  return matches.reduce((score, match) => {
    if (typeof match !== "string") return score;
    return profileTypes.has(match.trim().toLowerCase()) ? score + 1 : score;
  }, 0);
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
    let types: string[] = [];
    if (req.user?.id) {
      const [latestSession] = await db
        .select({
          primaryTypes: testSessionsTable.primaryTypes,
          riasecScores: testSessionsTable.riasecScores,
        })
        .from(testSessionsTable)
        .where(eq(testSessionsTable.userId, req.user.id))
        .orderBy(desc(testSessionsTable.createdAt))
        .limit(1);

      types = normalizeProfileTypes(latestSession?.primaryTypes);
      if (types.length === 0) {
        types = inferTypesFromScores(latestSession?.riasecScores);
      }
    }

    const hasProfile = types.length > 0;
    const articles = await db
      .select()
      .from(growthArticlesTable)
      .where(eq(growthArticlesTable.status, "published"))
      .orderBy(desc(growthArticlesTable.updatedAt))
      .limit(hasProfile ? 24 : 6);

    const comparableTypes = toComparableTypeSet(types);
    const sortedArticles = hasProfile
      ? [...articles].sort((a, b) => {
          const matchDelta =
            scoreArticleForProfile(b, comparableTypes) - scoreArticleForProfile(a, comparableTypes);
          if (matchDelta !== 0) return matchDelta;
          return (b.updatedAt?.getTime?.() ?? 0) - (a.updatedAt?.getTime?.() ?? 0);
        })
      : articles;

    res.json({
      articles: sortedArticles.slice(0, 6).map(mapArticle),
      hasProfile,
      personalization: (hasProfile ? "profile" : "generic") satisfies GrowthPersonalization,
      types,
      italianTypes: toItalianTypes(types),
    });
  } catch (err) {
    req.log?.error?.({ err }, "growth personalized error");
    res.status(503).json({
      articles: [],
      hasProfile: false,
      personalization: "generic" satisfies GrowthPersonalization,
      types: [],
      italianTypes: [],
      status: "error",
      error: "growth_unavailable",
    });
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

    res.json({
      articles: articles.map(mapArticle),
      total: articles.length,
      status: articles.length > 0 ? "ok" : "empty",
    });
  } catch (err) {
    req.log?.error?.({ err }, "growth list error");
    res.status(503).json({
      articles: [],
      total: 0,
      status: "error",
      error: "growth_unavailable",
      message: "Errore nel caricamento degli articoli",
    });
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
