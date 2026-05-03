import { Router, type IRouter, type Request, type Response } from "express";
import { db, calendarEventsTable, eventRemindersTable, usersTable } from "@workspace/db";
import { eq, and, gte, lte, asc, count, inArray } from "drizzle-orm";
import { z } from "zod";
import { authMiddleware } from "../lib/auth-jwt.js";

const router: IRouter = Router();
router.use(authMiddleware);

const FREE_EVENT_LIMIT = 20;
const FREE_ALLOWED_MINUTES = [30, 120] as const;
const ALL_ALLOWED_MINUTES = [10, 30, 120, 1440] as const;

const CATEGORY_VALUES = ["study", "training", "interview", "deadline", "task", "follow-up"] as const;
const PRIORITY_VALUES = ["low", "medium", "high"] as const;
const STATUS_VALUES = ["todo", "in-progress", "done", "postponed"] as const;

type CalendarEvent = typeof calendarEventsTable.$inferSelect;
type EventReminder = typeof eventRemindersTable.$inferSelect;

async function isPremium(userId: number): Promise<boolean> {
  const [user] = await db
    .select({ stripeSubscriptionId: usersTable.stripeSubscriptionId })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return !!user?.stripeSubscriptionId;
}

async function getUserEventCount(userId: number): Promise<number> {
  const [result] = await db
    .select({ value: count() })
    .from(calendarEventsTable)
    .where(eq(calendarEventsTable.userId, userId));
  return Number(result?.value ?? 0);
}

async function getEventAndVerifyOwner(
  eventId: number,
  userId: number,
): Promise<CalendarEvent | null> {
  const [event] = await db
    .select()
    .from(calendarEventsTable)
    .where(and(eq(calendarEventsTable.id, eventId), eq(calendarEventsTable.userId, userId)));
  return event ?? null;
}

async function getRemindersForEvent(eventId: number): Promise<EventReminder[]> {
  return db
    .select()
    .from(eventRemindersTable)
    .where(eq(eventRemindersTable.eventId, eventId));
}

const reminderInputSchema = z.object({
  minutesBefore: z.number().int().positive(),
  enabled: z.boolean().default(true),
});

const createEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  allDay: z.boolean().default(false),
  category: z.enum(CATEGORY_VALUES).default("task"),
  priority: z.enum(PRIORITY_VALUES).default("medium"),
  status: z.enum(STATUS_VALUES).default("todo"),
  color: z.string().max(20).optional().nullable(),
  tags: z.array(z.string().max(50)).max(10).default([]),
  linkedSectorId: z.number().int().optional().nullable(),
  linkedGoal: z.string().max(200).optional().nullable(),
  linkedContentIds: z.array(z.number().int()).default([]),
  isRecurring: z.boolean().default(false),
  recurrenceRule: z.string().max(200).optional().nullable(),
  reminders: z.array(reminderInputSchema).max(4).default([]),
});

const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  allDay: z.boolean().optional(),
  category: z.enum(CATEGORY_VALUES).optional(),
  priority: z.enum(PRIORITY_VALUES).optional(),
  status: z.enum(STATUS_VALUES).optional(),
  color: z.string().max(20).optional().nullable(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  linkedSectorId: z.number().int().optional().nullable(),
  linkedGoal: z.string().max(200).optional().nullable(),
  linkedContentIds: z.array(z.number().int()).optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().max(200).optional().nullable(),
  reminders: z.array(reminderInputSchema).max(4).optional(),
});

function hasDisallowedReminder(
  reminders: z.infer<typeof reminderInputSchema>[],
  premium: boolean,
): boolean {
  const allowed: readonly number[] = premium ? ALL_ALLOWED_MINUTES : FREE_ALLOWED_MINUTES;
  return reminders.some((r) => !(allowed as number[]).includes(r.minutesBefore));
}

router.get("/calendar/quota", async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.userId as number;
  const [premium, eventCount] = await Promise.all([isPremium(userId), getUserEventCount(userId)]);
  res.json({ isPremium: premium, eventCount, eventLimit: premium ? null : FREE_EVENT_LIMIT });
});

router.get("/calendar/events", async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.userId as number;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  const conditions: Parameters<typeof and> = [eq(calendarEventsTable.userId, userId)];
  if (from) conditions.push(gte(calendarEventsTable.startAt, new Date(from)));
  if (to) conditions.push(lte(calendarEventsTable.startAt, new Date(to)));

  const events = await db
    .select()
    .from(calendarEventsTable)
    .where(and(...conditions))
    .orderBy(asc(calendarEventsTable.startAt));

  let allReminders: EventReminder[] = [];
  if (events.length > 0) {
    allReminders = await db
      .select()
      .from(eventRemindersTable)
      .where(inArray(eventRemindersTable.eventId, events.map((e) => e.id)));
  }

  const remindersByEvent = new Map<number, EventReminder[]>();
  for (const r of allReminders) {
    if (!remindersByEvent.has(r.eventId)) remindersByEvent.set(r.eventId, []);
    remindersByEvent.get(r.eventId)!.push(r);
  }

  res.json({ events: events.map((e) => ({ ...e, reminders: remindersByEvent.get(e.id) ?? [] })) });
});

