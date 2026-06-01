import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth";
import { eq, and, gte, asc, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db, calendarEventsTable } from "@workspace/db";
import {
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { it } from "date-fns/locale";
import { isPersistenceSchemaError, sendOptionalReadFallback } from "../lib/persistence";
import { getRequestBody } from "../lib/request-context";
import { asPlainRecord, isOneOf } from "../lib/type-guards";

const router = Router();
const FREE_CALENDAR_EVENT_LIMIT = 25;

function sendCalendarPersistenceError(req: Request, res: Response, err: unknown) {
  if (!isPersistenceSchemaError(err)) return false;
  req.log?.warn?.(
    { err, route: "calendar.write", userId: req.user?.id, persistenceUnavailable: true },
    "calendar persistence unavailable",
  );
  res.status(503).json({
    status: "error",
    code: "CALENDAR_PERSISTENCE_UNAVAILABLE",
    error: "Persistenza calendario non disponibile. Nessuna modifica e' stata salvata.",
    action: "retry_after_persistence_restored",
    persistenceUnavailable: true,
    setupAction: "run_migrations",
  });
  return true;
}

const EVENT_CATEGORIES = [
  "study",
  "training",
  "interview",
  "deadline",
  "task",
  "follow-up",
] as const;
const EVENT_PRIORITIES = ["low", "medium", "high"] as const;
const EVENT_STATUSES = ["todo", "in-progress", "done", "postponed"] as const;

type CalendarEventInput = Record<string, unknown>;

function parseDateInput(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function enumValue<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number],
): T[number] {
  return isOneOf(value, allowed) ? value : fallback;
}

function arrayValue<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value)
    ? value.filter((item): item is T => item != null)
    : fallback;
}

function normalizeCalendarEventCreate(body: CalendarEventInput) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return { error: "Titolo obbligatorio" };
  }

  const startAt = parseDateInput(body.startAt);
  const endAt = parseDateInput(body.endAt);
  if (!startAt || !endAt) {
    return { error: "Date evento non valide" };
  }

  return {
    data: {
      title,
      description:
        typeof body.description === "string" ? body.description : null,
      startAt,
      endAt,
      allDay: typeof body.allDay === "boolean" ? body.allDay : false,
      category: enumValue(body.category, EVENT_CATEGORIES, "task"),
      priority: enumValue(body.priority, EVENT_PRIORITIES, "medium"),
      status: enumValue(body.status, EVENT_STATUSES, "todo"),
      color: typeof body.color === "string" ? body.color : null,
      tags: arrayValue<string>(body.tags, []),
      linkedSectorId:
        typeof body.linkedSectorId === "number" ? body.linkedSectorId : null,
      linkedGoal: typeof body.linkedGoal === "string" ? body.linkedGoal : null,
      linkedContentIds: arrayValue<number>(body.linkedContentIds, []),
      isRecurring:
        typeof body.isRecurring === "boolean" ? body.isRecurring : false,
      recurrenceRule:
        typeof body.recurrenceRule === "string" ? body.recurrenceRule : null,
    },
  };
}

function normalizeCalendarEventUpdate(body: CalendarEventInput) {
  const data: CalendarEventInput = {};

  if ("title" in body) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return { error: "Titolo obbligatorio" };
    data.title = title;
  }

  if ("description" in body) {
    data.description =
      typeof body.description === "string" ? body.description : null;
  }
  if ("startAt" in body) {
    const startAt = parseDateInput(body.startAt);
    if (!startAt) return { error: "Data inizio evento non valida" };
    data.startAt = startAt;
  }
  if ("endAt" in body) {
    const endAt = parseDateInput(body.endAt);
    if (!endAt) return { error: "Data fine evento non valida" };
    data.endAt = endAt;
  }
  if ("allDay" in body)
    data.allDay = typeof body.allDay === "boolean" ? body.allDay : false;
  if ("category" in body)
    data.category = enumValue(body.category, EVENT_CATEGORIES, "task");
  if ("priority" in body)
    data.priority = enumValue(body.priority, EVENT_PRIORITIES, "medium");
  if ("status" in body)
    data.status = enumValue(body.status, EVENT_STATUSES, "todo");
  if ("color" in body)
    data.color = typeof body.color === "string" ? body.color : null;
  if ("tags" in body) data.tags = arrayValue<string>(body.tags, []);
  if ("linkedSectorId" in body) {
    data.linkedSectorId =
      typeof body.linkedSectorId === "number" ? body.linkedSectorId : null;
  }
  if ("linkedGoal" in body)
    data.linkedGoal =
      typeof body.linkedGoal === "string" ? body.linkedGoal : null;
  if ("linkedContentIds" in body)
    data.linkedContentIds = arrayValue<number>(body.linkedContentIds, []);
  if ("isRecurring" in body)
    data.isRecurring =
      typeof body.isRecurring === "boolean" ? body.isRecurring : false;
  if ("recurrenceRule" in body) {
    data.recurrenceRule =
      typeof body.recurrenceRule === "string" ? body.recurrenceRule : null;
  }

  return { data };
}

