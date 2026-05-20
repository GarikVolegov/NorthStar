import { Router, type Request, type Response } from "express";
import { auditLogTable, db, growthArticlesTable } from "@workspace/db";
import { and, desc, eq, ilike, ne, or, sql, type SQL } from "drizzle-orm";
import { rootLogger } from "../../middleware/logger";
import { getRequestBody } from "../../lib/request-context";
import { asPlainRecord, isOneOf } from "../../lib/type-guards";

const router = Router();

function getLimit(req: Request, fallback = 100, max = 200) {
  return Math.max(1, Math.min(Number(req.query.limit) || fallback, max));
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function integerValue(value: unknown, fallback = 0) {
  const n = Math.round(typeof value === "number" ? value : Number(value));
  return Number.isFinite(n) ? n : fallback;
}

function arrayValue(value: unknown): string[] {
  if (Array.isArray(value))
    return Array.from(
      new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean)),
    );
  if (typeof value === "string")
    return Array.from(
      new Set(
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
  return [];
}

function enumValue<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number],
) {
  const normalized = stringValue(value, fallback);
  return isOneOf(normalized, allowed) ? normalized : fallback;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

const ARTICLE_DIFFICULTIES = ["base", "intermedio", "avanzato"] as const;

const GROWTH_QUEUE_STATUSES = [
  "draft",
  "pending",
  "published",
  "rejected",
] as const;
type GrowthQueueStatus = (typeof GROWTH_QUEUE_STATUSES)[number];

function normalizeGrowthArticlePayload(
  input: unknown,
  current?: typeof growthArticlesTable.$inferSelect,
) {
  const raw = asPlainRecord(input);
  const title = stringValue(raw.title, current?.title ?? "");
  const fields: Record<string, string> = {};
  const payload = {
    title,
    slug: slugify(stringValue(raw.slug, current?.slug ?? "") || title),
    category: stringValue(raw.category, current?.category ?? ""),
    subcategory:
      stringValue(raw.subcategory, current?.subcategory ?? "") || null,
    description: stringValue(raw.description, current?.description ?? ""),
    content: stringValue(raw.content, current?.content ?? ""),
    tags: raw.tags === undefined ? (current?.tags ?? []) : arrayValue(raw.tags),
    difficulty: enumValue(
      raw.difficulty,
      ARTICLE_DIFFICULTIES,
      isOneOf(current?.difficulty, ARTICLE_DIFFICULTIES)
        ? current.difficulty
        : "base",
    ),
    personalityMatches:
      raw.personalityMatches === undefined
        ? (current?.personalityMatches ?? [])
        : arrayValue(raw.personalityMatches),
    sectorLinks:
      raw.sectorLinks === undefined
        ? (current?.sectorLinks ?? [])
        : arrayValue(raw.sectorLinks),
    status: enumValue(
      raw.status,
      GROWTH_QUEUE_STATUSES,
      (current?.status as GrowthQueueStatus) ?? "draft",
    ),
    readTimeMinutes: Math.max(
      1,
      integerValue(raw.readTimeMinutes, current?.readTimeMinutes ?? 3),
    ),
  };
  if (!payload.title) fields.title = "Titolo obbligatorio.";
  if (!payload.slug) fields.slug = "Slug obbligatorio.";
  if (!payload.category) fields.category = "Categoria obbligatoria.";
  if (!payload.description) fields.description = "Descrizione obbligatoria.";
  if (!payload.content || payload.content.length < 40)
    fields.content = "Contenuto obbligatorio, almeno 40 caratteri.";
  return { ok: Object.keys(fields).length === 0, fields, payload };
}

type GrowthArticlePreviewInput = Pick<
  typeof growthArticlesTable.$inferSelect,
  | "title"
  | "slug"
  | "category"
  | "subcategory"
  | "description"
  | "content"
  | "tags"
  | "difficulty"
  | "readTimeMinutes"
  | "status"
>;

function previewGrowthArticle(article: GrowthArticlePreviewInput) {
  return {
    title: article.title,
    slug: article.slug,
    url: article.slug ? `/crescita/articolo/${article.slug}` : "",
    category: article.category,
    subcategory: article.subcategory ?? null,
    description: article.description,
    content: article.content,
    tags: article.tags ?? [],
    difficulty: article.difficulty,
    readTimeMinutes: article.readTimeMinutes,
    status: article.status,
  };
}

async function ensureGrowthArticleSlug(slug: string, articleId: number) {
  if (!slug) return {};
  const [existing] = await db
    .select({ id: growthArticlesTable.id })
    .from(growthArticlesTable)
    .where(
      and(
        eq(growthArticlesTable.slug, slug),
        ne(growthArticlesTable.id, articleId),
      ),
    )
    .limit(1);
  return existing ? { slug: "Slug gia usato da un altro articolo." } : {};
}

async function writeGrowthArticleAudit(
  req: Request,
  action: string,
  articleId: number,
  metadata: Record<string, unknown>,
) {
  await db.insert(auditLogTable).values({
    actorId: req.user?.id ?? null,
    targetId: null,
    action,
    category: "admin_action",
    metadata: { articleId, workflow: "growth_queue", ...metadata },
  });
}

router.get("/growth-queue", async (req: Request, res: Response) => {
  try {
    const limit = getLimit(req, 50, 100);
    const status = stringValue(req.query.status, "all");
    const query = stringValue(req.query.search);
    const search = `%${query}%`;
    const where: SQL[] = [
      isOneOf(status, GROWTH_QUEUE_STATUSES)
        ? eq(growthArticlesTable.status, status)
        : undefined,
      query
        ? or(
            ilike(growthArticlesTable.title, search),
            ilike(growthArticlesTable.slug, search),
            ilike(growthArticlesTable.category, search),
            ilike(growthArticlesTable.description, search),
          )
        : undefined,
    ].filter((condition): condition is SQL => Boolean(condition));
    const [queue, stats] = await Promise.all([
      db
        .select()
        .from(growthArticlesTable)
        .where(where.length ? and(...where) : undefined)
        .orderBy(desc(growthArticlesTable.updatedAt))
        .limit(limit),
      db
        .select({
          status: growthArticlesTable.status,
          count: sql<number>`count(*)::int`,
        })
        .from(growthArticlesTable)
        .groupBy(growthArticlesTable.status),
    ]);

    const byStatus = Object.fromEntries(
      stats.map((row) => [row.status, Number(row.count) || 0]),
    );
    res.json({
      generatedAt: new Date().toISOString(),
      queue,
      stats: {
        draft: byStatus.draft ?? 0,
        pending: byStatus.pending ?? 0,
        published: byStatus.published ?? 0,
        rejected: byStatus.rejected ?? 0,
        total: GROWTH_QUEUE_STATUSES.reduce(
          (sum, key) => sum + (byStatus[key] ?? 0),
          0,
        ),
      },
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/growth-queue] error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/growth-queue/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID articolo non valido" });
    return;
  }

  try {
    const [article] = await db
      .select()
      .from(growthArticlesTable)
      .where(eq(growthArticlesTable.id, id))
      .limit(1);
    if (!article) {
      res.status(404).json({ error: "Articolo non trovato" });
      return;
    }
    const auditTrail = await db
      .select()
      .from(auditLogTable)
      .where(
        and(
          eq(auditLogTable.category, "admin_action"),
          sql`${auditLogTable.metadata}->>'workflow' = 'growth_queue'`,
          sql`${auditLogTable.metadata}->>'articleId' = ${String(id)}`,
        ),
      )
      .orderBy(desc(auditLogTable.createdAt))
      .limit(30);
    res.json({ article, preview: previewGrowthArticle(article), auditTrail });
  } catch (err) {
    rootLogger.error({ err, id }, "[admin/growth-queue] detail error");
    res.status(500).json({ error: String(err) });
  }
});

router.patch("/growth-queue/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID articolo non valido" });
    return;
  }

  try {
    const body = asPlainRecord(getRequestBody(req));
    const [current] = await db
      .select()
      .from(growthArticlesTable)
      .where(eq(growthArticlesTable.id, id))
      .limit(1);
    if (!current) {
      res.status(404).json({ error: "Articolo non trovato" });
      return;
    }
    const validation = normalizeGrowthArticlePayload(
      body.payload ?? body,
      current,
    );
    const fields = {
      ...validation.fields,
      ...(validation.ok
        ? await ensureGrowthArticleSlug(validation.payload.slug, id)
        : {}),
    };
    if (Object.keys(fields).length > 0) {
      res.status(400).json({ error: "Articolo crescita non valido", fields });
      return;
    }
    const [article] = await db
      .update(growthArticlesTable)
      .set({ ...validation.payload, updatedAt: new Date() })
      .where(eq(growthArticlesTable.id, id))
      .returning();
    if (!article) {
      res.status(500).json({ error: "Aggiornamento articolo non riuscito" });
      return;
    }
    await writeGrowthArticleAudit(req, "growth_article_updated", id, {
      previousStatus: current.status,
      nextStatus: article.status,
      notes: stringValue(body.notes) || null,
    });
    res.json({ ok: true, article, preview: previewGrowthArticle(article) });
  } catch (err) {
    rootLogger.error({ err, id }, "[admin/growth-queue] update error");
    res.status(500).json({ error: String(err) });
  }
});

