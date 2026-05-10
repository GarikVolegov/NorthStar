/**
 * voice/sessions.ts
 *
 * POST /api/voice/start
 * POST /api/voice/complete
 * POST /api/voice/abandon
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, voiceSessionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
}

function isYesterdayCalendarDay(yesterday: Date, today: Date): boolean {
  const d = new Date(today);
  d.setDate(d.getDate() - 1);
  return isSameCalendarDay(yesterday, d);
}

const XP_PER_SESSION = 50;

// ── POST /start ───────────────────────────────────────────────────────────────

router.post("/start", async (req, res) => {
  const userId: number = (req as any).user.id;

  const bodySchema = z.object({
    agentType: z.string().optional(),
  });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  try {
    const [session] = await db
      .insert(voiceSessionsTable)
      .values({
        userId,
        status: "ongoing",
        agentType: parsed.data.agentType ?? null,
        xpAwarded: 0,
        countedForStreak: false,
      })
      .returning();

    res.status(201).json({ sessionId: session.id, startedAt: session.startedAt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ── POST /complete ────────────────────────────────────────────────────────────

const completeSchema = z.object({
  sessionId:       z.number().int().positive(),
  durationSeconds: z.number().int().min(0).optional(),
  summary:         z.string().max(1000).optional(),
});

router.post("/complete", async (req, res) => {
  const userId: number = (req as any).user.id;

  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const { sessionId, durationSeconds, summary } = parsed.data;

  try {
    // Verify the session belongs to this user and is ongoing
    const [existing] = await db
      .select()
      .from(voiceSessionsTable)
      .where(eq(voiceSessionsTable.id, sessionId))
      .limit(1);

    if (!existing || existing.userId !== userId) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    if (existing.status !== "ongoing") {
      res.status(409).json({ error: `Session already ${existing.status}` });
      return;
    }

    // Load user for streak computation
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    const now = new Date();
    const last = user.lastVoiceSessionAt;

    const alreadyCountedToday = last ? isSameCalendarDay(last, now) : false;
    const isConsecutiveDay    = last ? isYesterdayCalendarDay(last, now) : false;

    const newStreak = alreadyCountedToday
      ? (user.voiceStreak ?? 0)          // same day: don't bump
      : isConsecutiveDay
        ? (user.voiceStreak ?? 0) + 1    // consecutive day
        : 1;                             // streak broken or first time

    const countedForStreak = !alreadyCountedToday;

    await db.transaction(async (tx) => {
      await tx
        .update(usersTable)
        .set({
          voiceStreak:        newStreak,
          totalXp:            (user.totalXp ?? 0) + XP_PER_SESSION,
          lastVoiceSessionAt: now,
        })
        .where(eq(usersTable.id, userId));

      await tx
        .update(voiceSessionsTable)
        .set({
          status:          "completed",
          completedAt:     now,
          durationSeconds: durationSeconds ?? null,
          summary:         summary ?? null,
          xpAwarded:       XP_PER_SESSION,
          countedForStreak,
        })
        .where(eq(voiceSessionsTable.id, sessionId));
    });

    res.json({
      xpAwarded:  XP_PER_SESSION,
      newStreak,
      totalXp:    (user.totalXp ?? 0) + XP_PER_SESSION,
      streakBumped: countedForStreak,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ── POST /abandon ─────────────────────────────────────────────────────────────

router.post("/abandon", async (req, res) => {
  const userId: number = (req as any).user.id;

  const parsed = z.object({ sessionId: z.number().int().positive() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(voiceSessionsTable)
      .where(eq(voiceSessionsTable.id, parsed.data.sessionId))
      .limit(1);

    if (!existing || existing.userId !== userId) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    if (existing.status !== "ongoing") {
      res.status(409).json({ error: `Session already ${existing.status}` });
      return;
    }

    await db
      .update(voiceSessionsTable)
      .set({ status: "abandoned", completedAt: new Date() })
      .where(eq(voiceSessionsTable.id, parsed.data.sessionId));

    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
