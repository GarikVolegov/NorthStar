import {
  adminCatalogDraftsTable,
  auditLogTable,
  db,
  educationPathsTable,
  growthArticlesTable,
  professionEducationPathsTable,
  professionsTable,
  sectorsTable,
} from "@workspace/db";
import { and, asc, desc, eq, ilike, ne, or } from "drizzle-orm";
import type { Request } from "express";
import {
  arrayValue,
  asRecord,
  CATALOG_ENUMS,
  integerValue,
  isAllowed,
  isSql,
  numberArrayValue,
  numberValue,
  stringValue,
  type CatalogPayload,
} from "./catalog-utils";
export {
  CATALOG_ENUMS,
  stringValue,
  type CatalogPayload,
} from "./catalog-utils";
export {
  validateCatalogPayload,
  type CatalogValidation,
} from "./catalog-validation";

export type CatalogType =
  | "sectors"
  | "professions"
  | "education_paths"
  | "growth_articles";
export const CATALOG_TYPES: CatalogType[] = [
  "sectors",
  "professions",
  "education_paths",
  "growth_articles",
];

export const CATALOG_LABELS: Record<CatalogType, string> = {
  sectors: "Settori",
  professions: "Professioni",
  education_paths: "Percorsi",
  growth_articles: "Articoli crescita",
};

export async function writeCatalogAudit(
  req: Request,
  action: string,
  type: CatalogType,
  metadata: Record<string, unknown>,
) {
  await db.insert(auditLogTable).values({
    actorId: req.user?.id ?? null,
    targetId: null,
    action,
    category: "admin_action",
    metadata: { catalogType: type, ...metadata },
  });
}

export function emptyCatalogList(type: CatalogType, reason?: string) {
  return {
    type,
    label: CATALOG_LABELS[type],
    items: [],
    drafts: [],
    persistenceUnavailable: Boolean(reason),
    reason: reason ?? null,
    setupAction: reason ? "run_migrations" : null,
  };
}

export function emptyCatalogOverview(reason?: string) {
  return {
    generatedAt: new Date().toISOString(),
    persistenceUnavailable: Boolean(reason),
    reason: reason ?? null,
    setupAction: reason ? "run_migrations" : null,
    items: CATALOG_TYPES.map((type) => ({
      type,
      label: CATALOG_LABELS[type],
      total: 0,
      active: 0,
      archived: 0,
      drafts: 0,
    })),
  };
}

export async function ensureCatalogReferences(
  type: CatalogType,
  payload: CatalogPayload,
  entityId?: number | null,
) {
  const fields: Record<string, string> = {};

  if (type === "professions" && payload.sectorId) {
    const [sector] = await db
      .select({ id: sectorsTable.id })
      .from(sectorsTable)
      .where(eq(sectorsTable.id, Number(payload.sectorId)))
      .limit(1);
    if (!sector) fields.sectorId = "Settore collegato inesistente.";
  }

  const professionIds = numberArrayValue(payload.professionIds);
  if (type === "education_paths" && professionIds.length > 0) {
    for (const professionId of professionIds) {
      const [profession] = await db
        .select({ id: professionsTable.id })
        .from(professionsTable)
        .where(eq(professionsTable.id, professionId))
        .limit(1);
      if (!profession) {
        fields.professionIds = `Professione ${professionId} inesistente.`;
        break;
      }
    }
  }

  if (type === "growth_articles" && payload.slug) {
    const conditions = [eq(growthArticlesTable.slug, String(payload.slug))];
    if (entityId) conditions.push(ne(growthArticlesTable.id, entityId));
    const [existing] = await db
      .select({ id: growthArticlesTable.id })
      .from(growthArticlesTable)
      .where(and(...conditions))
      .limit(1);
    if (existing) fields.slug = "Slug gia usato da un altro articolo.";
  }

  return fields;
}

