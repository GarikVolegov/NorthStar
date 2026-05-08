/**
 * GET /api/leaderboard
 *
 * Restituisce la classifica pubblica degli utenti ordinata per XP (desc).
 * Ogni entry mostra anche lo streak vocale, il livello calcolato e il rank.
 *
 * Query params:
 *   limit?  number (default 20, max 100)
 *   mode?   "xp" | "streak"  (default "xp")
 *
 * RESPONSE SHAPE
 * ──────────────
 * {
 *   mode:    "xp" | "streak"
 *   entries: LeaderboardEntry[]
 *   selfRank?: number   — posizione dell'utente corrente (se presente in classifica)
 * }
 *
 * Privacy: restituisce solo name, avatarUrl, livello, XP e streak.
 * Non espone email o dati sensibili.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { sql, desc, isNotNull } from "drizzle-orm";

const router = Router();

const XP_PER_LEVEL = 200;
const MAX_LIMIT    = 100;

router.get("/", async (req, res) => {
  const userId: number = (req as any).user.id;

  const rawLimit = Number(req.query.limit ?? 20);
  const limit    = Math.min(isNaN(rawLimit) ? 20 : rawLimit, MAX_LIMIT);
  const mode     = req.query.mode === "streak" ? "streak" : "xp";

  try {
    // Pull top N users (those who have at least 1 XP or 1 streak day)
    const rows = await db
      .select({
        id:          usersTable.id,
        name:        usersTable.name,
        avatarUrl:   usersTable.avatarUrl,
        totalXp:     usersTable.totalXp,
        voiceStreak: usersTable.voiceStreak,
      })
      .from(usersTable)
      .where(
        mode === "streak"
          ? isNotNull(usersTable.voiceStreak)
          : isNotNull(usersTable.totalXp)
      )
      .orderBy(
        mode === "streak"
          ? desc(usersTable.voiceStreak)
          : desc(usersTable.totalXp)
      )
      .limit(limit);

    const entries = rows.map((r, i) => {
      const xp    = r.totalXp ?? 0;
      const level = Math.floor(xp / XP_PER_LEVEL) + 1;
      return {
        rank:        i + 1,
        userId:      r.id,
        name:        r.name,
        avatarUrl:   r.avatarUrl ?? null,
        totalXp:     xp,
        voiceStreak: r.voiceStreak ?? 0,
        level,
        isSelf:      r.id === userId,
      };
    });

    const selfEntry = entries.find((e) => e.isSelf);

    // If the current user is NOT in the top-N, fetch their own stats separately
    let selfRank: number | undefined = selfEntry?.rank;

    if (!selfEntry) {
      const rankResult = await db.execute(sql`
        SELECT COUNT(*)::int AS rank
        FROM users
        WHERE ${
          mode === "streak"
            ? sql`COALESCE(voice_streak, 0) > (SELECT COALESCE(voice_streak, 0) FROM users WHERE id = ${userId})`
            : sql`COALESCE(total_xp, 0) > (SELECT COALESCE(total_xp, 0) FROM users WHERE id = ${userId})`
        }
      `);
      const aboveCount = (rankResult.rows[0] as { rank: number }).rank ?? 0;
      selfRank = aboveCount + 1;
    }

    res.json({ mode, entries, selfRank });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