router.get("/calendar/events/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.userId as number;
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const event = await getEventAndVerifyOwner(id, userId);
  if (!event) { res.status(404).json({ error: "Evento non trovato" }); return; }

  const reminders = await getRemindersForEvent(id);
  res.json({ event: { ...event, reminders } });
});

router.post("/calendar/events", async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.userId as number;
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dati non validi", details: parsed.error.flatten() }); return; }

  const { reminders: reminderData, ...eventData } = parsed.data;
  const premium = await isPremium(userId);

  if (!premium) {
    const currentCount = await getUserEventCount(userId);
    if (currentCount >= FREE_EVENT_LIMIT) {
      res.status(403).json({
        error: "Limite raggiunto",
        code: "FREE_LIMIT_REACHED",
        message: `Gli utenti Free possono creare al massimo ${FREE_EVENT_LIMIT} eventi.`,
      });
      return;
    }
    if (hasDisallowedReminder(reminderData, false)) {
      res.status(403).json({
        error: "Promemoria avanzati non disponibili nel piano Free",
        code: "PREMIUM_REQUIRED",
        message: "I promemoria a 10 min e 24h richiedono il piano Premium.",
      });
      return;
    }
  }

  const [event] = await db.insert(calendarEventsTable).values({
    userId,
    ...eventData,
    startAt: new Date(eventData.startAt),
    endAt: new Date(eventData.endAt),
  }).returning();

  let insertedReminders: EventReminder[] = [];
  if (reminderData.length > 0) {
    insertedReminders = await db.insert(eventRemindersTable).values(
      reminderData.map((r) => ({ eventId: event.id, minutesBefore: r.minutesBefore, enabled: r.enabled })),
    ).returning();
  }

  res.status(201).json({ event: { ...event, reminders: insertedReminders } });
});

router.put("/calendar/events/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.userId as number;
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const parsed = updateEventSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dati non validi" }); return; }

  const { reminders: reminderData, ...rest } = parsed.data;

  const existing = await getEventAndVerifyOwner(id, userId);
  if (!existing) { res.status(404).json({ error: "Evento non trovato" }); return; }

  type UpdateFields = Partial<Omit<typeof calendarEventsTable.$inferInsert, "id" | "userId">>;
  const updates: UpdateFields & { updatedAt: Date } = { updatedAt: new Date() };

  if (rest.title !== undefined) updates.title = rest.title;
  if (rest.description !== undefined) updates.description = rest.description;
  if (rest.startAt !== undefined) updates.startAt = new Date(rest.startAt);
  if (rest.endAt !== undefined) updates.endAt = new Date(rest.endAt);
  if (rest.allDay !== undefined) updates.allDay = rest.allDay;
  if (rest.category !== undefined) updates.category = rest.category;
  if (rest.priority !== undefined) updates.priority = rest.priority;
  if (rest.status !== undefined) updates.status = rest.status;
  if (rest.color !== undefined) updates.color = rest.color;
  if (rest.tags !== undefined) updates.tags = rest.tags;
  if (rest.linkedSectorId !== undefined) updates.linkedSectorId = rest.linkedSectorId;
  if (rest.linkedGoal !== undefined) updates.linkedGoal = rest.linkedGoal;
  if (rest.linkedContentIds !== undefined) updates.linkedContentIds = rest.linkedContentIds;
  if (rest.isRecurring !== undefined) updates.isRecurring = rest.isRecurring;
  if (rest.recurrenceRule !== undefined) updates.recurrenceRule = rest.recurrenceRule;

  const [event] = await db
    .update(calendarEventsTable)
    .set(updates)
    .where(and(eq(calendarEventsTable.id, id), eq(calendarEventsTable.userId, userId)))
    .returning();

  let currentReminders: EventReminder[];
  if (reminderData !== undefined) {
    const premium = await isPremium(userId);
    if (!premium && hasDisallowedReminder(reminderData, false)) {
      res.status(403).json({
        error: "Promemoria avanzati non disponibili nel piano Free",
        code: "PREMIUM_REQUIRED",
        message: "I promemoria a 10 min e 24h richiedono il piano Premium.",
      });
      return;
    }
    await db.delete(eventRemindersTable).where(eq(eventRemindersTable.eventId, id));
    currentReminders = reminderData.length > 0
      ? await db.insert(eventRemindersTable).values(
          reminderData.map((r) => ({ eventId: id, minutesBefore: r.minutesBefore, enabled: r.enabled })),
        ).returning()
      : [];
  } else {
    currentReminders = await getRemindersForEvent(id);
  }

  res.json({ event: { ...event, reminders: currentReminders } });
});

