/**
 * tool-handlers.ts — implementazione dei 17 tool Wendy V1.
 *
 * SECURITY:
 *   - userId sempre iniettato server-side, mai dai parametri del tool call LLM
 *   - Ogni query su dati utente ha WHERE userId = ? (doppio filtro)
 *   - Output pulito: mai email, passwordHash, stripe, resetToken
 *
 * PRIVACY:
 *   - get_user_context: max 5 fatti biografici, nessun dato finanziario
 *   - Tutti i dati restituiti al LLM sono già in DB, non generati ex-novo
 */
import { eq, and, ilike, or, isNull, desc, inArray } from "drizzle-orm";
import {
  db,
  sectorsTable,
  professionsTable,
  userObjectivesTable,
  newsArticlesTable,
  growthArticlesTable,
  discoveryItemsTable,
  businessIdeasTable,
  calendarEventsTable,
  coachMemoryFactsTable,
  userFavoritesTable,
  educationPathsTable,
  professionEducationPathsTable,
  usersTable,
} from "@workspace/db";
import { logger } from "../logger";

// ── Tipo risposta uniforme ────────────────────────────────────────────────────

export type ToolResult =
  | { ok: true;  data: unknown }
  | { ok: false; code: string; message: string };

function err(code: string, message: string): ToolResult {
  return { ok: false, code, message };
}

// ── Rate limiting in-memory per write tools ───────────────────────────────────

const writeCallCounts = new Map<string, { count: number; resetAt: number }>();
const WRITE_LIMIT = 20;
const WRITE_WINDOW_MS = 60 * 60 * 1000; // 1 ora

function checkWriteRateLimit(userId: number, toolName: string): boolean {
  const key = `${userId}:${toolName}`;
  const now = Date.now();
  const entry = writeCallCounts.get(key);
  if (!entry || now > entry.resetAt) {
    writeCallCounts.set(key, { count: 1, resetAt: now + WRITE_WINDOW_MS });
    return true;
  }
  if (entry.count >= WRITE_LIMIT) return false;
  entry.count++;
  return true;
}

// ── 1. open_view (client-side) ────────────────────────────────────────────────

export async function handleOpenView(
  args: { viewId: string; entityId?: number; entityName?: string },
): Promise<ToolResult> {
  const viewMap: Record<string, string> = {
    dashboard: "/dashboard",
    settori:   "/settori",
    settore:   args.entityId ? `/settore/${args.entityId}` : "/settori",
    ruoli:     "/ruoli",
    ruolo:     args.entityId ? `/ruolo/${args.entityId}` : "/ruoli",
    news:      "/news",
    crescita:  "/crescita",
    percorso:  "/percorso",
    profilo:   "/profilo",
    archivio:  "/archivio",
    coach:     "/coach",
  };
  const url = viewMap[args.viewId] ?? "/dashboard";
  return { ok: true, data: { clientSide: true, action: "navigate", url } };
}

// ── 2. set_filters (client-side) ─────────────────────────────────────────────

export async function handleSetFilters(
  args: { listType: string; filters: Record<string, unknown> },
): Promise<ToolResult> {
  return { ok: true, data: { clientSide: true, action: "set_filters", listType: args.listType, filters: args.filters } };
}

// ── 3. get_sector_detail ─────────────────────────────────────────────────────

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

// ── 4. list_sectors ──────────────────────────────────────────────────────────

export async function handleListSectors(
  args: { trend?: string; limit?: number },
): Promise<ToolResult> {
  try {
    const limit = Math.min(args.limit ?? 5, 10);
    const rows = await db
      .select({
        id: sectorsTable.id, name: sectorsTable.name,
        trend: sectorsTable.trend, automationRisk: sectorsTable.automationRisk,
        avgSalaryMax: sectorsTable.avgSalaryMax,
      })
      .from(sectorsTable)
      .where(args.trend ? eq(sectorsTable.trend, args.trend as any) : undefined)
      .orderBy(desc(sectorsTable.growthRate))
      .limit(limit);
    return { ok: true, data: { sectors: rows } };
  } catch (e) {
    logger.warn({ e, args }, "[tool] list_sectors error");
    return err("UNAVAILABLE", "Lista settori temporaneamente non disponibile");
  }
}

// ── 5. get_profession_detail ─────────────────────────────────────────────────

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

