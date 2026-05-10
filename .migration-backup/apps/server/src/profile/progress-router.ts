/**
 * progress-router.ts — GET /api/users/me/progress
 *
 * Restituisce in una sola risposta:
 *   - streakDays, voiceStreak, totalXp
 *   - level, xpInLevel, xpToNextLevel (calcolati server-side)
 *   - activities: ultime 10 azioni miste (sessioni, test, obiettivi)
 *     ordinate per timestamp DESC
 *
 * Non richiede nessuna migration: usa solo tabelle esistenti.
 */
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  voiceSessionsTable,
  testSessionsTable,
  userObjectivesTable,
} from "@workspace/db";
import { eq, desc, and, isNotNull } from "drizzle-orm";

export const progressRouter = Router();

const XP_PER_LEVEL = 500;

function requireAuth(req: Request, res: Response, next: () => void) {
  const uid = (req as Request & { user?: { id: number } }).user?.id;
  if (!uid) { res.status(401).json({ error: "Non autenticato" }); return; }
  next();
}
function userId(req: Request): number {
  return (req as Request & { user: { id: number } }).user.id;
}

progressRouter.get("/me/progress", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);

    // ─ 1. Streak + XP from users table (single row) ───────────────────
    const user = await db
      .select({
        streakDays:         usersTable.streakDays,
        voiceStreak:        usersTable.voiceStreak,
        totalXp:            usersTable.totalXp,
        lastVoiceSessionAt: usersTable.lastVoiceSessionAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, uid))
      .limit(1)
      .then((r) => r[0]);

    if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }

    const totalXp  = user.totalXp  ?? 0;
    const level    = Math.floor(totalXp / XP_PER_LEVEL);
    const xpInLevel    = totalXp % XP_PER_LEVEL;
    const xpToNextLevel = XP_PER_LEVEL - xpInLevel;

    // ─ 2. Last 5 voice sessions ───────────────────────────────────
    const sessions = await db
      .select({
        completedAt:     voiceSessionsTable.completedAt,
        durationSeconds: voiceSessionsTable.durationSeconds,
        xpAwarded:       voiceSessionsTable.xpAwarded,
        agentType:       voiceSessionsTable.agentType,
      })
      .from(voiceSessionsTable)
      .where(
        and(
          eq(voiceSessionsTable.userId, uid),
          eq(voiceSessionsTable.status, "completed"),
          isNotNull(voiceSessionsTable.completedAt),
        )
      )
      .orderBy(desc(voiceSessionsTable.completedAt))
      .limit(5);

    // ─ 3. Last 3 test sessions ──────────────────────────────────
    const tests = await db
      .select({
        createdAt:    testSessionsTable.createdAt,
        primaryTypes: testSessionsTable.primaryTypes,
      })
      .from(testSessionsTable)
      .where(eq(testSessionsTable.userId, uid))
      .orderBy(desc(testSessionsTable.createdAt))
      .limit(3);

    // ─ 4. Last 5 completed objectives ───────────────────────────
    const objectives = await db
      .select({
        completedAt: userObjectivesTable.completedAt,
        text:        userObjectivesTable.text,
        category:    userObjectivesTable.category,
      })
      .from(userObjectivesTable)
      .where(
        and(
          eq(userObjectivesTable.userId, uid),
          eq(userObjectivesTable.completed, true),
          isNotNull(userObjectivesTable.completedAt),
        )
      )
      .orderBy(desc(userObjectivesTable.completedAt))
      .limit(5);

    // ─ 5. Merge + sort activities ────────────────────────────────
    type Activity = {
      type:      "session" | "test" | "objective";
      label:     string;
      sublabel?: string;
      timestamp: string;
      xp?:       number;
    };

    const activities: Activity[] = [
      ...sessions.map((s) => ({
        type:      "session" as const,
        label:     s.agentType ? `Sessione ${s.agentType}` : "Sessione con Wendy",
        sublabel:  s.durationSeconds
          ? `${Math.round(s.durationSeconds / 60)} min`
          : undefined,
        timestamp: s.completedAt!.toISOString(),
        xp:        s.xpAwarded,
      })),
      ...tests.map((t) => ({
        type:      "test" as const,
        label:     "Test RIASEC completato",
        sublabel:  t.primaryTypes?.length
          ? `Tipi dominanti: ${t.primaryTypes.slice(0, 3).join(", ")}`
          : undefined,
        timestamp: t.createdAt.toISOString(),
      })),
      ...objectives.map((o) => ({
        type:      "objective" as const,
        label:     `Obiettivo raggiunto: ${o.text.slice(0, 60)}${o.text.length > 60 ? "..." : ""}`,
        sublabel:  o.category !== "altro" ? o.category : undefined,
        timestamp: o.completedAt!.toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    res.json({
      streakDays:     user.streakDays   ?? 0,
      voiceStreak:    user.voiceStreak  ?? 0,
      totalXp,
      level,
      xpInLevel,
      xpToNextLevel,
      xpPerLevel:     XP_PER_LEVEL,
      activities,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});
