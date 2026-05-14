import { Router } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, voiceSessionsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import type { VoiceSession } from "@workspace/db";
import { XP_REWARDS, XP_PER_LEVEL, xpProgress, getUnlockedFeatures, getNextUnlock } from "./xp-constants";
import { DAILY_LIMITS } from "./xp-constants";

const router = Router();
const XP_PER_SESSION = XP_REWARDS.VOICE_SESSION;

router.use(requireAuth);

router.post("/start", async (req, res) => {
  try {
    const { agentType } = req.body as { agentType?: string };
    const userId = req.user!.id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [dailyCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(voiceSessionsTable)
      .where(
        and(
          eq(voiceSessionsTable.userId, userId),
          eq(voiceSessionsTable.status, "completed"),
          sql`${voiceSessionsTable.completedAt} >= ${today.toISOString()}`,
        ),
      );

    if ((dailyCount?.count ?? 0) >= DAILY_LIMITS.VOICE_SESSIONS) {
      res.status(429).json({ error: "Limite giornaliero di sessioni vocali raggiunto" });
      return;
    }

    const [session] = await db
      .insert(voiceSessionsTable)
      .values({
        userId,
        status: "ongoing",
        agentType: agentType ?? null,
      })
      .returning();

    res.status(201).json({ sessionId: session.id, startedAt: session.startedAt });
  } catch (err) {
    req.log?.error?.({ err }, "voice start error");
    res.status(500).json({ error: "Errore nell'avvio della sessione vocale" });
  }
});

router.post("/complete", async (req, res) => {
  try {
    const { sessionId, durationSeconds, summary } = req.body as {
      sessionId: number;
      durationSeconds?: number;
      summary?: string;
    };
    const userId = req.user!.id;

    const [session] = await db
      .select()
      .from(voiceSessionsTable)
      .where(
        and(
          eq(voiceSessionsTable.id, sessionId),
          eq(voiceSessionsTable.userId, userId),
          eq(voiceSessionsTable.status, "ongoing"),
        ),
      )
      .limit(1);

    if (!session) {
      res.status(404).json({ error: "Sessione non trovata o già completata" });
      return;
    }

    const [userNow] = await db
      .select({ lastVoiceSessionAt: usersTable.lastVoiceSessionAt })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    const now = new Date();
    const lastSession = userNow?.lastVoiceSessionAt
      ? new Date(userNow.lastVoiceSessionAt)
      : null;

    const isNewDay = !lastSession || lastSession.toDateString() !== now.toDateString();
    const countedForStreak = isNewDay;

    const [updated] = await db
      .update(voiceSessionsTable)
      .set({
        status: "completed",
        durationSeconds: durationSeconds ?? null,
        xpAwarded: XP_PER_SESSION,
        countedForStreak,
        summary: summary ?? null,
        completedAt: now,
      })
      .where(eq(voiceSessionsTable.id, sessionId))
      .returning();

    const [user] = await db
      .select({
        totalXp: usersTable.totalXp,
        voiceStreak: usersTable.voiceStreak,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    const newTotalXp = (user?.totalXp ?? 0) + XP_PER_SESSION;
    const newStreak = countedForStreak ? (user?.voiceStreak ?? 0) + 1 : (user?.voiceStreak ?? 0);

    await db
      .update(usersTable)
      .set({
        totalXp: newTotalXp,
        voiceStreak: newStreak,
        lastVoiceSessionAt: now,
      })
      .where(eq(usersTable.id, userId));

    const { level: currentLevel, next: xpToNextLevel } = xpProgress(newTotalXp);

    res.json({
      xpAwarded: XP_PER_SESSION,
      newStreak,
      totalXp: newTotalXp,
      currentLevel,
      xpToNextLevel,
      streakBumped: countedForStreak,
    });
  } catch (err) {
    req.log?.error?.({ err }, "voice complete error");
    res.status(500).json({ error: "Errore nel completamento della sessione" });
  }
});

router.post("/abandon", async (req, res) => {
  try {
    const { sessionId } = req.body as { sessionId: number };
    const userId = req.user!.id;

    const [session] = await db
      .select()
      .from(voiceSessionsTable)
      .where(
        and(
          eq(voiceSessionsTable.id, sessionId),
          eq(voiceSessionsTable.userId, userId),
          eq(voiceSessionsTable.status, "ongoing"),
        ),
      )
      .limit(1);

    if (!session) {
      res.status(404).json({ error: "Sessione non trovata" });
      return;
    }

    await db
      .update(voiceSessionsTable)
      .set({ status: "abandoned", completedAt: new Date() })
      .where(eq(voiceSessionsTable.id, sessionId));

    res.json({ ok: true });
  } catch (err) {
    req.log?.error?.({ err }, "voice abandon error");
    res.status(500).json({ error: "Errore nell'abbandono della sessione" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const userId = req.user!.id;

    const [user] = await db
      .select({
        voiceStreak: usersTable.voiceStreak,
        totalXp: usersTable.totalXp,
        lastVoiceSessionAt: usersTable.lastVoiceSessionAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "Utente non trovato" });
      return;
    }

    const totalXp = user.totalXp ?? 0;
    const { level: currentLevel, next: xpToNextLevel } = xpProgress(totalXp);

    const recentSessions = await db
      .select()
      .from(voiceSessionsTable)
      .where(eq(voiceSessionsTable.userId, userId))
      .orderBy(desc(voiceSessionsTable.startedAt))
      .limit(10);

    const unlockedFeatures = getUnlockedFeatures(totalXp);
    const nextUnlock = getNextUnlock(totalXp);

    res.json({
      voiceStreak: user.voiceStreak ?? 0,
      totalXp,
      currentLevel,
      xpToNextLevel,
      unlockedFeatures,
      nextUnlock,
      lastVoiceSessionAt: user.lastVoiceSessionAt?.toISOString() ?? null,
      recentSessions: recentSessions.map((s: VoiceSession) => ({
        id: s.id,
        status: s.status,
        durationSeconds: s.durationSeconds,
        xpAwarded: s.xpAwarded,
        agentType: s.agentType,
        summary: s.summary,
        startedAt: s.startedAt.toISOString(),
        completedAt: s.completedAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    req.log?.error?.({ err }, "voice stats error");
    res.status(500).json({ error: "Errore nel recupero delle statistiche" });
  }
});

export default router;
