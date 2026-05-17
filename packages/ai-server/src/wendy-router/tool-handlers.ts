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
import { eq, and, ilike, or, isNull, desc, inArray, isNotNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
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
  ragChunksTable,
  ragSourcesTable,
  weakSignalsTable,
  jobPostingSnapshotsTable,
  skillCooccurrencesTable,
} from "@workspace/db";
import { generateEmbedding } from "../embeddings/generate";
import { recordToolCall } from "../metrics";
import { logger } from "../logger";

// ── Cache embedding query (LRU semplice con TTL 5 min) ───────────────────────
const _embCache = new Map<string, { vec: number[]; ts: number }>();
const EMB_TTL_MS = 5 * 60 * 1000;

async function queryEmbedding(text: string): Promise<number[] | null> {
  const key = text.slice(0, 200);
  const cached = _embCache.get(key);
  if (cached && Date.now() - cached.ts < EMB_TTL_MS) return cached.vec;
  const vec = await generateEmbedding(text);
  if (vec) _embCache.set(key, { vec, ts: Date.now() });
  // Limita la cache a 200 entry
  if (_embCache.size > 200) {
    const oldest = [..._embCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) _embCache.delete(oldest[0]);
  }
  return vec;
}

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
  args: { trend?: string; limit?: number; query?: string },
): Promise<ToolResult> {
  const limit = Math.min(args.limit ?? 5, 10);
  try {
    // Ricerca semantica se viene passata una query testuale (e nessun filtro trend)
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

    // Default: filtra per trend (o tutti ordinati per growthRate)
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
  const limit = Math.min(args.limit ?? 5, 8);

  try {
    // Prova prima la ricerca semantica (pgvector) se il DB ha gli embedding
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

    // Fallback ILIKE — embedding non disponibile o nessun risultato semantico
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

// ── 18. search_rag ───────────────────────────────────────────────────────────

export async function handleSearchRag(
  args: {
    query: string;
    filters?: {
      geography?:      string[];
      sourceTypes?:    string[];
      minTrustScore?:  number;
      maxAgeMonths?:   number;
    };
    topK?: number;
  },
): Promise<ToolResult> {
  if (!args.query?.trim()) return err("INVALID_INPUT", "Query RAG vuota");

  const topK = Math.min(args.topK ?? 5, 10);
  const minTrust = args.filters?.minTrustScore ?? 0.55;
  const maxAgeMonths = args.filters?.maxAgeMonths ?? 24;
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - maxAgeMonths);

  try {
    const vec = await queryEmbedding(args.query).catch(() => null);
    if (!vec) return err("UNAVAILABLE", "Servizio embedding temporaneamente non disponibile");

    const vectorLiteral = `[${vec.join(",")}]`;

    // Costruisci filtri geografici come condizione SQL
    const geoFilter = args.filters?.geography?.length
      ? sql`AND rc.geography && ${args.filters.geography}::text[]`
      : sql``;

    const sourceTypeFilter = args.filters?.sourceTypes?.length
      ? sql`AND rs.source_type = ANY(${args.filters.sourceTypes}::text[])`
      : sql``;

    const rows = await db.execute<{
      id:          number;
      content:     string;
      source_name: string;
      published_at: string | null;
      geography:   string[];
      trust_score: number;
      similarity:  number;
    }>(sql`
      SELECT
        rc.id,
        rc.content,
        rs.name AS source_name,
        rc.published_at,
        rc.geography,
        rc.trust_score,
        1 - (rc.embedding <=> ${vectorLiteral}::vector) AS similarity
      FROM rag_chunks rc
      JOIN rag_sources rs ON rc.source_id = rs.id
      WHERE rc.embedding IS NOT NULL
        AND rc.trust_score >= ${minTrust}
        AND (rc.published_at IS NULL OR rc.published_at >= ${cutoffDate.toISOString()}::timestamptz)
        ${geoFilter}
        ${sourceTypeFilter}
      ORDER BY rc.embedding <=> ${vectorLiteral}::vector
      LIMIT ${topK}
    `);

    if (rows.rows.length === 0) {
      return { ok: true, data: { chunks: [], totalFound: 0 } };
    }

    return {
      ok: true,
      data: {
        chunks: rows.rows.map((r) => ({
          content:     r.content,
          sourceName:  r.source_name,
          publishedAt: r.published_at ?? "",
          geography:   r.geography,
          similarity:  Math.round(r.similarity * 1000) / 1000,
          trustScore:  r.trust_score,
        })),
        totalFound: rows.rows.length,
      },
    };
  } catch (e) {
    logger.warn({ e, args }, "[tool] search_rag error");
    return err("UNAVAILABLE", "Ricerca knowledge base temporaneamente non disponibile");
  }
}

// ── 19. get_weak_signals ─────────────────────────────────────────────────────

export async function handleGetWeakSignals(
  args: {
    sectorId?: string;
    status?:   string;
    limit?:    number;
    geography?: string;
  },
): Promise<ToolResult> {
  const limit = Math.min(args.limit ?? 5, 10);
  const status = args.status ?? "confirmed";

  try {
    const rows = await db
      .select({
        id:              weakSignalsTable.id,
        signalType:      weakSignalsTable.signalType,
        title:           weakSignalsTable.title,
        description:     weakSignalsTable.description,
        strength:        weakSignalsTable.strength,
        status:          weakSignalsTable.status,
        linkedRoleIds:   weakSignalsTable.linkedRoleIds,
        linkedSkillIds:  weakSignalsTable.linkedSkillIds,
        geographies:     weakSignalsTable.geographies,
        firstSeenAt:     weakSignalsTable.firstSeenAt,
      })
      .from(weakSignalsTable)
      .where(
        and(
          eq(weakSignalsTable.status, status as any),
          args.sectorId
            ? sql`${weakSignalsTable.linkedSectorIds} @> ARRAY[${args.sectorId}]::text[]`
            : undefined,
          args.geography
            ? sql`${weakSignalsTable.geographies} @> ARRAY[${args.geography}]::text[]`
            : undefined,
        ),
      )
      .orderBy(desc(weakSignalsTable.strength))
      .limit(limit);

    return {
      ok: true,
      data: {
        signals: rows.map((s) => ({
          id:           s.id,
          signalType:   s.signalType,
          title:        s.title,
          description:  s.description,
          strength:     Math.round(s.strength * 100) / 100,
          status:       s.status,
          linkedRoles:  s.linkedRoleIds,
          linkedSkills: s.linkedSkillIds,
          geographies:  s.geographies,
          firstSeenAt:  s.firstSeenAt?.toISOString() ?? "",
        })),
        totalFound: rows.length,
      },
    };
  } catch (e) {
    logger.warn({ e, args }, "[tool] get_weak_signals error");
    return err("UNAVAILABLE", "Segnali deboli temporaneamente non disponibili");
  }
}

// ── 20. get_job_posting_trend ────────────────────────────────────────────────

export async function handleGetJobPostingTrend(
  args: {
    roleTitle?:   string;
    professionId?: number;
    geography:    string;
    periods:      string[];
  },
): Promise<ToolResult> {
  if (!args.roleTitle && !args.professionId)
    return err("INVALID_INPUT", "Specifica roleTitle o professionId");
  if (!args.periods?.length)
    return err("INVALID_INPUT", "Specifica almeno un periodo (es. '2025-01')");

  const periods = args.periods.slice(0, 12); // max 12 mesi

  try {
    const rows = await db
      .select({
        period:       jobPostingSnapshotsTable.period,
        count:        jobPostingSnapshotsTable.count,
        topSkills:    jobPostingSnapshotsTable.topSkills,
        avgSalaryMin: jobPostingSnapshotsTable.avgSalaryMin,
        avgSalaryMax: jobPostingSnapshotsTable.avgSalaryMax,
        growthRate:   jobPostingSnapshotsTable.growthRate,
        roleTitle:    jobPostingSnapshotsTable.roleTitle,
      })
      .from(jobPostingSnapshotsTable)
      .where(
        and(
          eq(jobPostingSnapshotsTable.geography, args.geography),
          sql`${jobPostingSnapshotsTable.period} = ANY(${periods}::text[])`,
          args.professionId
            ? eq(jobPostingSnapshotsTable.professionId, args.professionId)
            : ilike(jobPostingSnapshotsTable.roleTitle, `%${args.roleTitle}%`),
        ),
      )
      .orderBy(jobPostingSnapshotsTable.period)
      .limit(12);

    if (rows.length === 0) {
      return { ok: true, data: { roleTitle: args.roleTitle ?? "", trend: [], growthRate: 0, direction: "stable" } };
    }

    const first = rows[0].count;
    const last  = rows[rows.length - 1].count;
    const growthRate = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
    const direction  = growthRate > 5 ? "up" : growthRate < -5 ? "down" : "stable";

    return {
      ok: true,
      data: {
        roleTitle:  rows[0].roleTitle,
        trend:      rows.map((r) => ({
          period:       r.period,
          count:        r.count,
          topSkills:    r.topSkills,
          avgSalaryMin: r.avgSalaryMin,
          avgSalaryMax: r.avgSalaryMax,
        })),
        growthRate,
        direction,
      },
    };
  } catch (e) {
    logger.warn({ e, args }, "[tool] get_job_posting_trend error");
    return err("UNAVAILABLE", "Trend job posting temporaneamente non disponibili");
  }
}

// ── 21. get_skill_cooccurrences ──────────────────────────────────────────────

export async function handleGetSkillCooccurrences(
  args: {
    skillName:    string;
    professionId?: number;
    limit?:        number;
  },
): Promise<ToolResult> {
  if (!args.skillName?.trim()) return err("INVALID_INPUT", "skillName obbligatorio");
  const limit = Math.min(args.limit ?? 8, 15);

  try {
    const rows = await db
      .select({
        coSkillName:   skillCooccurrencesTable.coSkillName,
        frequency:     skillCooccurrencesTable.frequency,
        frequencyRate: skillCooccurrencesTable.frequencyRate,
        period:        skillCooccurrencesTable.period,
      })
      .from(skillCooccurrencesTable)
      .where(
        and(
          ilike(skillCooccurrencesTable.skillName, args.skillName),
          args.professionId
            ? eq(skillCooccurrencesTable.professionId, args.professionId)
            : undefined,
        ),
      )
      .orderBy(desc(skillCooccurrencesTable.frequencyRate))
      .limit(limit);

    return {
      ok: true,
      data: {
        skill:    args.skillName,
        coSkills: rows.map((r) => ({
          name:          r.coSkillName,
          frequency:     r.frequency,
          frequencyRate: Math.round(r.frequencyRate * 1000) / 10, // percentuale
          period:        r.period,
        })),
      },
    };
  } catch (e) {
    logger.warn({ e, args }, "[tool] get_skill_cooccurrences error");
    return err("UNAVAILABLE", "Co-occorrenze skill temporaneamente non disponibili");
  }
}

// ── Dispatcher centrale ───────────────────────────────────────────────────────

export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  userId: number,
): Promise<ToolResult> {
  const t0 = Date.now();
  let result: ToolResult;

  switch (name) {
    case "open_view":                  result = await handleOpenView(args as any); break;
    case "set_filters":                result = await handleSetFilters(args as any); break;
    case "get_sector_detail":          result = await handleGetSectorDetail(args as any); break;
    case "list_sectors":               result = await handleListSectors(args as any); break;
    case "get_profession_detail":      result = await handleGetProfessionDetail(args as any); break;
    case "search_professions":         result = await handleSearchProfessions(args as any); break;
    case "compare_sectors":            result = await handleCompareSectors(args as any); break;
    case "get_market_trend":           result = await handleGetMarketTrend(args as any); break;
    case "get_user_objectives":        result = await handleGetUserObjectives({} as any, userId); break;
    case "save_objective":             result = await handleSaveObjective(args as any, userId); break;
    case "update_objective_progress":  result = await handleUpdateObjectiveProgress(args as any, userId); break;
    case "get_growth_articles":        result = await handleGetGrowthArticles(args as any); break;
    case "get_news_summary":           result = await handleGetNewsSummary(args as any); break;
    case "get_learning_paths":         result = await handleGetLearningPaths(args as any); break;
    case "save_business_idea":         result = await handleSaveBusinessIdea(args as any, userId); break;
    case "add_calendar_event":         result = await handleAddCalendarEvent(args as any, userId); break;
    case "get_user_context":           result = await handleGetUserContext({} as any, userId); break;

    // Step 6: RAG + Job Market Intelligence
    case "search_rag":               result = await handleSearchRag(args as any); break;
    case "get_weak_signals":         result = await handleGetWeakSignals(args as any); break;
    case "get_job_posting_trend":    result = await handleGetJobPostingTrend(args as any); break;
    case "get_skill_cooccurrences":  result = await handleGetSkillCooccurrences(args as any); break;

    // Legacy aliases
    case "get_sector":    result = await handleGetSectorDetail({ sectorId: (args.id as number) }); break;
    case "get_profession":result = await handleGetProfessionDetail({ professionId: (args.id as number) }); break;
    case "navigate":      result = await handleOpenView({ viewId: "dashboard", ...args } as any); break;
    case "filter_list":   result = await handleSetFilters({ listType: (args.type ?? "sectors") as string, filters: args }); break;

    default:
      logger.warn({ name }, "[tool] unknown tool call");
      result = err("NOT_FOUND", `Tool "${name}" non riconosciuto`);
  }

  // Metriche Prometheus per ogni tool call
  recordToolCall(name, result.ok ? "ok" : "error", (Date.now() - t0) / 1000);
  return result;
}