// ── 6. search_professions ────────────────────────────────────────────────────

export async function handleSearchProfessions(
  args: { query: string; sectorId?: number; limit?: number },
): Promise<ToolResult> {
  try {
    const pattern = `%${args.query}%`;
    const limit = Math.min(args.limit ?? 5, 8);
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
    return { ok: true, data: { professions: rows } };
  } catch (e) {
    logger.warn({ e, args }, "[tool] search_professions error");
    return err("UNAVAILABLE", "Ricerca professioni temporaneamente non disponibile");
  }
}

// ── 7. compare_sectors ───────────────────────────────────────────────────────

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

// ── 8. get_market_trend ──────────────────────────────────────────────────────

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

// ── 9. get_user_objectives ───────────────────────────────────────────────────

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

// ── 10. save_objective ───────────────────────────────────────────────────────

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
    return { ok: true, data: { ok: true, id: row.id, text: row.text, dueDate: dueDate ?? null } };
  } catch (e) {
    logger.warn({ e, userId }, "[tool] save_objective error");
    return err("UNAVAILABLE", "Errore nel salvataggio dell'obiettivo");
  }
}

// ── 11. update_objective_progress ────────────────────────────────────────────

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

// ── 12. get_growth_articles ──────────────────────────────────────────────────

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

// ── 13. get_news_summary ─────────────────────────────────────────────────────

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

// ── 14. get_learning_paths ───────────────────────────────────────────────────

