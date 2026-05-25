import { Router, type Request, type Response } from "express";
import {
  adminCatalogDraftsTable,
  auditLogTable,
  db,
  educationPathsTable,
  growthArticlesTable,
  professionsTable,
  sectorsTable,
} from "@workspace/db";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { rootLogger } from "../../middleware/logger";
import { getRequestBody } from "../../lib/request-context";
import { asPlainRecord, isOneOf } from "../../lib/type-guards";
import {
  CATALOG_LABELS,
  CATALOG_TYPES,
  emptyCatalogList,
  emptyCatalogOverview,
  ensureCatalogReferences,
  findPublishDraft,
  getCatalogEntity,
  getCatalogRows,
  previewCatalogPayload,
  publishCatalogDraft,
  validateCatalogPayload,
  writeCatalogAudit,
  stringValue,
  type CatalogType,
} from "./shared/catalogs";

const router = Router();

function getLimit(req: Request, fallback = 100, max = 200) {
  return Math.max(1, Math.min(Number(req.query.limit) || fallback, max));
}

router.get("/catalogs/overview", async (_req: Request, res: Response) => {
  try {
    const [
      sectorsTotal,
      sectorsArchived,
      professionsTotal,
      professionsArchived,
      pathsTotal,
      pathsArchived,
      articlesTotal,
      articlesPublished,
      articlesArchived,
      draftRows,
    ] = await Promise.all([
      db.select({ count: count() }).from(sectorsTable),
      db
        .select({ count: count() })
        .from(sectorsTable)
        .where(eq(sectorsTable.isActive, false)),
      db.select({ count: count() }).from(professionsTable),
      db
        .select({ count: count() })
        .from(professionsTable)
        .where(eq(professionsTable.isActive, false)),
      db.select({ count: count() }).from(educationPathsTable),
      db
        .select({ count: count() })
        .from(educationPathsTable)
        .where(eq(educationPathsTable.isActive, false)),
      db.select({ count: count() }).from(growthArticlesTable),
      db
        .select({ count: count() })
        .from(growthArticlesTable)
        .where(eq(growthArticlesTable.status, "published")),
      db
        .select({ count: count() })
        .from(growthArticlesTable)
        .where(eq(growthArticlesTable.status, "archived")),
      db
        .select({
          catalogType: adminCatalogDraftsTable.catalogType,
          count: count(),
        })
        .from(adminCatalogDraftsTable)
        .where(eq(adminCatalogDraftsTable.status, "draft"))
        .groupBy(adminCatalogDraftsTable.catalogType),
    ]);

    const draftCounts = Object.fromEntries(
      draftRows.map((row) => [row.catalogType, Number(row.count)]),
    );
    res.json({
      generatedAt: new Date().toISOString(),
      items: [
        {
          type: "sectors",
          label: CATALOG_LABELS.sectors,
          total: Number(sectorsTotal[0]?.count ?? 0),
          active:
            Number(sectorsTotal[0]?.count ?? 0) -
            Number(sectorsArchived[0]?.count ?? 0),
          archived: Number(sectorsArchived[0]?.count ?? 0),
          drafts: draftCounts.sectors ?? 0,
        },
        {
          type: "professions",
          label: CATALOG_LABELS.professions,
          total: Number(professionsTotal[0]?.count ?? 0),
          active:
            Number(professionsTotal[0]?.count ?? 0) -
            Number(professionsArchived[0]?.count ?? 0),
          archived: Number(professionsArchived[0]?.count ?? 0),
          drafts: draftCounts.professions ?? 0,
        },
        {
          type: "education_paths",
          label: CATALOG_LABELS.education_paths,
          total: Number(pathsTotal[0]?.count ?? 0),
          active:
            Number(pathsTotal[0]?.count ?? 0) -
            Number(pathsArchived[0]?.count ?? 0),
          archived: Number(pathsArchived[0]?.count ?? 0),
          drafts: draftCounts.education_paths ?? 0,
        },
        {
          type: "growth_articles",
          label: CATALOG_LABELS.growth_articles,
          total: Number(articlesTotal[0]?.count ?? 0),
          active: Number(articlesPublished[0]?.count ?? 0),
          archived: Number(articlesArchived[0]?.count ?? 0),
          drafts: draftCounts.growth_articles ?? 0,
        },
      ],
    });
  } catch (err) {
    rootLogger.warn(
      { err },
      "[admin/catalogs/overview] returning empty overview after read failure",
    );
    res.json(emptyCatalogOverview("catalogs_overview_unavailable"));
  }
});

router.get("/catalogs/:type", async (req: Request, res: Response) => {
  const type = req.params.type;
  if (!isOneOf(type, CATALOG_TYPES)) {
    res.status(404).json({ error: "Catalogo non supportato" });
    return;
  }

  try {
    const limit = getLimit(req, 100, 500);
    const query = stringValue(req.query.search);
    const status = stringValue(req.query.status, "all");
    const [items, drafts] = await Promise.all([
      getCatalogRows(type, limit, query, status),
      db
        .select()
        .from(adminCatalogDraftsTable)
        .where(
          and(
            eq(adminCatalogDraftsTable.catalogType, type),
            eq(adminCatalogDraftsTable.status, "draft"),
          ),
        )
        .orderBy(desc(adminCatalogDraftsTable.updatedAt))
        .limit(100),
    ]);
    res.json({ type, label: CATALOG_LABELS[type], items, drafts });
  } catch (err) {
    rootLogger.warn(
      { err, type },
      "[admin/catalogs] returning empty list after read failure",
    );
    res.json(emptyCatalogList(type, "catalog_list_unavailable"));
  }
});