router.delete("/calendar/events/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.userId as number;
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const event = await getEventAndVerifyOwner(id, userId);
  if (!event) { res.status(404).json({ error: "Evento non trovato" }); return; }

  await db.delete(calendarEventsTable).where(eq(calendarEventsTable.id, id));
  res.json({ success: true });
});

router.post("/calendar/events/:id/reminders", async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.userId as number;
  const eventId = parseInt(String(req.params.id), 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const parsed = z.object({
    minutesBefore: z.number().int().positive(),
    enabled: z.boolean().default(true),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dati non validi" }); return; }

  const { minutesBefore, enabled } = parsed.data;

  const event = await getEventAndVerifyOwner(eventId, userId);
  if (!event) { res.status(404).json({ error: "Evento non trovato" }); return; }

  const premium = await isPremium(userId);
  const allowed: readonly number[] = premium ? ALL_ALLOWED_MINUTES : FREE_ALLOWED_MINUTES;
  if (!(allowed as number[]).includes(minutesBefore)) {
    res.status(403).json({ error: "Questo livello di promemoria richiede Premium", code: "PREMIUM_REQUIRED" }); return;
  }

  const currentCount = await db
    .select({ c: count() })
    .from(eventRemindersTable)
    .where(eq(eventRemindersTable.eventId, eventId));
  if (Number(currentCount[0]?.c ?? 0) >= 4) {
    res.status(400).json({ error: "Massimo 4 promemoria per evento" }); return;
  }

  const [reminder] = await db.insert(eventRemindersTable)
    .values({ eventId, minutesBefore, enabled })
    .returning();

  res.status(201).json({ reminder });
});

router.put("/calendar/reminders/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.userId as number;
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const parsed = z.object({
    minutesBefore: z.number().int().positive().optional(),
    enabled: z.boolean().optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dati non validi" }); return; }

  const { minutesBefore, enabled } = parsed.data;

  const [existing] = await db
    .select({ id: eventRemindersTable.id, eventId: eventRemindersTable.eventId })
    .from(eventRemindersTable)
    .where(eq(eventRemindersTable.id, id));
  if (!existing) { res.status(404).json({ error: "Promemoria non trovato" }); return; }

  const event = await getEventAndVerifyOwner(existing.eventId, userId);
  if (!event) { res.status(403).json({ error: "Non autorizzato" }); return; }

  if (minutesBefore !== undefined) {
    const premium = await isPremium(userId);
    const allowed: readonly number[] = premium ? ALL_ALLOWED_MINUTES : FREE_ALLOWED_MINUTES;
    if (!(allowed as number[]).includes(minutesBefore)) {
      res.status(403).json({ error: "Questo livello di promemoria richiede Premium", code: "PREMIUM_REQUIRED" }); return;
    }
  }

  type ReminderUpdate = { minutesBefore?: number; enabled?: boolean; sentAt: null };
  const updates: ReminderUpdate = { sentAt: null };
  if (minutesBefore !== undefined) updates.minutesBefore = minutesBefore;
  if (enabled !== undefined) updates.enabled = enabled;

  const [reminder] = await db
    .update(eventRemindersTable)
    .set(updates)
    .where(eq(eventRemindersTable.id, id))
    .returning();

  res.json({ reminder });
});

router.delete("/calendar/reminders/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.userId as number;
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [existing] = await db
    .select({ id: eventRemindersTable.id, eventId: eventRemindersTable.eventId })
    .from(eventRemindersTable)
    .where(eq(eventRemindersTable.id, id));
  if (!existing) { res.status(404).json({ error: "Promemoria non trovato" }); return; }

  const event = await getEventAndVerifyOwner(existing.eventId, userId);
  if (!event) { res.status(403).json({ error: "Non autorizzato" }); return; }

  await db.delete(eventRemindersTable).where(eq(eventRemindersTable.id, id));
  res.json({ success: true });
});

router.get("/calendar/upcoming", async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.userId as number;
  const limit = Math.min(parseInt(String(req.query.limit ?? "5"), 10), 20);

  const now = new Date();
  const events = await db
    .select()
    .from(calendarEventsTable)
    .where(and(
      eq(calendarEventsTable.userId, userId),
      gte(calendarEventsTable.startAt, now),
    ))
    .orderBy(asc(calendarEventsTable.startAt))
    .limit(limit);

  res.json({ events });
});

export default router;