export async function handleGetLearningPaths(
  args: { professionId?: number; sectorName?: string },
): Promise<ToolResult> {
  try {
    let rows: Array<{ id: number; path: string; type: string; duration: string; cost: string; steps: string[] }> = [];

    if (args.professionId) {
      // Cerca percorsi collegati alla professione
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

    // Fallback: cerca per sectorFit o restituisce i più generici
    if (rows.length === 0) {
      const pattern = args.sectorName ? `%${args.sectorName}%` : "%";
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

// ── 15. save_business_idea ───────────────────────────────────────────────────

export async function handleSaveBusinessIdea(
  args: { title: string; description: string; sectorName?: string },
  userId: number,
): Promise<ToolResult> {
  if (!args.title?.trim() || !args.description?.trim())
    return err("INVALID_INPUT", "Titolo e descrizione sono obbligatori");
  if (!checkWriteRateLimit(userId, "save_business_idea"))
    return err("LIMIT_EXCEEDED", "Troppo idee create di recente. Riprova tra un po'.");

  try {
    const [row] = await db
      .insert(businessIdeasTable)
      .values({
        userId,
        title:    args.title.trim().slice(0, 200),
        ideaText: args.description.trim().slice(0, 500),
        sector:   args.sectorName,
        status:   "draft",
      })
      .returning({ id: businessIdeasTable.id });
    return { ok: true, data: { ok: true, id: row.id } };
  } catch (e) {
    logger.warn({ e, userId }, "[tool] save_business_idea error");
    return err("UNAVAILABLE", "Errore nel salvataggio dell'idea");
  }
}

// ── 16. add_calendar_event ───────────────────────────────────────────────────

export async function handleAddCalendarEvent(
  args: { title: string; date: string; type?: string; notes?: string },
  userId: number,
): Promise<ToolResult> {
  if (!args.title?.trim()) return err("INVALID_INPUT", "Il titolo dell'evento è obbligatorio");
  if (!args.date?.match(/^\d{4}-\d{2}-\d{2}$/)) return err("INVALID_INPUT", "Data non valida — usa il formato YYYY-MM-DD");

  const eventDate = new Date(args.date);
  if (isNaN(eventDate.getTime())) return err("INVALID_INPUT", "Data non valida");
  if (eventDate < new Date(Date.now() - 24 * 60 * 60 * 1000)) return err("INVALID_INPUT", "La data deve essere futura");

  if (!checkWriteRateLimit(userId, "add_calendar_event"))
    return err("LIMIT_EXCEEDED", "Troppi eventi aggiunti di recente. Riprova tra un po'.");

  try {
    const endDate = new Date(eventDate);
    endDate.setHours(eventDate.getHours() + 1);
    const [row] = await db
      .insert(calendarEventsTable)
      .values({
        userId,
        title:       args.title.trim().slice(0, 200),
        description: args.notes?.slice(0, 500),
        startAt:     eventDate,
        endAt:       endDate,
        allDay:      true,
        category:    (args.type ?? "task") as any,
      })
      .returning({ id: calendarEventsTable.id });
    return { ok: true, data: { ok: true, id: row.id, date: args.date } };
  } catch (e) {
    logger.warn({ e, userId }, "[tool] add_calendar_event error");
    return err("UNAVAILABLE", "Errore nell'aggiunta dell'evento");
  }
}

// ── 17. get_user_context ─────────────────────────────────────────────────────

export async function handleGetUserContext(
  _args: Record<string, never>,
  userId: number,
): Promise<ToolResult> {
  try {
    // User base — solo journeyType, nessun campo sensibile
    const [user] = await db
      .select({ journeyType: usersTable.journeyType })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    // Top 3 obiettivi attivi
    const objectives = await db
      .select({ text: userObjectivesTable.text, progress: userObjectivesTable.progress })
      .from(userObjectivesTable)
      .where(and(eq(userObjectivesTable.userId, userId), eq(userObjectivesTable.completed, false), isNull(userObjectivesTable.deletedAt)))
      .limit(3);

    // Max 5 fatti biografici (mai email, mai dati finanziari)
    const facts = await db
      .select({ key: coachMemoryFactsTable.key, value: coachMemoryFactsTable.value })
      .from(coachMemoryFactsTable)
      .where(and(eq(coachMemoryFactsTable.userId, userId), isNull(coachMemoryFactsTable.deletedAt)))
      .orderBy(desc(coachMemoryFactsTable.confirmedCount))
      .limit(5);

    // Settori preferiti (max 3)
    const favorites = await db
      .select({ id: sectorsTable.id, name: sectorsTable.name })
      .from(userFavoritesTable)
      .innerJoin(sectorsTable, eq(userFavoritesTable.sectorId, sectorsTable.id))
      .where(eq(userFavoritesTable.userId, userId))
      .limit(3);

    return {
      ok: true,
      data: {
        journeyType:      user?.journeyType ?? null,
        topObjectives:    objectives,
        memoryFacts:      facts,
        preferredSectors: favorites,
      },
    };
  } catch (e) {
    logger.warn({ e, userId }, "[tool] get_user_context error");
    return err("UNAVAILABLE", "Contesto utente temporaneamente non disponibile");
  }
}

// ── Dispatcher centrale ───────────────────────────────────────────────────────

export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  userId: number,
): Promise<ToolResult> {
  switch (name) {
    case "open_view":                  return handleOpenView(args as any);
    case "set_filters":                return handleSetFilters(args as any);
    case "get_sector_detail":          return handleGetSectorDetail(args as any);
    case "list_sectors":               return handleListSectors(args as any);
    case "get_profession_detail":      return handleGetProfessionDetail(args as any);
    case "search_professions":         return handleSearchProfessions(args as any);
    case "compare_sectors":            return handleCompareSectors(args as any);
    case "get_market_trend":           return handleGetMarketTrend(args as any);
    case "get_user_objectives":        return handleGetUserObjectives({} as any, userId);
    case "save_objective":             return handleSaveObjective(args as any, userId);
    case "update_objective_progress":  return handleUpdateObjectiveProgress(args as any, userId);
    case "get_growth_articles":        return handleGetGrowthArticles(args as any);
    case "get_news_summary":           return handleGetNewsSummary(args as any);
    case "get_learning_paths":         return handleGetLearningPaths(args as any);
    case "save_business_idea":         return handleSaveBusinessIdea(args as any, userId);
    case "add_calendar_event":         return handleAddCalendarEvent(args as any, userId);
    case "get_user_context":           return handleGetUserContext({} as any, userId);

    // Legacy aliases (compatibilità con tool già esistenti)
    case "get_sector":         return handleGetSectorDetail({ sectorId: (args.id as number) });
    case "get_profession":     return handleGetProfessionDetail({ professionId: (args.id as number) });
    case "navigate":           return handleOpenView({ viewId: "dashboard", ...args } as any);
    case "filter_list":        return handleSetFilters({ listType: (args.type ?? "sectors") as string, filters: args } );
    case "save_objective":     return handleSaveObjective(args as any, userId);

    default:
      logger.warn({ name }, "[tool] unknown tool call");
      return err("NOT_FOUND", `Tool "${name}" non riconosciuto`);
  }
}