router.get("/catalogs/:type/:id", async (req: Request, res: Response) => {
  const type = req.params.type;
  const id = Number(req.params.id);
  if (!isOneOf(type, CATALOG_TYPES) || !Number.isFinite(id)) {
    res.status(400).json({ error: "Richiesta non valida" });
    return;
  }

  try {
    const [entity, drafts, auditTrail] = await Promise.all([
      getCatalogEntity(type, id),
      db
        .select()
        .from(adminCatalogDraftsTable)
        .where(
          and(
            eq(adminCatalogDraftsTable.catalogType, type),
            eq(adminCatalogDraftsTable.entityId, id),
          ),
        )
        .orderBy(desc(adminCatalogDraftsTable.updatedAt))
        .limit(20),
      db
        .select()
        .from(auditLogTable)
        .where(
          and(
            eq(auditLogTable.category, "admin_action"),
            sql`${auditLogTable.metadata}->>'catalogType' = ${type}`,
            sql`${auditLogTable.metadata}->>'entityId' = ${String(id)}`,
          ),
        )
        .orderBy(desc(auditLogTable.createdAt))
        .limit(20),
    ]);
    if (!entity) {
      res.status(404).json({ error: "Elemento non trovato" });
      return;
    }
    res.json({ type, entity, drafts, auditTrail });
  } catch (err) {
    rootLogger.error({ err, type, id }, "[admin/catalogs] detail error");
    res.status(500).json({ error: String(err) });
  }
});

async function saveCatalogDraft(
  req: Request,
  res: Response,
  type: CatalogType,
  entityId: number | null,
) {
  const body = asPlainRecord(getRequestBody(req));
  const basePayload = body.payload ?? body;
  const validation = validateCatalogPayload(type, basePayload);
  const referenceFields = validation.ok
    ? await ensureCatalogReferences(type, validation.payload, entityId)
    : {};
  const fields = { ...validation.fields, ...referenceFields };
  if (Object.keys(fields).length > 0) {
    res.status(400).json({ error: "Payload catalogo non valido", fields });
    return;
  }

  const [draft] = await db
    .insert(adminCatalogDraftsTable)
    .values({
      catalogType: type,
      entityId,
      payload: validation.payload,
      validation: { ok: true, fields: {} },
      notes: stringValue(body.notes) || null,
      createdBy: req.user?.id ?? null,
      updatedAt: new Date(),
    })
    .returning();
  if (!draft) {
    res.status(500).json({ error: "Creazione bozza non riuscita" });
    return;
  }

  await writeCatalogAudit(req, "catalog_draft_saved", type, {
    draftId: draft.id,
    entityId,
    notes: draft.notes,
  });
  res
    .status(201)
    .json({
      ok: true,
      draft,
      preview: previewCatalogPayload(type, validation.payload),
    });
}

router.post("/catalogs/:type/draft", async (req: Request, res: Response) => {
  const type = req.params.type;
  if (!isOneOf(type, CATALOG_TYPES)) {
    res.status(404).json({ error: "Catalogo non supportato" });
    return;
  }
  try {
    await saveCatalogDraft(req, res, type, null);
  } catch (err) {
    rootLogger.error({ err, type }, "[admin/catalogs] create draft error");
    res.status(500).json({ error: String(err) });
  }
});

router.post(
  "/catalogs/:type/:id/draft",
  async (req: Request, res: Response) => {
    const type = req.params.type;
    const id = Number(req.params.id);
    if (!isOneOf(type, CATALOG_TYPES) || !Number.isFinite(id)) {
      res.status(400).json({ error: "Richiesta non valida" });
      return;
    }
    try {
      const entity = await getCatalogEntity(type, id);
      if (!entity) {
        res.status(404).json({ error: "Elemento non trovato" });
        return;
      }
      await saveCatalogDraft(req, res, type, id);
    } catch (err) {
      rootLogger.error(
        { err, type, id },
        "[admin/catalogs] update draft error",
      );
      res.status(500).json({ error: String(err) });
    }
  },
);

router.post("/catalogs/:type/preview", async (req: Request, res: Response) => {
  const type = req.params.type;
  if (!isOneOf(type, CATALOG_TYPES)) {
    res.status(404).json({ error: "Catalogo non supportato" });
    return;
  }
  const body = asPlainRecord(getRequestBody(req));
  const validation = validateCatalogPayload(type, body.payload ?? body);
  if (!validation.ok) {
    res
      .status(400)
      .json({
        error: "Payload catalogo non valido",
        fields: validation.fields,
      });
    return;
  }
  res.json({
    ok: true,
    payload: validation.payload,
    preview: previewCatalogPayload(type, validation.payload),
  });
});

