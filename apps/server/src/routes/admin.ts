import { Router, type Request, type Response } from "express";
import { db, supervisorLogs, qualityMetrics } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

function adminAuth(req: Request, res: Response): boolean {
  const key = req.headers["x-admin-key"];
  if (key !== process.env.ADMIN_API_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

router.get("/quality", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const supervisorStats = await db
      .select({
        domain: supervisorLogs.domain,
        total: sql<number>`count(*)::int`,
        avgScoreBefore: sql<number>`avg(${supervisorLogs.scoreBefore})::float`,
        avgScoreAfter: sql<number>`avg(${supervisorLogs.scoreAfter})::float`,
      })
      .from(supervisorLogs)
      .groupBy(supervisorLogs.domain)
      .orderBy(supervisorLogs.domain);

    const qualityStats = await db
      .select({
        domain: qualityMetrics.domain,
        total: sql<number>`count(*)::int`,
        avgEvalScore: sql<number>`avg(${qualityMetrics.evalScore})::float`,
        avgSupervisorScore: sql<number>`avg(${qualityMetrics.supervisorScore})::float`,
        rewrites: sql<number>`count(*) filter (where ${qualityMetrics.rewritten} = true)::int`,
        clarifications: sql<number>`count(*) filter (where ${qualityMetrics.needsClarification} = true)::int`,
        uiTools: sql<number>`count(*) filter (where ${qualityMetrics.usedUiTool} = true)::int`,
      })
      .from(qualityMetrics)
      .groupBy(qualityMetrics.domain)
      .orderBy(qualityMetrics.domain);

    const totals = await db
      .select({
        total: sql<number>`count(*)::int`,
        avgEvalScore: sql<number>`avg(${qualityMetrics.evalScore})::float`,
        avgSupervisorScore: sql<number>`avg(${qualityMetrics.supervisorScore})::float`,
        rewrites: sql<number>`count(*) filter (where ${qualityMetrics.rewritten} = true)::int`,
        clarifications: sql<number>`count(*) filter (where ${qualityMetrics.needsClarification} = true)::int`,
        uiTools: sql<number>`count(*) filter (where ${qualityMetrics.usedUiTool} = true)::int`,
      })
      .from(qualityMetrics);

    res.json({
      supervisorStats,
      qualityStats,
      totals: totals[0] ?? { total: 0, avgEvalScore: 0, avgSupervisorScore: 0, rewrites: 0, clarifications: 0, uiTools: 0 },
    });
  } catch (err) {
    console.error("[admin/quality] query failed:", err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