router.post(
  "/growth-queue/:id/preview",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "ID articolo non valido" });
      return;
    }

    try {
      const body = asPlainRecord(getRequestBody(req));
      const [current] = await db
        .select()
        .from(growthArticlesTable)
        .where(eq(growthArticlesTable.id, id))
        .limit(1);
      if (!current) {
        res.status(404).json({ error: "Articolo non trovato" });
        return;
      }
      const validation = normalizeGrowthArticlePayload(
        body.payload ?? body,
        current,
      );
      if (!validation.ok) {
        res.status(400).json({
          error: "Articolo crescita non valido",
          fields: validation.fields,
        });
        return;
      }
      res.json({
        ok: true,
        preview: previewGrowthArticle(validation.payload),
        payload: validation.payload,
      });
    } catch (err) {
      rootLogger.error({ err, id }, "[admin/growth-queue] preview error");
      res.status(500).json({ error: String(err) });
    }
  },
);

router.post(
  "/growth-queue/:id/publish",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "ID articolo non valido" });
      return;
    }

    try {
      const body = asPlainRecord(getRequestBody(req));
      const [current] = await db
        .select()
        .from(growthArticlesTable)
        .where(eq(growthArticlesTable.id, id))
        .limit(1);
      if (!current) {
        res.status(404).json({ error: "Articolo non trovato" });
        return;
      }
      const validation = normalizeGrowthArticlePayload(
        { ...current, status: "published" },
        current,
      );
      const fields = {
        ...validation.fields,
        ...(validation.ok
          ? await ensureGrowthArticleSlug(validation.payload.slug, id)
          : {}),
      };
      if (Object.keys(fields).length > 0) {
        res.status(400).json({ error: "Articolo non pubblicabile", fields });
        return;
      }
      const [article] = await db
        .update(growthArticlesTable)
        .set({
          ...validation.payload,
          status: "published",
          updatedAt: new Date(),
        })
        .where(eq(growthArticlesTable.id, id))
        .returning();
      if (!article) {
        res.status(500).json({ error: "Pubblicazione articolo non riuscita" });
        return;
      }
      await writeGrowthArticleAudit(req, "growth_article_published", id, {
        previousStatus: current.status,
        nextStatus: article.status,
        notes: stringValue(body.notes) || null,
      });
      res.json({ ok: true, article, preview: previewGrowthArticle(article) });
    } catch (err) {
      rootLogger.error({ err, id }, "[admin/growth-queue] publish error");
      res.status(500).json({ error: String(err) });
    }
  },
);

router.post("/growth-queue/:id/reject", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const body = asPlainRecord(getRequestBody(req));
  const reason = stringValue(body.reason);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID articolo non valido" });
    return;
  }
  if (reason.length < 3) {
    res.status(400).json({
      error: "Motivo rifiuto obbligatorio",
      fields: { reason: "Inserisci un motivo di almeno 3 caratteri." },
    });
    return;
  }

  try {
    const [current] = await db
      .select()
      .from(growthArticlesTable)
      .where(eq(growthArticlesTable.id, id))
      .limit(1);
    if (!current) {
      res.status(404).json({ error: "Articolo non trovato" });
      return;
    }
    const [article] = await db
      .update(growthArticlesTable)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(growthArticlesTable.id, id))
      .returning();
    if (!article) {
      res.status(500).json({ error: "Rifiuto articolo non riuscito" });
      return;
    }
    await writeGrowthArticleAudit(req, "growth_article_rejected", id, {
      previousStatus: current.status,
      nextStatus: article.status,
      reason,
    });
    res.json({ ok: true, article, preview: previewGrowthArticle(article) });
  } catch (err) {
    rootLogger.error({ err, id }, "[admin/growth-queue] reject error");
    res.status(500).json({ error: String(err) });
  }
});

export default router;
