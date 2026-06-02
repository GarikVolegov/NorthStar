import { Router } from "express";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db, growthArticlesTable, testSessionsTable } from "@workspace/db";
import { optionalAuth } from "../middleware/auth";
import { requireAuth } from "../middleware/require-auth";
import { clampContentLimit, readContentSearchQuery } from "../lib/content-search";
import {
  buildDiscoveryMetadata,
  type DiscoveryPersonalization,
} from "../lib/content-discovery";

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
type GrowthSource = "library" | "fallback";

type GrowthArticleView = {
  id: number;
  title: string;
  slug: string;
  category: string;
  subcategory: string | null;
  description: string;
  content: string;
  tags: string[];
  difficulty: string;
  personalityMatches: string[];
  sectorLinks: string[];
  readTimeMinutes: number;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
  source?: GrowthSource;
};

const FALLBACK_UPDATED_AT = new Date("2026-05-01T00:00:00.000Z");

const FALLBACK_GROWTH_ARTICLES: GrowthArticleView[] = [
  {
    id: -101,
    title: "Piano di crescita in 90 giorni",
    slug: "piano-crescita-90-giorni",
    category: "crescita-professionale",
    subcategory: "percorso",
    description: "Un percorso pratico in italiano per trasformare un obiettivo in azioni settimanali misurabili.",
    content:
      "Questo percorso non e personalizzato: usalo come base quando la libreria NorthStar non ha ancora contenuti disponibili.\n\nSettimane 1-2: scegli un obiettivo osservabile e scrivi perche conta nel tuo percorso.\n\nSettimane 3-6: dedica due blocchi da 45 minuti a settimana a studio, esercizio o portfolio.\n\nSettimane 7-10: raccogli feedback da una persona competente e correggi il piano.\n\nSettimane 11-13: prepara una prova concreta del lavoro fatto: pagina portfolio, candidatura, colloquio simulato o progetto breve.",
    tags: ["crescita", "percorso", "obiettivi"],
    difficulty: "base",
    personalityMatches: [],
    sectorLinks: [],
    readTimeMinutes: 6,
    viewCount: 0,
    createdAt: FALLBACK_UPDATED_AT,
    updatedAt: FALLBACK_UPDATED_AT,
    source: "fallback",
  },
  {
    id: -102,
    title: "Routine di focus per studiare e lavorare meglio",
    slug: "routine-focus-studio-lavoro",
    category: "produttivita",
    subcategory: "focus",
    description: "Una guida semplice per proteggere attenzione, energia e continuita durante la settimana.",
    content:
      "Parti da una routine leggera: scegli una fascia oraria stabile, elimina una distrazione ricorrente e definisci il risultato minimo prima di iniziare.\n\nOgni sessione ha tre parti: cinque minuti per preparare, venticinque minuti di lavoro senza cambio contesto, cinque minuti per annotare il prossimo passo.\n\nDopo una settimana guarda i dati: quante sessioni hai completato, quale ostacolo torna spesso, quale modifica rende piu facile ripartire.",
    tags: ["crescita", "focus", "produttivita"],
    difficulty: "base",
    personalityMatches: [],
    sectorLinks: [],
    readTimeMinutes: 4,
    viewCount: 0,
    createdAt: FALLBACK_UPDATED_AT,
    updatedAt: FALLBACK_UPDATED_AT,
    source: "fallback",
  },
  {
    id: -103,
    title: "Diario decisionale per scegliere con piu lucidita",
    slug: "diario-decisionale-lucidita",
    category: "autoconsapevolezza",
    subcategory: "decisioni",
    description: "Uno schema recuperabile per collegare scelte, motivazioni, rischi e prossime azioni.",
    content:
      "Quando devi scegliere, scrivi quattro righe: opzione, motivo, rischio, prossimo esperimento.\n\nNon cercare la risposta perfetta. Cerca una prova piccola che riduca l'incertezza: parlare con qualcuno, leggere una fonte, provare un compito reale, visitare un corso.\n\nRileggi il diario dopo sette giorni e aggiorna la decisione con quello che hai scoperto.",
    tags: ["crescita", "autoconsapevolezza", "decisioni"],
    difficulty: "base",
    personalityMatches: [],
    sectorLinks: [],
    readTimeMinutes: 3,
    viewCount: 0,
    createdAt: FALLBACK_UPDATED_AT,
    updatedAt: FALLBACK_UPDATED_AT,
    source: "fallback",
  },
];

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

function mapArticle(
  article: typeof growthArticlesTable.$inferSelect | GrowthArticleView,
  options: { personalization?: Extract<DiscoveryPersonalization, GrowthPersonalization> } = {},
) {
  const source: GrowthSource = "source" in article && article.source ? article.source : "library";
  const tags = article.tags ?? [];
  const personalityMatches = article.personalityMatches ?? [];
  const sectorLinks = article.sectorLinks ?? [];
  const scoreSemantic = "embedding" in article && article.embedding ? 0.75 : null;
  const discovery = buildDiscoveryMetadata(
    {
      title: article.title,
      description: article.description,
      source,
      type: "article",
      category: article.category,
      tags,
      metadata: {
        category: article.category,
        tags,
        personalityMatches,
        sectorLinks,
        readingTime: article.readTimeMinutes,
      },
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      scoreLexical: 1,
      scoreSemantic,
      readingTime: article.readTimeMinutes,
      visibility: "public",
    },
    {
      source,
      visibility: "public",
      maxReasons: 8,
    },
  );

  const discoveryMetadata = {
    ...discovery,
    personalization: options.personalization ?? "generic",
  };

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
    ...discoveryMetadata,
  };
}