function parseEventId(value: string | undefined): number | null {
  const eventId = Number.parseInt(value ?? "", 10);
  return Number.isFinite(eventId) && eventId > 0 ? eventId : null;
}

async function countUserCalendarEvents(userId: number): Promise<number> {
  try {
    if (typeof db.select !== "function") return 0;
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(calendarEventsTable)
      .where(eq(calendarEventsTable.userId, userId));
    return Number(row?.count ?? 0);
  } catch {
    return 0;
  }
}

router.get("/quota", requireAuth, async (req, res) => {
  const user = req.user!;
  const isPremium = Boolean(user.stripeSubscriptionId);
  const eventCount = await countUserCalendarEvents(user.id);

  res.json({
    isPremium,
    eventCount,
    eventLimit: isPremium ? null : FREE_CALENDAR_EVENT_LIMIT,
  });
});

/* ─── GET /api/calendar/events  —  eventi filtrati per data ─── */
router.get("/events", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { from, to } = req.query;

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (from) {
      startDate = parseISO(from as string);
    }
    if (to) {
      endDate = parseISO(to as string);
    }

    // Default to current month if no dates provided
    if (!startDate && !endDate) {
      const now = new Date();
      startDate = startOfWeek(startOfMonth(now), { locale: it });
      endDate = endOfWeek(endOfMonth(now), { locale: it });
    }

    const conditions: SQL[] = [eq(calendarEventsTable.userId, userId)];
    if (startDate) conditions.push(gte(calendarEventsTable.startAt, startDate));
    if (endDate)
      conditions.push(sql`${calendarEventsTable.endAt} <= ${endDate}`);

    const events = await db
      .select({
        id: calendarEventsTable.id,
        title: calendarEventsTable.title,
        description: calendarEventsTable.description,
        startAt: calendarEventsTable.startAt,
        endAt: calendarEventsTable.endAt,
        allDay: calendarEventsTable.allDay,
        category: calendarEventsTable.category,
        priority: calendarEventsTable.priority,
        status: calendarEventsTable.status,
        color: calendarEventsTable.color,
        tags: calendarEventsTable.tags,
        linkedSectorId: calendarEventsTable.linkedSectorId,
        linkedGoal: calendarEventsTable.linkedGoal,
        linkedContentIds: calendarEventsTable.linkedContentIds,
        isRecurring: calendarEventsTable.isRecurring,
        recurrenceRule: calendarEventsTable.recurrenceRule,
      })
      .from(calendarEventsTable)
      .where(and(...conditions))
      .orderBy(asc(calendarEventsTable.startAt));

    res.json({ events });
  } catch (err) {
    req.log?.error?.({ err }, "calendar events error");
    res
      .status(500)
      .json({
        status: "error",
        code: "CALENDAR_EVENTS_LOAD_FAILED",
        error: "Errore nel caricamento degli eventi del calendario",
        action: "retry_calendar_load",
      });
  }
});

