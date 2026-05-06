import { Router } from "express";
import { db, agentLogsTable } from "@workspace/db";
import { sql, and, gte, count, avg, isNotNull } from "drizzle-orm";

const router = Router();
const ADMIN_KEY = process.env.ADMIN_KEY ?? "northstar-admin";

function adminAuth(req: any, res: any, next: any) {
  if (req.headers["x-admin-key"] !== ADMIN_KEY) {
    res.status(401).json({ error: "Non autorizzato" }); return;
  }
  next();
}

// GET /admin/agent-health — stats per agente per 7/30 giorni
router.get("/admin/agent-health", adminAuth, async (_req, res): Promise<void> => {
  try {
    const now = new Date();
    const ago7d  = new Date(now.getTime() - 7  * 24 * 3600 * 1000);
    const ago30d = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

    // Aggregate stats per agent for 30d
    const stats30d = await db
      .select({
        agentName: agentLogsTable.agentName,
        total:      count(),
        errors:     sql<number>`count(*) filter (where ${agentLogsTable.error} is not null)`,
        avgDuration: avg(agentLogsTable.durationMs),
      })
      .from(agentLogsTable)
      .where(gte(agentLogsTable.createdAt, ago30d))
      .groupBy(agentLogsTable.agentName)
      .orderBy(agentLogsTable.agentName);

    // Same for 7d
    const stats7d = await db
      .select({
        agentName: agentLogsTable.agentName,
        total:      count(),
        errors:     sql<number>`count(*) filter (where ${agentLogsTable.error} is not null)`,
      })
      .from(agentLogsTable)
      .where(gte(agentLogsTable.createdAt, ago7d))
      .groupBy(agentLogsTable.agentName);

    const map7d = Object.fromEntries(stats7d.map((r) => [r.agentName, r]));

    // Last 5 errors per agent
    const lastErrors = await db
      .select({
        agentName: agentLogsTable.agentName,
        taskType:  agentLogsTable.taskType,
        error:     agentLogsTable.error,
        createdAt: agentLogsTable.createdAt,
        durationMs: agentLogsTable.durationMs,
      })
      .from(agentLogsTable)
      .where(and(gte(agentLogsTable.createdAt, ago30d), isNotNull(agentLogsTable.error)))
      .orderBy(sql`${agentLogsTable.createdAt} desc`)
      .limit(50);

    const errorsByAgent: Record<string, typeof lastErrors> = {};
    for (const e of lastErrors) {
      if (!errorsByAgent[e.agentName]) errorsByAgent[e.agentName] = [];
      if (errorsByAgent[e.agentName].length < 5) errorsByAgent[e.agentName].push(e);
    }

    // Recent task distribution (daily) for 30d
    const daily = await db
      .select({
        day:       sql<string>`date_trunc('day', ${agentLogsTable.createdAt})::date::text`,
        agentName: agentLogsTable.agentName,
        total:     count(),
        errors:    sql<number>`count(*) filter (where ${agentLogsTable.error} is not null)`,
      })
      .from(agentLogsTable)
      .where(gte(agentLogsTable.createdAt, ago30d))
      .groupBy(sql`date_trunc('day', ${agentLogsTable.createdAt})`, agentLogsTable.agentName)
      .orderBy(sql`date_trunc('day', ${agentLogsTable.createdAt})`);

    const agents = stats30d.map((s) => {
      const s7 = map7d[s.agentName];
      const total30 = Number(s.total);
      const err30   = Number(s.errors);
      const total7  = Number(s7?.total ?? 0);
      const err7    = Number(s7?.errors ?? 0);
      return {
        agentName:       s.agentName,
        successRate30d:  total30 > 0 ? +((1 - err30 / total30) * 100).toFixed(1) : 100,
        successRate7d:   total7  > 0 ? +((1 - err7  / total7)  * 100).toFixed(1) : 100,
        totalCalls30d:   total30,
        totalCalls7d:    total7,
        errorCount30d:   err30,
        errorCount7d:    err7,
        avgDurationMs:   s.avgDuration ? Math.round(Number(s.avgDuration)) : null,
        lastErrors:      (errorsByAgent[s.agentName] ?? []).map((e) => ({
          taskType:  e.taskType,
          error:     e.error,
          createdAt: e.createdAt,
          durationMs: e.durationMs,
        })),
        status: (() => {
          const rate = total30 > 0 ? (1 - err30 / total30) * 100 : 100;
          if (rate >= 95) return "healthy";
          if (rate >= 80) return "degraded";
          return "critical";
        })(),
      };
    });

    res.json({ agents, daily, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error("[admin-agent-health]", err);
    res.status(500).json({ error: "Errore caricamento dati agenti" });
  }
});

export default router;