export async function getCatalogRows(
  type: CatalogType,
  limit: number,
  query: string,
  status: string,
) {
  const search = `%${query}%`;

  if (type === "sectors") {
    const where = [
      status === "archived"
        ? eq(sectorsTable.isActive, false)
        : status === "active"
          ? eq(sectorsTable.isActive, true)
          : undefined,
      query
        ? or(
            ilike(sectorsTable.name, search),
            ilike(sectorsTable.description, search),
          )
        : undefined,
    ].filter(isSql);
    return db
      .select()
      .from(sectorsTable)
      .where(where.length ? and(...where) : undefined)
      .orderBy(asc(sectorsTable.name))
      .limit(limit);
  }

  if (type === "professions") {
    const where = [
      status === "archived"
        ? eq(professionsTable.isActive, false)
        : status === "active"
          ? eq(professionsTable.isActive, true)
          : undefined,
      query
        ? or(
            ilike(professionsTable.title, search),
            ilike(professionsTable.description, search),
          )
        : undefined,
    ].filter(isSql);
    return db
      .select()
      .from(professionsTable)
      .where(where.length ? and(...where) : undefined)
      .orderBy(asc(professionsTable.title))
      .limit(limit);
  }

  if (type === "education_paths") {
    const where = [
      status === "archived"
        ? eq(educationPathsTable.isActive, false)
        : status === "active"
          ? eq(educationPathsTable.isActive, true)
          : undefined,
      query ? ilike(educationPathsTable.path, search) : undefined,
    ].filter(isSql);
    return db
      .select()
      .from(educationPathsTable)
      .where(where.length ? and(...where) : undefined)
      .orderBy(asc(educationPathsTable.path))
      .limit(limit);
  }

  const where = [
    status !== "all" && isAllowed(status, CATALOG_ENUMS.articleStatus)
      ? eq(growthArticlesTable.status, status)
      : undefined,
    query
      ? or(
          ilike(growthArticlesTable.title, search),
          ilike(growthArticlesTable.description, search),
        )
      : undefined,
  ].filter(isSql);
  return db
    .select()
    .from(growthArticlesTable)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(growthArticlesTable.updatedAt))
    .limit(limit);
}

export async function getCatalogEntity(type: CatalogType, id: number) {
  if (type === "sectors") {
    const [row] = await db
      .select()
      .from(sectorsTable)
      .where(eq(sectorsTable.id, id))
      .limit(1);
    return row ?? null;
  }
  if (type === "professions") {
    const [row] = await db
      .select()
      .from(professionsTable)
      .where(eq(professionsTable.id, id))
      .limit(1);
    return row ?? null;
  }
  if (type === "education_paths") {
    const [row] = await db
      .select()
      .from(educationPathsTable)
      .where(eq(educationPathsTable.id, id))
      .limit(1);
    if (!row) return null;
    const links = await db
      .select({ professionId: professionEducationPathsTable.professionId })
      .from(professionEducationPathsTable)
      .where(eq(professionEducationPathsTable.educationPathId, id));
    return { ...row, professionIds: links.map((link) => link.professionId) };
  }
  const [row] = await db
    .select()
    .from(growthArticlesTable)
    .where(eq(growthArticlesTable.id, id))
    .limit(1);
  return row ?? null;
}

export async function findPublishDraft(type: CatalogType, id: number) {
  const [draftById] = await db
    .select()
    .from(adminCatalogDraftsTable)
    .where(
      and(
        eq(adminCatalogDraftsTable.catalogType, type),
        eq(adminCatalogDraftsTable.id, id),
        eq(adminCatalogDraftsTable.status, "draft"),
      ),
    )
    .limit(1);
  if (draftById) return draftById;

  const [draftByEntity] = await db
    .select()
    .from(adminCatalogDraftsTable)
    .where(
      and(
        eq(adminCatalogDraftsTable.catalogType, type),
        eq(adminCatalogDraftsTable.entityId, id),
        eq(adminCatalogDraftsTable.status, "draft"),
      ),
    )
    .orderBy(desc(adminCatalogDraftsTable.updatedAt))
    .limit(1);
  return draftByEntity ?? null;
}