/* ─── GET /api/calendar/events/:id  —  singolo evento ─── */
router.get("/events/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const eventId = parseEventId(req.params.id);
    if (!eventId) {
      res.status(400).json({
        code: "CALENDAR_EVENT_INVALID_ID",
        error: "ID evento non valido",
        action: "refresh_calendar",
      });
      return;
    }

    const [event] = await db
      .select({
        id: calendarEventsTable.id,
        title: calendarEventsTable.title,
        description: calendarEventsTable.description,
        startAt: calendarEventsTable.startAt,
        endAt: calendarEventsTable.endAt,
        allDay: calendarEventsTable.allDay,
        category: calendarEventsTable.category,
        priority: calendarEventsTable.priority,
        status: calendarEventsTable.status,
        color: calendarEventsTable.color,
        tags: calendarEventsTable.tags,
        linkedSectorId: calendarEventsTable.linkedSectorId,
        linkedGoal: calendarEventsTable.linkedGoal,
        linkedContentIds: calendarEventsTable.linkedContentIds,
        isRecurring: calendarEventsTable.isRecurring,
        recurrenceRule: calendarEventsTable.recurrenceRule,
      })
      .from(calendarEventsTable)
      .where(
        and(
          eq(calendarEventsTable.id, eventId),
          eq(calendarEventsTable.userId, userId),
        ),
      );

    if (!event) {
      res.status(404).json({
        code: "CALENDAR_EVENT_NOT_FOUND",
        error: "Evento non trovato",
        action: "refresh_calendar",
      });
      return;
    }

    res.json(event);
  } catch (err) {
    req.log?.error?.({ err }, "calendar event get error");
    res.status(500).json({
      status: "error",
      code: "CALENDAR_EVENT_LOAD_FAILED",
      error: "Errore nel caricamento dell'evento",
      action: "retry_calendar_load",
    });
  }
});

/* ─── POST /api/calendar/events  —  crea evento ─── */
router.post("/events", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const normalized = normalizeCalendarEventCreate(
      asPlainRecord(getRequestBody(req)),
    );
    if ("error" in normalized) {
      res.status(400).json({
        code: "CALENDAR_EVENT_INVALID_INPUT",
        error: normalized.error,
        action: "correct_event_form",
      });
      return;
    }

    const [event] = await db
      .insert(calendarEventsTable)
      .values({
        userId,
        ...normalized.data,
      })
      .returning();

    res.status(201).json(event);
  } catch (err) {
    req.log?.error?.({ err }, "calendar event create error");
    if (sendCalendarPersistenceError(req, res, err)) return;
    res.status(500).json({
      status: "error",
      code: "CALENDAR_EVENT_CREATE_FAILED",
      error: "Errore nella creazione dell'evento",
      action: "retry_calendar_save",
    });
  }
});

/* ─── PATCH /api/calendar/events/:id  —  aggiorna evento ─── */
router.patch("/events/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const eventId = parseEventId(req.params.id);
    if (!eventId) {
      res.status(400).json({
        code: "CALENDAR_EVENT_INVALID_ID",
        error: "ID evento non valido",
        action: "refresh_calendar",
      });
      return;
    }
    const normalized = normalizeCalendarEventUpdate(
      asPlainRecord(getRequestBody(req)),
    );
    if ("error" in normalized) {
      res.status(400).json({
        code: "CALENDAR_EVENT_INVALID_INPUT",
        error: normalized.error,
        action: "correct_event_form",
      });
      return;
    }

    const [event] = await db
      .update(calendarEventsTable)
      .set(normalized.data)
      .where(
        and(
          eq(calendarEventsTable.id, eventId),
          eq(calendarEventsTable.userId, userId),
        ),
      )
      .returning();

    if (!event) {
      res.status(404).json({
        code: "CALENDAR_EVENT_NOT_FOUND",
        error: "Evento non trovato",
        action: "refresh_calendar",
      });
      return;
    }

    res.json(event);
  } catch (err) {
    req.log?.error?.({ err }, "calendar event update error");
    if (sendCalendarPersistenceError(req, res, err)) return;
    res.status(500).json({
      status: "error",
      code: "CALENDAR_EVENT_UPDATE_FAILED",
      error: "Errore nell'aggiornamento dell'evento",
      action: "retry_calendar_save",
    });
  }
});

