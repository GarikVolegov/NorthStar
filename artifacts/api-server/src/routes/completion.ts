import { Router } from "express";
import { db, usersTable, userObjectivesTable, testSessionsTable } from "@workspace/db";
import { eq, and, count, desc } from "drizzle-orm";
import { getAuthenticatedUserId } from "../lib/plan-utils";

const router = Router();

router.get("/completion/me", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Non autenticato" });
    return;
  }

  const [user] = await db
    .select({
      testSessionId: usersTable.testSessionId,
      workPreference: usersTable.workPreference,
      cvText: usersTable.cvText,
      isPublic: usersTable.isPublic,
      streakDays: usersTable.streakDays,
      lastActiveAt: usersTable.lastActiveAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "Utente non trovato" });
    return;
  }

  const [[objTotal], [objDone], [latestSession]] = await Promise.all([
    db
      .select({ val: count() })
      .from(userObjectivesTable)
      .where(eq(userObjectivesTable.userId, userId)),
    db
      .select({ val: count() })
      .from(userObjectivesTable)
      .where(
        and(
          eq(userObjectivesTable.userId, userId),
          eq(userObjectivesTable.completed, true),
        ),
      ),
    db
      .select({ confirmedSectorId: testSessionsTable.confirmedSectorId })
      .from(testSessionsTable)
      .where(eq(testSessionsTable.userId, userId))
      .orderBy(desc(testSessionsTable.createdAt))
      .limit(1),
  ]);

  // ─── Streak calculation — solo Drizzle ORM, nessun raw SQL ──────────────────
  const now = new Date();
  const last = user.lastActiveAt ? new Date(user.lastActiveAt) : null;
  let streakDays = user.streakDays ?? 0;

  let newStreak = streakDays;
  if (!last) {
    newStreak = 1;
  } else {
    const diffDays = Math.floor((now.getTime() - last.getTime()) / 86_400_000);
    if (diffDays === 0) {
      // Stesso giorno — nessuna variazione
    } else if (diffDays === 1) {
      newStreak = streakDays + 1;
    } else {
      newStreak = 1; // Streak interrotto
    }
  }

  const shouldUpdate = !last || Math.floor((now.getTime() - last.getTime()) / 86_400_000) >= 1;
  if (shouldUpdate) {
    await db
      .update(usersTable)
      .set({ streakDays: newStreak, lastActiveAt: now })
      .where(eq(usersTable.id, userId));
    streakDays = newStreak;
  }

  res.json({
    hasTestSession: !!user.testSessionId,
    hasConfirmedSector: !!latestSession?.confirmedSectorId,
    hasWorkPreference:
      !!user.workPreference && user.workPreference !== "unknown",
    hasCv: !!user.cvText,
    isPublic: user.isPublic,
    streakDays,
    totalObjectives: Number(objTotal?.val ?? 0),
    completedObjectives: Number(objDone?.val ?? 0),
  });
});

export default router;