function fallbackCategories() {
  const counts = FALLBACK_GROWTH_ARTICLES.reduce<Record<string, number>>((acc, article) => {
    acc[article.category] = (acc[article.category] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts).map(([category, count]) => ({
    id: category,
    label: CATEGORY_LABELS[category] ?? category.replace(/-/g, " "),
    description: `Percorsi pratici in italiano per ${category.replace(/-/g, " ")}.`,
    count,
    source: "fallback" satisfies GrowthSource,
  }));
}

function filterFallbackArticles(input: {
  category?: string;
  search?: string;
  difficulty?: string;
  tag?: string;
  limit: number;
}) {
  const search = input.search?.trim().toLowerCase();
  const tag = input.tag?.trim().toLowerCase();
  return FALLBACK_GROWTH_ARTICLES.filter((article) => {
    if (input.category && article.category !== input.category) return false;
    if (input.difficulty && article.difficulty !== input.difficulty) return false;
    if (tag && !article.tags.some((articleTag) => articleTag.toLowerCase().includes(tag))) return false;
    if (!search) return true;
    const searchable = [
      article.title,
      article.description,
      article.content,
      article.category,
      ...article.tags,
      ...article.personalityMatches,
      ...article.sectorLinks,
    ]
      .join(" ")
      .toLowerCase();
    return searchable.includes(search);
  }).slice(0, input.limit);
}

function fallbackArticleBySlug(slug: string) {
  return FALLBACK_GROWTH_ARTICLES.find((article) => article.slug === slug);
}

async function hasPublishedGrowthArticles(): Promise<boolean> {
  const rows = await db
    .select({ id: growthArticlesTable.id })
    .from(growthArticlesTable)
    .where(eq(growthArticlesTable.status, "published"))
    .limit(1);

  return rows.length > 0;
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

    if (rows.length === 0) {
      res.json(fallbackCategories());
      return;
    }

    res.json(
      rows.map((row) => ({
        id: row.category,
        label: CATEGORY_LABELS[row.category] ?? row.category.replace(/-/g, " "),
        description: `Guide e strumenti per ${row.category.replace(/-/g, " ")}.`,
        count: Number(row.count) || 0,
        source: "library" satisfies GrowthSource,
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
    const source: GrowthSource = articles.length > 0 ? "library" : "fallback";
    const candidateArticles = articles.length > 0 ? articles : FALLBACK_GROWTH_ARTICLES;
    const sortedArticles = hasProfile && source === "library"
      ? [...articles].sort((a, b) => {
          const matchDelta =
            scoreArticleForProfile(b, comparableTypes) - scoreArticleForProfile(a, comparableTypes);
          if (matchDelta !== 0) return matchDelta;
          return (b.updatedAt?.getTime?.() ?? 0) - (a.updatedAt?.getTime?.() ?? 0);
        })
      : candidateArticles;

    const articlePersonalization: GrowthPersonalization =
      hasProfile && source === "library" ? "profile" : "generic";

    res.json({
      articles: sortedArticles.slice(0, 6).map((article) =>
        mapArticle(article, { personalization: articlePersonalization }),
      ),
      hasProfile,
      personalization: articlePersonalization,
      types,
      italianTypes: toItalianTypes(types),
      status: source === "library" ? "ok" : "fallback",
      source,
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
    const rawDifficulty =
      typeof req.query.difficulty === "string" ? req.query.difficulty.trim() : "";
    const difficulty = rawDifficulty && rawDifficulty !== "all" ? rawDifficulty : "";
    const tag = typeof req.query.tag === "string" ? req.query.tag.trim() : "";
    const search = readContentSearchQuery(req.query as Record<string, string | string[] | undefined>);
    const where = [
      eq(growthArticlesTable.status, "published"),
      category ? eq(growthArticlesTable.category, category) : undefined,
      difficulty ? eq(growthArticlesTable.difficulty, difficulty) : undefined,
      tag ? sql`${growthArticlesTable.tags}::text ILIKE ${`%${tag}%`}` : undefined,
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

    if (articles.length === 0) {
      if ((category || search || difficulty || tag) && await hasPublishedGrowthArticles()) {
        res.json({
          articles: [],
          total: 0,
          status: "empty",
          source: "library" satisfies GrowthSource,
        });
        return;
      }

      const fallbackArticles = filterFallbackArticles({ category, search, difficulty, tag, limit });
      res.json({
        articles: fallbackArticles.map((article) => mapArticle(article, { personalization: "generic" })),
        total: fallbackArticles.length,
        status: fallbackArticles.length > 0 ? "fallback" : "empty",
        source: "fallback" satisfies GrowthSource,
      });
      return;
    }

    res.json({
      articles: articles.map((article) => mapArticle(article)),
      total: articles.length,
      status: "ok",
      source: "library" satisfies GrowthSource,
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
      const fallback = fallbackArticleBySlug(req.params.slug);
      if (fallback) {
        const related = FALLBACK_GROWTH_ARTICLES.filter((item) => item.id !== fallback.id)
          .slice(0, 3)
          .map((article) => mapArticle(article, { personalization: "generic" }));
        res.json({
          ...mapArticle(fallback, { personalization: "generic" }),
          related,
          source: "fallback" satisfies GrowthSource,
        });
        return;
      }
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
        .map((article) => mapArticle(article)),
    });
  } catch (err) {
    req.log?.error?.({ err }, "growth article error");
    res.status(500).json({ error: "Errore nel caricamento dell'articolo" });
  }
});

export default router;
