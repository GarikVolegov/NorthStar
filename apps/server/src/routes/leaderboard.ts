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

/**
 * Encode a keyset cursor as a base64url string.
 * Format: "sortValue|tiebreakerId"
 */
function encodeCursor(sortValue: unknown, id: number): string {
  return Buffer.from(`${String(sortValue ?? "")}|${id}`, "utf-8").toString("base64url");
}

function decodeCursor(cursor: string): [string, number] {
  const raw = Buffer.from(cursor, "base64url").toString("utf-8");
  const pipe = raw.indexOf("|");
  if (pipe === -1) return [raw, 0];
  const sortVal = raw.slice(0, pipe);
  const id = parseInt(raw.slice(pipe + 1), 10);
  return [sortVal, Number.isNaN(id) ? 0 : id];
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const mode = (req.query.mode as string) ?? "xp";
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
    const cursor = req.query.cursor as string | undefined;
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
        .limit(limit + 1);

      const hasMore = entries.length > limit;
      if (hasMore) entries = entries.slice(0, limit);

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
          .limit(limit + 1);

        const hasMoreWeekly = weeklyScores.length > limit;
        const capped = hasMoreWeekly ? weeklyScores.slice(0, limit) : weeklyScores;

        for (let i = 0; i < capped.length; i++) {
          const score = capped[i];
          if (!score) continue;
          const rank = i + 1;
          await db.insert(weeklyLeaderboardTable).values({
            userId: score.userId,
            weekStart: start,
            weekEnd: end,
            xpEarned: score.xpEarned ?? 0,
            sessionsCompleted: score.sessionsCompleted ?? 0,
            rank,
          }).onConflictDoNothing();
        }

        entries = capped.map((e, i) => ({
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

      const last = entries[entries.length - 1];
      const nextCursor = hasMore && last
        ? encodeCursor(last.rank, last.userId)
        : null;

      const selfRank = result.find((e) => e.isSelf)?.rank;
      res.json({ mode: "weekly", entries: result, nextCursor, selfRank });
      return;
    }

    // ── XP / Streak mode with keyset cursor ──────────────────────
    const orderColumn = mode === "streak"
      ? desc(usersTable.voiceStreak)
      : desc(usersTable.totalXp);

    const orderColSql = mode === "streak"
      ? usersTable.voiceStreak
      : usersTable.totalXp;

    let cursorSortValue: number | undefined;
    let cursorId: number | undefined;

    if (cursor) {
      const [sv, id] = decodeCursor(cursor);
      cursorSortValue = parseFloat(sv);
      cursorId = id;
    }

    const whereClause = cursorSortValue != null && cursorId != null
      ? sql`(${orderColSql}, ${usersTable.id}) < (${cursorSortValue}, ${cursorId}) AND ${usersTable.totalXp} > 0`
      : sql`${usersTable.totalXp} > 0`;

    const allEntries = await db
      .select({
        userId: usersTable.id,
        name: usersTable.name,
        avatarUrl: usersTable.avatarUrl,
        totalXp: usersTable.totalXp,
        voiceStreak: usersTable.voiceStreak,
      })
      .from(usersTable)
      .where(whereClause)
      .orderBy(orderColumn, desc(usersTable.id))
      .limit(limit + 1);

    const hasMore = allEntries.length > limit;
    const capped = hasMore ? allEntries.slice(0, limit) : allEntries;

    const ranked = capped.map((entry, i) => ({
      rank: (cursor ? 0 : i + 1), // relative rank when using cursor
      userId: entry.userId,
      name: entry.name,
      avatarUrl: entry.avatarUrl,
      totalXp: entry.totalXp ?? 0,
      voiceStreak: entry.voiceStreak ?? 0,
      level: Math.floor((entry.totalXp ?? 0) / XP_PER_LEVEL),
      isSelf: entry.userId === userId,
    }));

    const lastEntry = capped[capped.length - 1];
    const nextCursor = hasMore && lastEntry
      ? encodeCursor(
          mode === "streak" ? lastEntry.voiceStreak : lastEntry.totalXp,
          lastEntry.userId,
        )
      : null;

    const selfRank = ranked.find((e) => e.isSelf)?.rank;

    res.json({
      mode,
      entries: ranked,
      nextCursor,
      selfRank,
    });
  } catch (err) {
    req.log?.error?.({ err }, "leaderboard error");
    res.status(500).json({ error: "Errore nel recupero della classifica" });
  }
});

export default router;
