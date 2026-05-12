import { Router } from "express";
import { eq, and, gte, asc } from "drizzle-orm";
import { db, calendarEventsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/upcoming", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const now = new Date();

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
        gte(calendarEventsTable.startAt, now),
      )
    )
    .orderBy(asc(calendarEventsTable.startAt))
    .limit(5);

  res.json(events);
});

export default router;
