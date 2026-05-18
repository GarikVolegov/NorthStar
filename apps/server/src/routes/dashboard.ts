import { Router } from "express";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import {
  calendarEventsTable,
  db,
  testSessionsTable,
  userObjectivesTable,
} from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router = Router();

/* ─── GET /api/dashboard  —  dati dashboard ─── */
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const now = new Date();

    const [latestSession, objectives, upcomingEvents] = await Promise.all([
      db
        .select({
          id: testSessionsTable.id,
          riasecScores: testSessionsTable.riasecScores,
          primaryTypes: testSessionsTable.primaryTypes,
          spiritScores: testSessionsTable.spiritScores,
          recommendations: testSessionsTable.recommendations,
          createdAt: testSessionsTable.createdAt,
        })
        .from(testSessionsTable)
        .where(eq(testSessionsTable.userId, user.id))
        .orderBy(desc(testSessionsTable.createdAt))
        .limit(1),
      db
        .select({
          id: userObjectivesTable.id,
          text: userObjectivesTable.text,
          category: userObjectivesTable.category,
          progress: userObjectivesTable.progress,
          completed: userObjectivesTable.completed,
          completedAt: userObjectivesTable.completedAt,
          dueDate: userObjectivesTable.dueDate,
          createdAt: userObjectivesTable.createdAt,
        })
        .from(userObjectivesTable)
        .where(eq(userObjectivesTable.userId, user.id))
        .orderBy(desc(userObjectivesTable.createdAt))
        .limit(8),
      db
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
            eq(calendarEventsTable.userId, user.id),
            gte(calendarEventsTable.endAt, now),
          ),
        )
        .orderBy(asc(calendarEventsTable.startAt))
        .limit(5),
    ]);

    const totalObjectives = objectives.length;
    const doneObjectives = objectives.filter((objective) => objective.completed).length;

    res.json({
      user: {
        journeyType: user.journeyType,
        name: user.name,
        email: user.email,
        isPremium: Boolean(user.stripeSubscriptionId),
        onboardingCompleted: user.onboardingCompleted,
      },
      session: latestSession[0] ?? null,
      objectives,
      objectivesProgress: {
        done: doneObjectives,
        total: totalObjectives,
        percent: totalObjectives > 0 ? Math.round((doneObjectives / totalObjectives) * 100) : 0,
      },
      upcomingEvents,
    });
  } catch (err) {
    req.log?.error?.({ err }, "dashboard get error");
    res.status(500).json({ error: "Errore nel caricamento della dashboard" });
  }
});

export default router;
