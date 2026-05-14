import { Router } from "express";
import { sql, desc, eq, and, gte, lt } from "drizzle-orm";
import { db, usersTable, weeklyLeaderboardTable, voiceSessionsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { XP_PER_LEVEL } from "./xp-constants";

const router = Router();

function getWeekBounds(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const start = new Date(now);
  start.setDate(now.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const mode = (req.query.mode as string) ?? "xp";
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
    const userId = req.user!.id;

    if (mode === "weekly") {
      const { start, end } = getWeekBounds();

      let entries = await db
        .select({
          userId: weeklyLeaderboardTable.userId,
          xpEarned: weeklyLeaderboardTable.xpEarned,
          sessionsCompleted: weeklyLeaderboardTable.sessionsCompleted,
          rank: weeklyLeaderboardTable.rank,
        })
        .from(weeklyLeaderboardTable)
        .where(
          and(
            gte(weeklyLeaderboardTable.weekStart, start),
            lt(weeklyLeaderboardTable.weekEnd, end),
          ),
        )
        .orderBy(weeklyLeaderboardTable.rank)
        .limit(limit);

      if (entries.length === 0) {
        const weeklyScores = await db
          .select({
            userId: voiceSessionsTable.userId,
            xpEarned: sql<number>`sum(${voiceSessionsTable.xpAwarded})`,
            sessionsCompleted: sql<number>`count(*)`,
          })
          .from(voiceSessionsTable)
          .where(
            and(
              gte(voiceSessionsTable.startedAt, start),
              lt(voiceSessionsTable.startedAt, end),
              eq(voiceSessionsTable.status, "completed"),
            ),
          )
          .groupBy(voiceSessionsTable.userId)
          .orderBy(sql`sum(${voiceSessionsTable.xpAwarded}) desc`)
          .limit(limit);

        const weeklyEntries = [];
        for (let i = 0; i < weeklyScores.length; i++) {
          const score = weeklyScores[i];
          const rank = i + 1;
          await db.insert(weeklyLeaderboardTable).values({
            userId: score.userId,
            weekStart: start,
            weekEnd: end,
            xpEarned: score.xpEarned ?? 0,
            sessionsCompleted: score.sessionsCompleted ?? 0,
            rank,
          }).onConflictDoNothing();
          weeklyEntries.push(score);
        }
        entries = weeklyEntries.map((e, i) => ({
          userId: e.userId,
          xpEarned: e.xpEarned ?? 0,
          sessionsCompleted: e.sessionsCompleted ?? 0,
          rank: i + 1,
        }));
      }

      const userIds = entries.map((e) => e.userId);
      const users = userIds.length > 0
        ? await db
            .select({ id: usersTable.id, name: usersTable.name, avatarUrl: usersTable.avatarUrl })
            .from(usersTable)
            .where(sql`${usersTable.id} = any(${userIds})`)
        : [];

      const userMap = new Map(users.map((u) => [u.id, u]));
      const result = entries.map((e) => ({
        rank: e.rank ?? 0,
        userId: e.userId,
        name: userMap.get(e.userId)?.name ?? "Sconosciuto",
        avatarUrl: userMap.get(e.userId)?.avatarUrl ?? null,
        xpEarned: e.xpEarned,
        sessionsCompleted: e.sessionsCompleted,
        isSelf: e.userId === userId,
      }));

      const selfRank = result.find((e) => e.isSelf)?.rank;
      res.json({ mode: "weekly", entries: result, selfRank });
      return;
    }

    const orderColumn = mode === "streak"
      ? desc(usersTable.voiceStreak)
      : desc(usersTable.totalXp);

    const allEntries = await db
      .select({
        userId: usersTable.id,
        name: usersTable.name,
        avatarUrl: usersTable.avatarUrl,
        totalXp: usersTable.totalXp,
        voiceStreak: usersTable.voiceStreak,
      })
      .from(usersTable)
      .where(sql`${usersTable.totalXp} > 0`)
      .orderBy(orderColumn);

    const ranked = allEntries.map((entry, i) => ({
      rank: i + 1,
      userId: entry.userId,
      name: entry.name,
      avatarUrl: entry.avatarUrl,
      totalXp: entry.totalXp ?? 0,
      voiceStreak: entry.voiceStreak ?? 0,
      level: Math.floor((entry.totalXp ?? 0) / XP_PER_LEVEL),
      isSelf: entry.userId === userId,
    }));

    const entries = ranked.slice(0, limit);
    const selfRank = ranked.find((e) => e.isSelf)?.rank;

    res.json({ mode, entries, selfRank });
  } catch (err) {
    req.log?.error?.({ err }, "leaderboard error");
    res.status(500).json({ error: "Errore nel recupero della classifica" });
  }
});

export default router;