/* ─── DELETE /api/calendar/events/:id  —  elimina evento ─── */
router.delete("/events/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const eventId = parseEventId(req.params.id);
    if (!eventId) {
      res.status(400).json({
        code: "CALENDAR_EVENT_INVALID_ID",
        error: "ID evento non valido",
        action: "refresh_calendar",
      });
      return;
    }

    const deleted = await db
      .delete(calendarEventsTable)
      .where(
        and(
          eq(calendarEventsTable.id, eventId),
          eq(calendarEventsTable.userId, userId),
        ),
      )
      .returning({ id: calendarEventsTable.id });

    if (deleted.length === 0) {
      res.status(404).json({
        code: "CALENDAR_EVENT_NOT_FOUND",
        error: "Evento non trovato",
        action: "refresh_calendar",
      });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "calendar event delete error");
    if (sendCalendarPersistenceError(req, res, err)) return;
    res.status(500).json({
      status: "error",
      code: "CALENDAR_EVENT_DELETE_FAILED",
      error: "Errore nell'eliminazione dell'evento",
      action: "retry_calendar_delete",
    });
  }
});

/* ─── GET /api/calendar/upcoming  —  eventi imminenti (retrocompatibilità) ─── */
router.get("/upcoming", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const now = new Date();
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 5, 20));

    const events = await db
      .select({
        id: calendarEventsTable.id,
        title: calendarEventsTable.title,
        description: calendarEventsTable.description,
        category: calendarEventsTable.category,
        startAt: calendarEventsTable.startAt,
        endAt: calendarEventsTable.endAt,
        allDay: calendarEventsTable.allDay,
        priority: calendarEventsTable.priority,
        status: calendarEventsTable.status,
      })
      .from(calendarEventsTable)
      .where(
        and(
          eq(calendarEventsTable.userId, userId),
          gte(calendarEventsTable.endAt, now),
        ),
      )
      .orderBy(asc(calendarEventsTable.startAt))
      .limit(limit);

    res.json(events);
  } catch (err) {
    req.log?.error?.({ err }, "calendar upcoming error");
    if (sendOptionalReadFallback(req, res, err, "calendar.upcoming", []))
      return;
    res
      .status(500)
      .json({ error: "Errore nel caricamento degli eventi imminenti" });
  }
});

/* ─── GET /api/calendar/export.ics  —  esporta in iCal ─── */
router.get("/export.ics", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const events = await db
      .select({
        id: calendarEventsTable.id,
        title: calendarEventsTable.title,
        description: calendarEventsTable.description,
        startAt: calendarEventsTable.startAt,
        endAt: calendarEventsTable.endAt,
        allDay: calendarEventsTable.allDay,
      })
      .from(calendarEventsTable)
      .where(eq(calendarEventsTable.userId, userId))
      .orderBy(asc(calendarEventsTable.startAt));

    // Generate iCal content
    let icsContent = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//NorthStar//Calendar//IT\n`;

    for (const event of events) {
      const startDate = new Date(event.startAt);
      const endDate = new Date(event.endAt);

      icsContent += `BEGIN:VEVENT\n`;
      icsContent += `UID:${event.id}@northstar.it\n`;
      icsContent += `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "")}Z\n`;
      icsContent += `DTSTART:${startDate.toISOString().replace(/[-:]/g, "").replace(/\..+/, "")}Z\n`;
      icsContent += `DTEND:${endDate.toISOString().replace(/[-:]/g, "").replace(/\..+/, "")}Z\n`;
      icsContent += `SUMMARY:${event.title}\n`;
      if (event.description) {
        icsContent += `DESCRIPTION:${event.description}\n`;
      }
      icsContent += `END:VEVENT\n`;
    }

    icsContent += `END:VCALENDAR`;

    res.setHeader("Content-Type", "text/calendar");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="northstar-calendar.ics"',
    );
    res.send(icsContent);
  } catch (err) {
    req.log?.error?.({ err }, "calendar export error");
    res.status(500).json({ error: "Errore nell'esportazione del calendario" });
  }
});

export default router;
