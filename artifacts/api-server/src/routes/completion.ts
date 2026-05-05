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
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "Utente non trovato" });
    return;
  }

  const [objTotal] = await db
    .select({ val: count() })
    .from(userObjectivesTable)
    .where(eq(userObjectivesTable.userId, userId));

  const [objDone] = await db
    .select({ val: count() })
    .from(userObjectivesTable)
    .where(
      and(
        eq(userObjectivesTable.userId, userId),
        eq(userObjectivesTable.completed, true),
      ),
    );

  const [latestSession] = await db
    .select({ confirmedSectorId: testSessionsTable.confirmedSectorId })
    .from(testSessionsTable)
    .where(eq(testSessionsTable.userId, userId))
    .orderBy(desc(testSessionsTable.createdAt))
    .limit(1);

  let streakDays = 0;
  try {
    const [streakRow] = await db.execute<{ streak_days: number; last_active_at: Date | null }>(
      `SELECT streak_days, last_active_at FROM users WHERE id = ${userId} LIMIT 1`,
    ) as any;
    if (streakRow) {
      const now = new Date();
      const last = streakRow.last_active_at ? new Date(streakRow.last_active_at) : null;
      let current = Number(streakRow.streak_days ?? 0);
      if (!last) {
        current = 1;
      } else {
        const diffDays = Math.floor((now.getTime() - last.getTime()) / 86_400_000);
        if (diffDays === 0) {
        } else if (diffDays === 1) {
          current = current + 1;
        } else {
          current = 1;
        }
      }
      if (!last || Math.floor((now.getTime() - last.getTime()) / 86_400_000) >= 1) {
        await db.execute(
          `UPDATE users SET streak_days = ${current}, last_active_at = NOW() WHERE id = ${userId}`,
        );
      }
      streakDays = current;
    }
  } catch {
    streakDays = 0;
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