export function previewCatalogPayload(
  type: CatalogType,
  payload: CatalogPayload,
) {
  if (type === "sectors") {
    const riasecTypes = arrayValue(payload.riasecTypes);
    return {
      title: stringValue(payload.name),
      subtitle: `${stringValue(payload.trend)} · +${numberValue(payload.growthRate)}% crescita`,
      description: stringValue(payload.description),
      url: payload.id ? `/settore/${String(payload.id)}` : "/settori",
      badges: [stringValue(payload.automationRisk), ...riasecTypes].filter(
        Boolean,
      ),
    };
  }
  if (type === "professions") {
    return {
      title: stringValue(payload.title),
      subtitle: stringValue(payload.sector),
      description: stringValue(payload.description),
      url: payload.id ? `/ruolo/${String(payload.id)}` : "/ruoli",
      badges: [
        stringValue(payload.salaryRange),
        stringValue(payload.growthOutlook),
      ].filter(Boolean),
    };
  }
  if (type === "education_paths") {
    const careerOutcomes = arrayValue(payload.careerOutcomes);
    return {
      title: stringValue(payload.path),
      subtitle: `${stringValue(payload.type)} · ${stringValue(payload.duration)}`,
      description: `${stringValue(payload.cost)} · ${careerOutcomes.slice(0, 2).join(", ")}`,
      url: "/percorso",
      badges: arrayValue(payload.sectorFit),
    };
  }
  const tags = arrayValue(payload.tags);
  return {
    title: stringValue(payload.title),
    subtitle: `${stringValue(payload.category)} · ${integerValue(payload.readTimeMinutes, 3)} min`,
    description: stringValue(payload.description),
    url: payload.slug
      ? `/crescita/articolo/${stringValue(payload.slug)}`
      : "/crescita",
    badges: [
      stringValue(payload.difficulty),
      stringValue(payload.status),
      ...tags.slice(0, 3),
    ].filter(Boolean),
  };
}

export async function publishCatalogDraft(
  type: CatalogType,
  draft: typeof adminCatalogDraftsTable.$inferSelect,
) {
  const payload = asRecord(draft.payload);
  const now = new Date();

  if (type === "sectors") {
    const values = {
      ...payload,
      updatedAt: now,
    } as typeof sectorsTable.$inferInsert;
    if (draft.entityId) {
      const [row] = await db
        .update(sectorsTable)
        .set(values)
        .where(eq(sectorsTable.id, draft.entityId))
        .returning();
      return row;
    }
    const [row] = await db.insert(sectorsTable).values(values).returning();
    return row;
  }

  if (type === "professions") {
    const values = {
      ...payload,
      updatedAt: now,
    } as typeof professionsTable.$inferInsert;
    if (draft.entityId) {
      const [row] = await db
        .update(professionsTable)
        .set(values)
        .where(eq(professionsTable.id, draft.entityId))
        .returning();
      return row;
    }
    const [row] = await db.insert(professionsTable).values(values).returning();
    return row;
  }

  if (type === "education_paths") {
    const { professionIds: _professionIds, ...pathValues } = payload;
    const professionIds = numberArrayValue(_professionIds);
    const values = {
      ...pathValues,
      updatedAt: now,
    } as typeof educationPathsTable.$inferInsert;
    const row = draft.entityId
      ? (
          await db
            .update(educationPathsTable)
            .set(values)
            .where(eq(educationPathsTable.id, draft.entityId))
            .returning()
        )[0]
      : (await db.insert(educationPathsTable).values(values).returning())[0];
    if (row) {
      await db
        .delete(professionEducationPathsTable)
        .where(eq(professionEducationPathsTable.educationPathId, row.id));
      if (professionIds.length > 0) {
        await db.insert(professionEducationPathsTable).values(
          professionIds.map((professionId) => ({
            professionId,
            educationPathId: row.id,
          })),
        );
      }
    }
    return row;
  }

  const values = {
    ...payload,
    updatedAt: now,
  } as typeof growthArticlesTable.$inferInsert;
  if (draft.entityId) {
    const [row] = await db
      .update(growthArticlesTable)
      .set(values)
      .where(eq(growthArticlesTable.id, draft.entityId))
      .returning();
    return row;
  }
  const [row] = await db.insert(growthArticlesTable).values(values).returning();
  return row;
}
