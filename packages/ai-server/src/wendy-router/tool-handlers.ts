/**
 * tool-handlers.ts — implementazione effettiva dei tool Wendy.
 *
 * Ogni handler riceve gli args dall'LLM e restituisce dati strutturati dal DB.
 * SECURITY: ogni query filtra per userId dove pertinente (SECURITY_RULES.md).
 * PRIVACY: nessun dato sensibile (passwordHash, stripe, ecc.) nella risposta.
 */
import { eq, and, ilike, or, isNull } from "drizzle-orm";
import {
  db,
  sectorsTable,
  professionsTable,
  userObjectivesTable,
  newsArticlesTable,
  growthArticlesTable,
} from "@workspace/db";
import { logger } from "../logger";

// ── Tipi risposta tool ────────────────────────────────────────────────────────

export type ToolResult =
  | { ok: true;  data: unknown }
  | { ok: false; error: string };

// ── Handlers ──────────────────────────────────────────────────────────────────

export async function handleGetSector(args: { id: number }): Promise<ToolResult> {
  try {
    const [sector] = await db
      .select({
        id:             sectorsTable.id,
        name:           sectorsTable.name,
        description:    sectorsTable.description,
        skills:         sectorsTable.skills,
        riasecTypes:    sectorsTable.riasecTypes,
        avgSalaryMin:   sectorsTable.avgSalaryMin,
        avgSalaryMax:   sectorsTable.avgSalaryMax,
        growthRate:     sectorsTable.growthRate,
        automationRisk: sectorsTable.automationRisk,
        trend:          sectorsTable.trend,
        timeToAutonomy: sectorsTable.timeToAutonomy,
        advantages:     sectorsTable.advantages,
        opportunities:  sectorsTable.opportunities,
        autonomyScore:  sectorsTable.autonomyScore,
        stabilityScore: sectorsTable.stabilityScore,
      })
      .from(sectorsTable)
      .where(eq(sectorsTable.id, args.id))
      .limit(1);
    if (!sector) return { ok: false, error: `Settore ${args.id} non trovato` };
    return { ok: true, data: sector };
  } catch (err) {
    logger.warn({ err, args }, "[tool] get_sector error");
    return { ok: false, error: "Errore recupero settore" };
  }
}

export async function handleGetProfession(
  args: { id?: number; title?: string },
): Promise<ToolResult> {
  try {
    const where = args.id
      ? eq(professionsTable.id, args.id)
      : args.title
        ? ilike(professionsTable.title, `%${args.title}%`)
        : undefined;

    if (!where) return { ok: false, error: "Specifica id o title" };

    const [prof] = await db
      .select({
        id:            professionsTable.id,
        title:         professionsTable.title,
        sector:        professionsTable.sector,
        description:   professionsTable.description,
        skills:        professionsTable.skills,
        riasecFit:     professionsTable.riasecFit,
        salaryRange:   professionsTable.salaryRange,
        growthOutlook: professionsTable.growthOutlook,
        autonomyScore: professionsTable.autonomyScore,
        stabilityScore:professionsTable.stabilityScore,
      })
      .from(professionsTable)
      .where(and(where, eq(professionsTable.isActive, true)))
      .limit(1);

    if (!prof) return { ok: false, error: "Professione non trovata" };
    return { ok: true, data: prof };
  } catch (err) {
    logger.warn({ err, args }, "[tool] get_profession error");
    return { ok: false, error: "Errore recupero professione" };
  }
}

export async function handleSearchProfessions(
  args: { query: string; sectorId?: number },
): Promise<ToolResult> {
  try {
    const pattern = `%${args.query}%`;
    const results = await db
      .select({
        id:            professionsTable.id,
        title:         professionsTable.title,
        sector:        professionsTable.sector,
        salaryRange:   professionsTable.salaryRange,
        growthOutlook: professionsTable.growthOutlook,
        autonomyScore: professionsTable.autonomyScore,
      })
      .from(professionsTable)
      .where(
        and(
          eq(professionsTable.isActive, true),
          args.sectorId ? eq(professionsTable.sectorId, args.sectorId) : undefined,
          or(
            ilike(professionsTable.title, pattern),
            ilike(professionsTable.description ?? "", pattern),
          ),
        ),
      )
      .limit(5);
    return { ok: true, data: results };
  } catch (err) {
    logger.warn({ err, args }, "[tool] search_professions error");
    return { ok: false, error: "Errore ricerca professioni" };
  }
}

export async function handleGetUserObjectives(
  args: Record<string, never>,
  userId: number,
): Promise<ToolResult> {
  try {
    const objectives = await db
      .select({
        id:        userObjectivesTable.id,
        text:      userObjectivesTable.text,
        category:  userObjectivesTable.category,
        progress:  userObjectivesTable.progress,
        dueDate:   userObjectivesTable.dueDate,
        completed: userObjectivesTable.completed,
      })
      .from(userObjectivesTable)
      .where(
        and(
          eq(userObjectivesTable.userId, userId),
          eq(userObjectivesTable.completed, false),
          isNull(userObjectivesTable.deletedAt),
        ),
      )
      .limit(10);
    return { ok: true, data: objectives };
  } catch (err) {
    logger.warn({ err, userId }, "[tool] get_user_objectives error");
    return { ok: false, error: "Errore recupero obiettivi" };
  }
}

