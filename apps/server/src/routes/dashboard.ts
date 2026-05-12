import { Router } from "express";
import { eq, and, desc, gte, asc } from "drizzle-orm";
import { db, testSessionsTable, userObjectivesTable, calendarEventsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const now = new Date();

  const [latestSession] = await db
    .select({
      id: testSessionsTable.id,
      riasecScores: testSessionsTable.riasecScores,
      primaryTypes: testSessionsTable.primaryTypes,
      spiritScores: testSessionsTable.spiritScores,
      recommendations: testSessionsTable.recommendations,
      createdAt: testSessionsTable.createdAt,
    })
    .from(testSessionsTable)
    .where(eq(testSessionsTable.userId, userId))
    .orderBy(desc(testSessionsTable.createdAt))
    .limit(1);

  const objectives = await db
    .select()
    .from(userObjectivesTable)
    .where(eq(userObjectivesTable.userId, userId))
    .orderBy(desc(userObjectivesTable.createdAt));

  const upcomingEvents = await db
    .select({
      id: calendarEventsTable.id,
      title: calendarEventsTable.title,
      category: calendarEventsTable.category,
      startAt: calendarEventsTable.startAt,
      priority: calendarEventsTable.priority,
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

  const objectivesDone = objectives.filter((o) => o.completed).length;
  const objectivesTotal = objectives.length;

  res.json({
    user: {
      journeyType: req.user!.journeyType,
      name: req.user!.name,
      email: req.user!.email,
      isPremium: !!req.user!.stripeSubscriptionId,
    },
    session: latestSession ?? null,
    objectives: objectives.map((o) => ({
      id: o.id,
      text: o.text,
      category: o.category,
      progress: o.progress,
      completed: o.completed,
      completedAt: o.completedAt,
      dueDate: o.dueDate,
      createdAt: o.createdAt,
    })),
    objectivesProgress: {
      done: objectivesDone,
      total: objectivesTotal,
      percent: objectivesTotal > 0 ? Math.round((objectivesDone / objectivesTotal) * 100) : 0,
    },
    upcomingEvents,
  });
});

export default router;
