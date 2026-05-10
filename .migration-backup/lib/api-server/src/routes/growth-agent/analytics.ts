/**
 * GET /api/growth-agent/analytics
 *
 * Returns aggregated session analytics for the authenticated user.
 * All data is derived from coach_sessions via pure SQL aggregations.
 *
 * RESPONSE SHAPE
 * ──────────────
 * {
 *   totalSessions:   number
 *   totalMessages:   number
 *   avgConfidence:   number          // last 30 sessions, 0-1
 *   topTopics:       { topic: string; count: number }[]   // top 5
 *   confidenceTrend: { date: string; avg: number }[]      // last 14 days
 *   levelBreakdown:  { high: number; medium: number; low: number }
 *   streakDays:      number          // consecutive days with >=1 session
 * }
 *
 * Returns empty/zero values if the user has no sessions yet.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  const userId: number = (req as any).user.id;

  try {
    // ── 1. Totals ─────────────────────────────────────────────────────────────
    const totalsResult = await db.execute(sql`
      SELECT
        COUNT(*)::int                                    AS total_sessions,
        COALESCE(SUM(message_count), 0)::int             AS total_messages,
        ROUND(AVG(avg_confidence)::numeric, 2)::float    AS avg_confidence
      FROM coach_sessions
      WHERE user_id = ${userId}
        AND started_at >= NOW() - INTERVAL '30 days'
    `);
    const totals = totalsResult.rows[0] as {
      total_sessions: number;
      total_messages: number;
      avg_confidence: number | null;
    };

    // ── 2. Top topics (unnest array, count occurrences) ───────────────────────
    const topicsResult = await db.execute(sql`
      SELECT
        UNNEST(topics) AS topic,
        COUNT(*)::int  AS count
      FROM coach_sessions
      WHERE user_id = ${userId}
        AND started_at >= NOW() - INTERVAL '30 days'
      GROUP BY topic
      ORDER BY count DESC
      LIMIT 5
    `);
    const topTopics = (topicsResult.rows as { topic: string; count: number }[]);

    // ── 3. Confidence trend — last 14 days ────────────────────────────────────
    const trendResult = await db.execute(sql`
      SELECT
        DATE_TRUNC('day', started_at)::date::text         AS date,
        ROUND(AVG(avg_confidence)::numeric, 2)::float     AS avg
      FROM coach_sessions
      WHERE user_id = ${userId}
        AND started_at >= NOW() - INTERVAL '14 days'
        AND avg_confidence IS NOT NULL
      GROUP BY DATE_TRUNC('day', started_at)
      ORDER BY 1
    `);
    const confidenceTrend = (trendResult.rows as { date: string; avg: number }[]);

    // ── 4. Level breakdown (from eval_breakdown JSONB) ────────────────────────
    const breakdownResult = await db.execute(sql`
      SELECT
        COALESCE(SUM((eval_breakdown->>'high')::int), 0)::int    AS high,
        COALESCE(SUM((eval_breakdown->>'medium')::int), 0)::int  AS medium,
        COALESCE(SUM((eval_breakdown->>'low')::int), 0)::int     AS low
      FROM coach_sessions
      WHERE user_id = ${userId}
        AND eval_breakdown IS NOT NULL
    `);
    const levelBreakdown = (breakdownResult.rows[0] as {
      high: number;
      medium: number;
      low: number;
    }) ?? { high: 0, medium: 0, low: 0 };

    // ── 5. Streak: consecutive days with at least 1 session ───────────────────
    const streakResult = await db.execute(sql`
      WITH days AS (
        SELECT DISTINCT DATE_TRUNC('day', started_at)::date AS d
        FROM coach_sessions
        WHERE user_id = ${userId}
        ORDER BY d DESC
      ),
      numbered AS (
        SELECT d, ROW_NUMBER() OVER (ORDER BY d DESC) AS rn
        FROM days
      ),
      streak AS (
        SELECT d, rn,
               d + (rn - 1) * INTERVAL '1 day' AS grp
        FROM numbered
      )
      SELECT COUNT(*)::int AS streak_days
      FROM streak
      WHERE grp = (SELECT MAX(grp) FROM streak)
    `);
    const streakDays = (streakResult.rows[0] as { streak_days: number })?.streak_days ?? 0;

    // ── Response ──────────────────────────────────────────────────────────────
    res.json({
      totalSessions:   totals.total_sessions ?? 0,
      totalMessages:   totals.total_messages ?? 0,
      avgConfidence:   totals.avg_confidence ?? null,
      topTopics,
      confidenceTrend,
      levelBreakdown,
      streakDays,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
