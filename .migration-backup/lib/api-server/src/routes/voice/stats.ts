/**
 * voice/stats.ts
 *
 * GET /api/voice/stats
 *
 * Returns gamification snapshot for the authenticated user:
 * {
 *   voiceStreak:       number
 *   totalXp:           number
 *   xpToNextLevel:     number
 *   currentLevel:      number
 *   lastVoiceSessionAt: string | null
 *   recentSessions:    VoiceSessionRow[]
 * }
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, voiceSessionsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

/** XP needed to reach the next level (linear: 200 XP per level) */
const XP_PER_LEVEL = 200;

router.get("/", async (req, res) => {
  const userId: number = (req as any).user.id;

  try {
    const [user] = await db
      .select({
        voiceStreak:       usersTable.voiceStreak,
        totalXp:           usersTable.totalXp,
        lastVoiceSessionAt: usersTable.lastVoiceSessionAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const totalXp       = user.totalXp ?? 0;
    const currentLevel  = Math.floor(totalXp / XP_PER_LEVEL) + 1;
    const xpIntoLevel   = totalXp % XP_PER_LEVEL;
    const xpToNextLevel = XP_PER_LEVEL - xpIntoLevel;

    const recentSessions = await db
      .select({
        id:              voiceSessionsTable.id,
        status:          voiceSessionsTable.status,
        durationSeconds: voiceSessionsTable.durationSeconds,
        xpAwarded:       voiceSessionsTable.xpAwarded,
        agentType:       voiceSessionsTable.agentType,
        summary:         voiceSessionsTable.summary,
        startedAt:       voiceSessionsTable.startedAt,
        completedAt:     voiceSessionsTable.completedAt,
      })
      .from(voiceSessionsTable)
      .where(eq(voiceSessionsTable.userId, userId))
      .orderBy(desc(voiceSessionsTable.startedAt))
      .limit(10);

    res.json({
      voiceStreak:        user.voiceStreak ?? 0,
      totalXp,
      currentLevel,
      xpToNextLevel,
      lastVoiceSessionAt: user.lastVoiceSessionAt?.toISOString() ?? null,
      recentSessions,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
