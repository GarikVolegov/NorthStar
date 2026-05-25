import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db, discoveryItemsTable, educationPathsTable, growthArticlesTable, newsArticlesTable, professionEducationPathsTable, professionsTable, sectorsTable, userObjectivesTable } from "@workspace/db";
import { logger } from "../logger";
import { checkWriteRateLimit, err, queryEmbedding, type ToolResult } from "./tool-handlers";
import { readSectorTrend } from "./tool-arg-utils";
export async function handleGetSectorDetail(
  args: { sectorId: number },
): Promise<ToolResult> {
  try {
    const [s] = await db
      .select({
        id: sectorsTable.id, name: sectorsTable.name, description: sectorsTable.description,
        trend: sectorsTable.trend, growthRate: sectorsTable.growthRate,
        automationRisk: sectorsTable.automationRisk,
        avgSalaryMin: sectorsTable.avgSalaryMin, avgSalaryMax: sectorsTable.avgSalaryMax,
        skills: sectorsTable.skills, opportunities: sectorsTable.opportunities,
        autonomyScore: sectorsTable.autonomyScore, stabilityScore: sectorsTable.stabilityScore,
        timeToAutonomy: sectorsTable.timeToAutonomy,
      })
      .from(sectorsTable)
      .where(eq(sectorsTable.id, args.sectorId))
      .limit(1);
    if (!s) return err("NOT_FOUND", "Settore non trovato");
    return { ok: true, data: s };
  } catch (e) {
    logger.warn({ e, args }, "[tool] get_sector_detail error");
    return err("UNAVAILABLE", "Dati settore temporaneamente non disponibili");
  }
}
export async function handleListSectors(
  args: { trend?: string; limit?: number; query?: string },
): Promise<ToolResult> {
  const limit = Math.min(args.limit ?? 5, 10);
  const trend = readSectorTrend(args.trend);
  try {
    if (args.query && !args.trend) {
      const vec = await queryEmbedding(args.query).catch(() => null);
      if (vec) {
        const vectorLiteral = `[${vec.join(",")}]`;
        const rows = await db.execute<{
          id: number; name: string; trend: string;
          automation_risk: string; avg_salary_max: number; score: number;
        }>(sql`
          SELECT id, name, trend, automation_risk, avg_salary_max,
                 1 - (embedding <=> ${vectorLiteral}::vector) AS score
          FROM sectors
          WHERE embedding IS NOT NULL
          ORDER BY embedding <=> ${vectorLiteral}::vector
          LIMIT ${limit}
        `);
        if (rows.rows.length > 0) {
          return {
            ok: true,
            data: {
              sectors: rows.rows.map((r) => ({
                id: r.id, name: r.name, trend: r.trend,
                automationRisk: r.automation_risk, avgSalaryMax: r.avg_salary_max,
              })),
              searchMode: "semantic",
            },
          };
        }
      }
    }
    const rows = await db
      .select({
        id: sectorsTable.id, name: sectorsTable.name,
        trend: sectorsTable.trend, automationRisk: sectorsTable.automationRisk,
        avgSalaryMax: sectorsTable.avgSalaryMax,
      })
      .from(sectorsTable)
      .where(trend ? eq(sectorsTable.trend, trend) : undefined)
      .orderBy(desc(sectorsTable.growthRate))
      .limit(limit);
    return { ok: true, data: { sectors: rows } };
  } catch (e) {
    logger.warn({ e, args }, "[tool] list_sectors error");
    return err("UNAVAILABLE", "Lista settori temporaneamente non disponibile");
  }
}
export async function handleGetProfessionDetail(
  args: { professionId: number },
): Promise<ToolResult> {
  try {
    const [p] = await db
      .select({
        id: professionsTable.id, title: professionsTable.title,
        sector: professionsTable.sector, description: professionsTable.description,
        skills: professionsTable.skills, riasecFit: professionsTable.riasecFit,
        salaryRange: professionsTable.salaryRange, growthOutlook: professionsTable.growthOutlook,
        autonomyScore: professionsTable.autonomyScore, stabilityScore: professionsTable.stabilityScore,
      })
      .from(professionsTable)
      .where(and(eq(professionsTable.id, args.professionId), eq(professionsTable.isActive, true)))
      .limit(1);
    if (!p) return err("NOT_FOUND", "Professione non trovata");
    return { ok: true, data: p };
  } catch (e) {
    logger.warn({ e, args }, "[tool] get_profession_detail error");
    return err("UNAVAILABLE", "Dati professione temporaneamente non disponibili");
  }
}
export async function handleSearchProfessions(
  args: { query: string; sectorId?: number; limit?: number },
): Promise<ToolResult> {
  const limit = Math.min(args.limit ?? 5, 8);
  try {
    const vec = await queryEmbedding(args.query).catch(() => null);
    if (vec) {
      const vectorLiteral = `[${vec.join(",")}]`;
      const sectorFilter = args.sectorId
        ? sql`AND sector_id = ${args.sectorId}`
        : sql``;
      const rows = await db.execute<{
        id: number; title: string; sector: string;
        salary_range: string; growth_outlook: string;
        autonomy_score: number; stability_score: number; score: number;
      }>(sql`
        SELECT id, title, sector, salary_range, growth_outlook,
               autonomy_score, stability_score,
               1 - (embedding <=> ${vectorLiteral}::vector) AS score
        FROM professions
        WHERE is_active = true
          AND embedding IS NOT NULL
          ${sectorFilter}
        ORDER BY embedding <=> ${vectorLiteral}::vector
        LIMIT ${limit}
      `);
      if (rows.rows.length > 0) {
        const professions = rows.rows.map((r) => ({
          id:             r.id,
          title:          r.title,
          sector:         r.sector,
          salaryRange:    r.salary_range,
          growthOutlook:  r.growth_outlook,
          autonomyScore:  r.autonomy_score,
          stabilityScore: r.stability_score,
        }));
        return { ok: true, data: { professions, searchMode: "semantic" } };
      }
    }
    const pattern = `%${args.query}%`;
    const rows = await db
      .select({
        id: professionsTable.id, title: professionsTable.title,
        sector: professionsTable.sector, salaryRange: professionsTable.salaryRange,
        growthOutlook: professionsTable.growthOutlook,
      })
      .from(professionsTable)
      .where(
        and(
          eq(professionsTable.isActive, true),
          args.sectorId ? eq(professionsTable.sectorId, args.sectorId) : undefined,
          or(ilike(professionsTable.title, pattern), ilike(professionsTable.description ?? "", pattern)),
        ),
      )
      .limit(limit);
    return { ok: true, data: { professions: rows, searchMode: "keyword" } };
  } catch (e) {
    logger.warn({ e, args }, "[tool] search_professions error");
    return err("UNAVAILABLE", "Ricerca professioni temporaneamente non disponibile");
  }
}
export async function handleCompareSectors(
  args: { sectorIds: number[] },
): Promise<ToolResult> {
  if (!Array.isArray(args.sectorIds) || args.sectorIds.length < 2)
    return err("INVALID_INPUT", "Specifica almeno 2 ID settori da confrontare");
  if (args.sectorIds.length > 4)
    return err("INVALID_INPUT", "Puoi confrontare al massimo 4 settori");
  try {
    const rows = await db
      .select({
        id: sectorsTable.id, name: sectorsTable.name,
        avgSalaryMax: sectorsTable.avgSalaryMax, trend: sectorsTable.trend,
        automationRisk: sectorsTable.automationRisk, growthRate: sectorsTable.growthRate,
        autonomyScore: sectorsTable.autonomyScore, stabilityScore: sectorsTable.stabilityScore,
      })
      .from(sectorsTable)
      .where(or(...args.sectorIds.map((id) => eq(sectorsTable.id, id))))
      .limit(4);
    return { ok: true, data: { sectors: rows } };
  } catch (e) {
    logger.warn({ e, args }, "[tool] compare_sectors error");
    return err("UNAVAILABLE", "Confronto settori temporaneamente non disponibile");
  }
}
export async function handleGetMarketTrend(
  args: { sectorName?: string; professionTitle?: string; limit?: number },
): Promise<ToolResult> {
  try {
    const limit = Math.min(args.limit ?? 3, 5);
    const query = args.sectorName ?? args.professionTitle ?? "";
    const pattern = `%${query}%`;
    const rows = await db
      .select({
        title: discoveryItemsTable.title, summary: discoveryItemsTable.summary,
        type: discoveryItemsTable.type, publishedAt: discoveryItemsTable.publishedAt,
      })
      .from(discoveryItemsTable)
      .where(
        and(
          eq(discoveryItemsTable.isEnriched, true),
          query ? or(ilike(discoveryItemsTable.title, pattern), ilike(discoveryItemsTable.summary, pattern)) : undefined,
        ),
      )
      .orderBy(desc(discoveryItemsTable.relevanceScore))
      .limit(limit);
    return { ok: true, data: { items: rows.map((r) => ({ ...r, publishedAt: r.publishedAt?.toISOString() ?? "" })) } };
  } catch (e) {
    logger.warn({ e, args }, "[tool] get_market_trend error");
    return err("UNAVAILABLE", "Trend di mercato temporaneamente non disponibili");
  }
}
export async function handleGetUserObjectives(
  _args: Record<string, never>,
  userId: number,
): Promise<ToolResult> {
  try {
    const rows = await db
      .select({
        id: userObjectivesTable.id, text: userObjectivesTable.text,
        category: userObjectivesTable.category, progress: userObjectivesTable.progress,
        dueDate: userObjectivesTable.dueDate, completed: userObjectivesTable.completed,
      })
      .from(userObjectivesTable)
      .where(and(eq(userObjectivesTable.userId, userId), eq(userObjectivesTable.completed, false), isNull(userObjectivesTable.deletedAt)))
      .limit(10);
    return { ok: true, data: { objectives: rows } };
  } catch (e) {
    logger.warn({ e, userId }, "[tool] get_user_objectives error");
    return err("UNAVAILABLE", "Obiettivi temporaneamente non disponibili");
  }
}
export async function handleSaveObjective(
  args: { text: string; category?: string; deadlineWeeks?: number },
  userId: number,
): Promise<ToolResult> {
  if (!args.text?.trim()) return err("INVALID_INPUT", "Il testo dell'obiettivo è obbligatorio");
  if (args.text.length > 300) return err("INVALID_INPUT", "Testo troppo lungo — max 300 caratteri");
  if (!checkWriteRateLimit(userId, "save_objective"))
    return err("LIMIT_EXCEEDED", "Troppi obiettivi creati di recente. Riprova tra un po'.");
  let dueDate: string | undefined;
  if (args.deadlineWeeks && args.deadlineWeeks > 0) {
    const d = new Date();
    d.setDate(d.getDate() + args.deadlineWeeks * 7);
    dueDate = d.toISOString().split("T")[0];
  }
  try {
    const [row] = await db
      .insert(userObjectivesTable)
      .values({ userId, text: args.text.trim(), category: args.category ?? "altro", dueDate })
      .returning({ id: userObjectivesTable.id, text: userObjectivesTable.text });
    if (!row) return err("UNAVAILABLE", "Errore nel salvataggio dell'obiettivo");
    return { ok: true, data: { ok: true, id: row.id, text: row.text, dueDate: dueDate ?? null } };
  } catch (e) {
    logger.warn({ e, userId }, "[tool] save_objective error");
    return err("UNAVAILABLE", "Errore nel salvataggio dell'obiettivo");
  }
}
export async function handleUpdateObjectiveProgress(
  args: { objectiveId: number; progress: number },
  userId: number,
): Promise<ToolResult> {
  if (typeof args.progress !== "number" || args.progress < 0 || args.progress > 100)
    return err("INVALID_INPUT", "Il progresso deve essere un numero tra 0 e 100");
  try {
    const [existing] = await db
      .select({ id: userObjectivesTable.id })
      .from(userObjectivesTable)
      .where(and(eq(userObjectivesTable.id, args.objectiveId), eq(userObjectivesTable.userId, userId)))
      .limit(1);
    if (!existing) return err("FORBIDDEN", "Obiettivo non trovato o non accessibile");
    await db
      .update(userObjectivesTable)
      .set({ progress: args.progress, completed: args.progress === 100, updatedAt: new Date() })
      .where(and(eq(userObjectivesTable.id, args.objectiveId), eq(userObjectivesTable.userId, userId)));
    return { ok: true, data: { ok: true } };
  } catch (e) {
    logger.warn({ e, userId, args }, "[tool] update_objective_progress error");
    return err("UNAVAILABLE", "Errore nell'aggiornamento del progresso");
  }
}
export async function handleGetGrowthArticles(
  args: { topic: string; limit?: number },
): Promise<ToolResult> {
  try {
    const pattern = `%${args.topic}%`;
    const limit = Math.min(args.limit ?? 3, 5);
    const rows = await db
      .select({
        id: growthArticlesTable.id, title: growthArticlesTable.title,
        description: growthArticlesTable.description, slug: growthArticlesTable.slug,
        difficulty: growthArticlesTable.difficulty, readTimeMinutes: growthArticlesTable.readTimeMinutes,
      })
      .from(growthArticlesTable)
      .where(or(ilike(growthArticlesTable.title, pattern), ilike(growthArticlesTable.description, pattern)))
      .limit(limit);
    const articles = rows.map((a) => ({ ...a, url: `/crescita/articolo/${a.slug}` }));
    return { ok: true, data: { articles } };
  } catch (e) {
    logger.warn({ e, args }, "[tool] get_growth_articles error");
    return err("UNAVAILABLE", "Articoli temporaneamente non disponibili");
  }
}
export async function handleGetNewsSummary(
  args: { topic: string; limit?: number },
): Promise<ToolResult> {
  try {
    const pattern = `%${args.topic}%`;
    const limit = Math.min(args.limit ?? 3, 5);
    const rows = await db
      .select({
        id: newsArticlesTable.id, title: newsArticlesTable.title,
        summary: newsArticlesTable.summary, source: newsArticlesTable.source,
        publishedAt: newsArticlesTable.publishedAt,
      })
      .from(newsArticlesTable)
      .where(or(ilike(newsArticlesTable.title, pattern), ilike(newsArticlesTable.summary, pattern)))
      .orderBy(desc(newsArticlesTable.publishedAt))
      .limit(limit);
    const news = rows.map((n) => ({ ...n, publishedAt: n.publishedAt?.toISOString() ?? "" }));
    return { ok: true, data: { news } };
  } catch (e) {
    logger.warn({ e, args }, "[tool] get_news_summary error");
    return err("UNAVAILABLE", "News temporaneamente non disponibili");
  }
}
export async function handleGetLearningPaths(
  args: { professionId?: number; sectorName?: string },
): Promise<ToolResult> {
  try {
    let rows: Array<{ id: number; path: string; type: string; duration: string; cost: string; steps: string[] }> = [];
    if (args.professionId) {
      const joins = await db
        .select({ educationPathId: professionEducationPathsTable.educationPathId })
        .from(professionEducationPathsTable)
        .where(eq(professionEducationPathsTable.professionId, args.professionId))
        .limit(5);
      if (joins.length > 0) {
        const ids = joins.map((j) => j.educationPathId);
        rows = await db
          .select({ id: educationPathsTable.id, path: educationPathsTable.path, type: educationPathsTable.type, duration: educationPathsTable.duration, cost: educationPathsTable.cost, steps: educationPathsTable.steps })
          .from(educationPathsTable)
          .where(and(inArray(educationPathsTable.id, ids), eq(educationPathsTable.isActive, true)));
      }
    }
    if (rows.length === 0) {
      rows = await db
        .select({ id: educationPathsTable.id, path: educationPathsTable.path, type: educationPathsTable.type, duration: educationPathsTable.duration, cost: educationPathsTable.cost, steps: educationPathsTable.steps })
        .from(educationPathsTable)
        .where(and(eq(educationPathsTable.isActive, true)))
        .limit(4);
    }
    return { ok: true, data: { paths: rows } };
  } catch (e) {
    logger.warn({ e, args }, "[tool] get_learning_paths error");
    return err("UNAVAILABLE", "Percorsi formativi temporaneamente non disponibili");
  }
}