export async function handleSaveObjective(
  args: { text: string; category?: string; deadlineWeeks?: number },
  userId: number,
): Promise<ToolResult> {
  try {
    let dueDate: string | undefined;
    if (args.deadlineWeeks && args.deadlineWeeks > 0) {
      const d = new Date();
      d.setDate(d.getDate() + args.deadlineWeeks * 7);
      dueDate = d.toISOString().split("T")[0];
    }

    const [inserted] = await db
      .insert(userObjectivesTable)
      .values({
        userId,
        text:     args.text.slice(0, 500),
        category: args.category ?? "altro",
        dueDate,
      })
      .returning({ id: userObjectivesTable.id, text: userObjectivesTable.text });

    return { ok: true, data: { saved: true, objective: inserted } };
  } catch (err) {
    logger.warn({ err, userId }, "[tool] save_objective error");
    return { ok: false, error: "Errore salvataggio obiettivo" };
  }
}

export async function handleGetGrowthArticles(
  args: { topic: string; limit?: number },
): Promise<ToolResult> {
  try {
    const pattern = `%${args.topic}%`;
    const limit = Math.min(args.limit ?? 3, 5);
    const articles = await db
      .select({
        id:          growthArticlesTable.id,
        title:       growthArticlesTable.title,
        description: growthArticlesTable.description,
        slug:        growthArticlesTable.slug,
        category:    growthArticlesTable.category,
        difficulty:  growthArticlesTable.difficulty,
        readTimeMinutes: growthArticlesTable.readTimeMinutes,
      })
      .from(growthArticlesTable)
      .where(
        or(
          ilike(growthArticlesTable.title, pattern),
          ilike(growthArticlesTable.description, pattern),
        ),
      )
      .limit(limit);
    return { ok: true, data: articles };
  } catch (err) {
    logger.warn({ err, args }, "[tool] get_growth_articles error");
    return { ok: false, error: "Errore recupero articoli" };
  }
}

export async function handleCompareSectors(
  args: { sectorIds: number[] },
): Promise<ToolResult> {
  try {
    if (!args.sectorIds?.length) return { ok: false, error: "Specifica almeno 2 settori" };
    const sectors = await db
      .select({
        id:             sectorsTable.id,
        name:           sectorsTable.name,
        avgSalaryMin:   sectorsTable.avgSalaryMin,
        avgSalaryMax:   sectorsTable.avgSalaryMax,
        growthRate:     sectorsTable.growthRate,
        automationRisk: sectorsTable.automationRisk,
        trend:          sectorsTable.trend,
        autonomyScore:  sectorsTable.autonomyScore,
        stabilityScore: sectorsTable.stabilityScore,
        timeToAutonomy: sectorsTable.timeToAutonomy,
      })
      .from(sectorsTable)
      .where(
        // Drizzle non ha inArray per serial, usiamo or
        or(...args.sectorIds.map((id) => eq(sectorsTable.id, id))),
      )
      .limit(4);
    return { ok: true, data: sectors };
  } catch (err) {
    logger.warn({ err, args }, "[tool] compare_sectors error");
    return { ok: false, error: "Errore confronto settori" };
  }
}

export async function handleGetNewsSummary(
  args: { topic: string; limit?: number },
): Promise<ToolResult> {
  try {
    const pattern = `%${args.topic}%`;
    const limit = Math.min(args.limit ?? 3, 5);
    const news = await db
      .select({
        id:        newsArticlesTable.id,
        title:     newsArticlesTable.title,
        summary:   newsArticlesTable.summary,
        source:    newsArticlesTable.source,
        publishedAt: newsArticlesTable.publishedAt,
        category:  newsArticlesTable.category,
      })
      .from(newsArticlesTable)
      .where(
        or(
          ilike(newsArticlesTable.title, pattern),
          ilike(newsArticlesTable.summary, pattern),
        ),
      )
      .orderBy(newsArticlesTable.publishedAt)
      .limit(limit);
    return { ok: true, data: news };
  } catch (err) {
    logger.warn({ err, args }, "[tool] get_news_summary error");
    return { ok: false, error: "Errore recupero news" };
  }
}

// ── Dispatcher centrale ───────────────────────────────────────────────────────

export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  userId: number,
): Promise<ToolResult> {
  switch (name) {
    case "navigate":
    case "filter_list":
      // Questi tool vengono eseguiti lato client — il server restituisce solo la call
      return { ok: true, data: { clientSide: true, name, args } };

    case "get_sector":
      return handleGetSector(args as { id: number });

    case "get_profession":
      return handleGetProfession(args as { id?: number; title?: string });

    case "search_professions":
      return handleSearchProfessions(args as { query: string; sectorId?: number });

    case "get_user_objectives":
      return handleGetUserObjectives({} as Record<string, never>, userId);

    case "save_objective":
      return handleSaveObjective(
        args as { text: string; category?: string; deadlineWeeks?: number },
        userId,
      );

    case "get_growth_articles":
      return handleGetGrowthArticles(args as { topic: string; limit?: number });

    case "compare_sectors":
      return handleCompareSectors(args as { sectorIds: number[] });

    case "get_news_summary":
      return handleGetNewsSummary(args as { topic: string; limit?: number });

    default:
      logger.warn({ name }, "[tool] unknown tool call");
      return { ok: false, error: `Tool "${name}" non riconosciuto` };
  }
}