router.post(
  "/catalogs/:type/:id/publish",
  async (req: Request, res: Response) => {
    const type = req.params.type;
    const id = Number(req.params.id);
    if (!isOneOf(type, CATALOG_TYPES) || !Number.isFinite(id)) {
      res.status(400).json({ error: "Richiesta non valida" });
      return;
    }

    try {
      const body = asPlainRecord(getRequestBody(req));
      const draft = await findPublishDraft(type, id);
      if (!draft) {
        res.status(404).json({ error: "Bozza pubblicabile non trovata" });
        return;
      }
      const validation = validateCatalogPayload(type, draft.payload);
      const referenceFields = validation.ok
        ? await ensureCatalogReferences(
            type,
            validation.payload,
            draft.entityId,
          )
        : {};
      const fields = { ...validation.fields, ...referenceFields };
      if (Object.keys(fields).length > 0) {
        res.status(400).json({ error: "Bozza non valida", fields });
        return;
      }
      const entity = await publishCatalogDraft(type, draft);
      await db
        .update(adminCatalogDraftsTable)
        .set({
          status: "published",
          entityId: entity?.id ?? draft.entityId,
          payload: validation.payload,
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(adminCatalogDraftsTable.id, draft.id));
      await writeCatalogAudit(req, "catalog_published", type, {
        draftId: draft.id,
        entityId: entity?.id ?? draft.entityId,
        notes: stringValue(body.notes) || draft.notes,
      });
      res.json({ ok: true, entity, draftId: draft.id });
    } catch (err) {
      rootLogger.error({ err, type, id }, "[admin/catalogs] publish error");
      res.status(500).json({ error: String(err) });
    }
  },
);

router.post(
  "/catalogs/:type/:id/archive",
  async (req: Request, res: Response) => {
    const type = req.params.type;
    const id = Number(req.params.id);
    if (!isOneOf(type, CATALOG_TYPES) || !Number.isFinite(id)) {
      res.status(400).json({ error: "Richiesta non valida" });
      return;
    }

    try {
      const body = asPlainRecord(getRequestBody(req));
      let entity: unknown = null;
      if (type === "sectors")
        entity = (
          await db
            .update(sectorsTable)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(sectorsTable.id, id))
            .returning()
        )[0];
      if (type === "professions")
        entity = (
          await db
            .update(professionsTable)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(professionsTable.id, id))
            .returning()
        )[0];
      if (type === "education_paths")
        entity = (
          await db
            .update(educationPathsTable)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(educationPathsTable.id, id))
            .returning()
        )[0];
      if (type === "growth_articles")
        entity = (
          await db
            .update(growthArticlesTable)
            .set({ status: "archived", updatedAt: new Date() })
            .where(eq(growthArticlesTable.id, id))
            .returning()
        )[0];
      if (!entity) {
        res.status(404).json({ error: "Elemento non trovato" });
        return;
      }
      await writeCatalogAudit(req, "catalog_archived", type, {
        entityId: id,
        notes: stringValue(body.notes) || null,
      });
      res.json({ ok: true, entity });
    } catch (err) {
      rootLogger.error({ err, type, id }, "[admin/catalogs] archive error");
      res.status(500).json({ error: String(err) });
    }
  },
);

router.post(
  "/catalogs/:type/:id/restore",
  async (req: Request, res: Response) => {
    const type = req.params.type;
    const id = Number(req.params.id);
    if (!isOneOf(type, CATALOG_TYPES) || !Number.isFinite(id)) {
      res.status(400).json({ error: "Richiesta non valida" });
      return;
    }

    try {
      const body = asPlainRecord(getRequestBody(req));
      let entity: unknown = null;
      if (type === "sectors")
        entity = (
          await db
            .update(sectorsTable)
            .set({ isActive: true, updatedAt: new Date() })
            .where(eq(sectorsTable.id, id))
            .returning()
        )[0];
      if (type === "professions")
        entity = (
          await db
            .update(professionsTable)
            .set({ isActive: true, updatedAt: new Date() })
            .where(eq(professionsTable.id, id))
            .returning()
        )[0];
      if (type === "education_paths")
        entity = (
          await db
            .update(educationPathsTable)
            .set({ isActive: true, updatedAt: new Date() })
            .where(eq(educationPathsTable.id, id))
            .returning()
        )[0];
      if (type === "growth_articles")
        entity = (
          await db
            .update(growthArticlesTable)
            .set({ status: "published", updatedAt: new Date() })
            .where(eq(growthArticlesTable.id, id))
            .returning()
        )[0];
      if (!entity) {
        res.status(404).json({ error: "Elemento non trovato" });
        return;
      }
      await writeCatalogAudit(req, "catalog_restored", type, {
        entityId: id,
        notes: stringValue(body.notes) || null,
      });
      res.json({ ok: true, entity });
    } catch (err) {
      rootLogger.error({ err, type, id }, "[admin/catalogs] restore error");
      res.status(500).json({ error: String(err) });
    }
  },
);

export default router;
