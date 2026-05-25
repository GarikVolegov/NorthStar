import { and, desc, eq, isNull } from "drizzle-orm";
import { businessIdeasTable, calendarEventsTable, coachMemoryFactsTable, db, sectorsTable, userFavoritesTable, usersTable, userObjectivesTable } from "@workspace/db";
import { logger } from "../logger";
import { checkWriteRateLimit, err, type ToolResult } from "./tool-handlers";
import { readCalendarCategory } from "./tool-arg-utils";

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
    if (!row) return err("UNAVAILABLE", "Errore nel salvataggio dell'idea");
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
        category:    readCalendarCategory(args.type),
      })
      .returning({ id: calendarEventsTable.id });
    if (!row) return err("UNAVAILABLE", "Errore nell'aggiunta dell'evento");
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
