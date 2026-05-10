/**
 * GET /api/admin/agent-health
 * ────────────────────────────────────
 * Phase 11 — Real-time agent health dashboard.
 * Protected by adminOnly middleware (x-admin-secret header).
 *
 * Returns metrics computed from REAL data in supervisor_logs:
 *
 *   {
 *     period:       "7d",
 *     generatedAt:  "2026-05-07T...",
 *     overview: {
 *       totalMessages:    number,
 *       totalRewrites:    number,
 *       rewriteRate:      number,   // 0-1
 *       avgScoreBefore:   number,
 *       avgScoreAfter:    number,   // null if not tracked
 *     },
 *     byDomain: [
 *       { domain, totalMessages, rewrites, rewriteRate, avgScore, topReasons }
 *     ],
 *     weeklyTrend: [
 *       { week: "2026-W18", rewrites, total }
 *     ],
 *     topReasons: [ { reason, count } ],
 *     feedbackStats: {
 *       totalRated:   number,
 *       positiveRate: number,   // 0-1
 *       negativeRate: number,
 *     }
 *   }
 *
 * QUERY PARAMS:
 *   ?days=N    — lookback window in days (default 7, max 90)
 */
import { Router, Request, Response } from "express";
import { adminOnly } from "../../middleware/adminOnly";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/", adminOnly, async (req: Request, res: Response): Promise<void> => {
  const daysRaw = parseInt(String(req.query["days"] ?? "7"), 10);
  const days    = Math.min(Math.max(1, isNaN(daysRaw) ? 7 : daysRaw), 90);
  const since   = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    // ── 1. Overview from supervisor_logs ───────────────────────────────────────
    const overviewRows = await db.execute(sql`
      SELECT
        COUNT(*)::int                                        AS total_messages,
        SUM(CASE WHEN final_text IS NOT NULL THEN 1 ELSE 0 END)::int AS total_rewrites,
        ROUND(AVG(score_before)::numeric, 2)                AS avg_score_before
      FROM supervisor_logs
      WHERE created_at >= ${since}
    `);
    const ov = (overviewRows.rows?.[0] ?? {}) as Record<string, unknown>;

    const totalMessages = Number(ov["total_messages"] ?? 0);
    const totalRewrites = Number(ov["total_rewrites"] ?? 0);
    const avgScoreBefore = ov["avg_score_before"] != null ? Number(ov["avg_score_before"]) : null;

    // ── 2. By domain ────────────────────────────────────────────────────────────────
    const domainRows = await db.execute(sql`
      SELECT
        domain,
        COUNT(*)::int                                        AS total,
        SUM(CASE WHEN final_text IS NOT NULL THEN 1 ELSE 0 END)::int AS rewrites,
        ROUND(AVG(score_before)::numeric, 2)                AS avg_score
      FROM supervisor_logs
      WHERE created_at >= ${since}
      GROUP BY domain
      ORDER BY total DESC
    `);

    // Top reasons per domain (from JSONB reasons array)
    const reasonRows = await db.execute(sql`
      SELECT
        domain,
        reason,
        COUNT(*)::int AS cnt
      FROM supervisor_logs,
           jsonb_array_elements_text(reasons::jsonb) AS reason
      WHERE created_at >= ${since}
        AND reasons IS NOT NULL
      GROUP BY domain, reason
      ORDER BY domain, cnt DESC
    `);

    // Build top reasons map per domain
    type ReasonRow = { domain: string; reason: string; cnt: number };
    const reasonsByDomain: Record<string, Array<{ reason: string; count: number }>> = {};
    for (const r of (reasonRows.rows as ReasonRow[])) {
      if (!reasonsByDomain[r.domain]) reasonsByDomain[r.domain] = [];
      if (reasonsByDomain[r.domain].length < 3) {
        reasonsByDomain[r.domain].push({ reason: r.reason, count: r.cnt });
      }
    }

    type DomainRow = { domain: string; total: number; rewrites: number; avg_score: number | null };
    const byDomain = (domainRows.rows as DomainRow[]).map((d) => ({
      domain:       d.domain,
      totalMessages: d.total,
      rewrites:     d.rewrites,
      rewriteRate:  d.total > 0 ? Math.round((d.rewrites / d.total) * 100) / 100 : 0,
      avgScore:     d.avg_score,
      topReasons:   reasonsByDomain[d.domain] ?? [],
    }));

    // ── 3. Weekly trend ────────────────────────────────────────────────────────────
    const weekRows = await db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('week', created_at), 'IYYY-"W"IW') AS week,
        COUNT(*)::int                                           AS total,
        SUM(CASE WHEN final_text IS NOT NULL THEN 1 ELSE 0 END)::int AS rewrites
      FROM supervisor_logs
      WHERE created_at >= ${since}
      GROUP BY DATE_TRUNC('week', created_at)
      ORDER BY DATE_TRUNC('week', created_at)
    `);

    // ── 4. Top reasons overall ─────────────────────────────────────────────────────
    const topReasonRows = await db.execute(sql`
      SELECT reason, COUNT(*)::int AS cnt
      FROM supervisor_logs,
           jsonb_array_elements_text(reasons::jsonb) AS reason
      WHERE created_at >= ${since}
        AND reasons IS NOT NULL
      GROUP BY reason
      ORDER BY cnt DESC
      LIMIT 10
    `);

    // ── 5. Feedback stats from response_feedback ─────────────────────────────
    const feedbackRows = await db.execute(sql`
      SELECT
        COUNT(*)::int                                        AS total_rated,
        SUM(CASE WHEN rating = 1  THEN 1 ELSE 0 END)::int   AS positive,
        SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END)::int   AS negative
      FROM response_feedback
      WHERE created_at >= ${since}
    `);
    const fb = (feedbackRows.rows?.[0] ?? {}) as Record<string, unknown>;
    const totalRated = Number(fb["total_rated"] ?? 0);

    res.json({
      period:      `${days}d`,
      generatedAt: new Date().toISOString(),
      overview: {
        totalMessages,
        totalRewrites,
        rewriteRate:    totalMessages > 0 ? Math.round((totalRewrites / totalMessages) * 100) / 100 : 0,
        avgScoreBefore,
      },
      byDomain,
      weeklyTrend: weekRows.rows,
      topReasons:  (topReasonRows.rows as Array<{ reason: string; cnt: number }>).map((r) => ({ reason: r.reason, count: r.cnt })),
      feedbackStats: {
        totalRated,
        positiveRate: totalRated > 0 ? Math.round((Number(fb["positive"] ?? 0) / totalRated) * 100) / 100 : 0,
        negativeRate: totalRated > 0 ? Math.round((Number(fb["negative"] ?? 0) / totalRated) * 100) / 100 : 0,
      },
    });
  } catch (err) {
    console.error("[agent-health] query failed:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
