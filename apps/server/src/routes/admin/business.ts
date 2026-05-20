import { Router, type Request, type Response } from "express";
import {
  affiliationLeadsTable,
  aiRequestLogTable,
  agentRunsTable,
  checkDatabaseHealth,
  contactMessagesTable,
  db,
  testSessionsTable,
  usersTable,
} from "@workspace/db";
import { and, desc, gte, isNull, sql } from "drizzle-orm";
import { rootLogger } from "../../middleware/logger";
import { executionMonitor } from "../../lib/execution-monitor";

const router = Router();

const ADMIN_ENV_CHECKS = [
  { key: "DATABASE_URL", label: "Database", critical: true },
  { key: "JWT_SECRET", label: "Auth token", critical: true },
  { key: "CLERK_SECRET_KEY", label: "Clerk server", critical: true },
  { key: "OPENROUTER_API_KEY", label: "OpenRouter AI", critical: true },
  { key: "ADMIN_BREAK_GLASS_KEY", label: "Break-glass admin", critical: true },
  { key: "STRIPE_SECRET_KEY", label: "Stripe", critical: false },
  { key: "STRIPE_WEBHOOK_SECRET", label: "Stripe webhook", critical: false },
  { key: "RESEND_API_KEY", label: "Email", critical: false },
  { key: "TAVILY_API_KEY", label: "Web research", critical: false },
  { key: "REDIS_URL", label: "Redis/rate limit", critical: false },
] as const;

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function envStatus() {
  const items = ADMIN_ENV_CHECKS.map((item) => ({
    ...item,
    configured: Boolean(process.env[item.key]),
  }));
  const missingCritical = items.filter((item) => item.critical && !item.configured);
  const missingOptional = items.filter((item) => !item.critical && !item.configured);
  return {
    total: items.length,
    configured: items.filter((item) => item.configured).length,
    missingCritical: missingCritical.map((item) => item.key),
    missingOptional: missingOptional.map((item) => item.key),
    items,
  };
}

async function getBusinessStatusSnapshot(daysInput: unknown) {
  const days = [7, 30].includes(Number(daysInput)) ? Number(daysInput) : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const errorReport = executionMonitor.getReport();
  const dbReady = await checkDatabaseHealth();

  const [
    userStats,
    testStats,
    topSectors,
    contactStats,
    leadStats,
    agentStats,
    recentFailedRuns,
    aiStats,
  ] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        premium: sql<number>`count(*) filter (where exists (
          select 1 from subscriptions s
          where s.user_id = ${usersTable.id}
            and s.cancelled_at is null
            and (s.valid_until is null or s.valid_until >= now())
            and s.plan in ('pro', 'team')
        ))::int`,
        new7d: sql<number>`count(*) filter (where ${usersTable.createdAt} >= ${since7d})::int`,
        new30d: sql<number>`count(*) filter (where ${usersTable.createdAt} >= ${since30d})::int`,
      })
      .from(usersTable),
    db
      .select({
        total: sql<number>`count(*)::int`,
        recent: sql<number>`count(*) filter (where ${testSessionsTable.createdAt} >= ${since})::int`,
        recent7d: sql<number>`count(*) filter (where ${testSessionsTable.createdAt} >= ${since7d})::int`,
        recent30d: sql<number>`count(*) filter (where ${testSessionsTable.createdAt} >= ${since30d})::int`,
        confirmed: sql<number>`count(*) filter (where ${testSessionsTable.confirmedSectorId} is not null)::int`,
      })
      .from(testSessionsTable),
    db
      .select({
        sectorId: testSessionsTable.confirmedSectorId,
        count: sql<number>`count(*)::int`,
      })
      .from(testSessionsTable)
      .where(sql`${testSessionsTable.confirmedSectorId} is not null`)
      .groupBy(testSessionsTable.confirmedSectorId)
      .orderBy(sql`count(*) desc`)
      .limit(5),
    db
      .select({
        total: sql<number>`count(*)::int`,
        unread: sql<number>`count(*) filter (where ${contactMessagesTable.read} = false)::int`,
        open: sql<number>`count(*) filter (where ${contactMessagesTable.status} in ('new', 'in_progress'))::int`,
      })
      .from(contactMessagesTable)
      .where(isNull(contactMessagesTable.deletedAt)),
    db
      .select({
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(*) filter (where ${affiliationLeadsTable.status} = 'pending')::int`,
        contacted: sql<number>`count(*) filter (where ${affiliationLeadsTable.status} = 'contacted')::int`,
        converted: sql<number>`count(*) filter (where ${affiliationLeadsTable.status} = 'converted')::int`,
        unread: sql<number>`count(*) filter (where ${affiliationLeadsTable.read} = false)::int`,
      })
      .from(affiliationLeadsTable),
    db
      .select({
        total: sql<number>`count(*)::int`,
        failed: sql<number>`count(*) filter (where ${agentRunsTable.status} in ('failed', 'cancelled'))::int`,
        running: sql<number>`count(*) filter (where ${agentRunsTable.status} = 'running')::int`,
        avgDurationMs: sql<number>`avg(${agentRunsTable.durationMs})::int`,
      })
      .from(agentRunsTable)
      .where(gte(agentRunsTable.startedAt, since)),
    db
      .select({
        id: agentRunsTable.id,
        agentName: agentRunsTable.agentName,
        taskType: agentRunsTable.taskType,
        status: agentRunsTable.status,
        errorMessage: agentRunsTable.errorMessage,
        startedAt: agentRunsTable.startedAt,
      })
      .from(agentRunsTable)
      .where(and(gte(agentRunsTable.startedAt, since), sql`${agentRunsTable.status} in ('failed', 'cancelled')`))
      .orderBy(desc(agentRunsTable.startedAt))
      .limit(5),
    db
      .select({
        requests: sql<number>`count(*)::int`,
        errors: sql<number>`count(*) filter (where ${aiRequestLogTable.status} <> 'success')::int`,
      })
      .from(aiRequestLogTable)
      .where(gte(aiRequestLogTable.createdAt, since)),
  ]);

  const users = userStats[0] ?? { total: 0, premium: 0, new7d: 0, new30d: 0 };
  const tests = testStats[0] ?? { total: 0, recent: 0, recent7d: 0, recent30d: 0, confirmed: 0 };
  const contacts = contactStats[0] ?? { total: 0, unread: 0, open: 0 };
  const leads = leadStats[0] ?? { total: 0, pending: 0, contacted: 0, converted: 0, unread: 0 };
  const agents = agentStats[0] ?? { total: 0, failed: 0, running: 0, avgDurationMs: null };
  const ai = aiStats[0] ?? { requests: 0, errors: 0 };
  const env = envStatus();
  const agentErrorRate = percent(Number(agents.failed) || 0, Number(agents.total) || 0);
  const aiErrorRate = percent(Number(ai.errors) || 0, Number(ai.requests) || 0);
  const recentErrors = errorReport.errors.slice(0, 5).map((error) => ({
    file: error.file,
    function: error.function,
    message: error.message,
    code: error.code ?? null,
    capturedAt: error.capturedAt,
    occurrences: error.occurrences,
  }));

  const services = {
    api: { status: "ok", label: "API", uptimeSeconds: Math.floor(process.uptime()) },
    database: { status: dbReady ? "ok" : "error", label: "Database" },
    auth: { status: process.env.JWT_SECRET && process.env.CLERK_SECRET_KEY ? "ok" : "not_configured", label: "Clerk/Auth" },
    ai: { status: process.env.OPENROUTER_API_KEY ? "ok" : "not_configured", label: "OpenRouter AI" },
    stripe: { status: process.env.STRIPE_SECRET_KEY ? "ok" : "not_configured", label: "Stripe" },
  };

  const criticalReasons: string[] = [];
  const attentionReasons: string[] = [];
  if (!dbReady) criticalReasons.push("Database non pronto");
  if (env.missingCritical.length > 0) criticalReasons.push(`${env.missingCritical.length} env critiche mancanti`);
  if (errorReport.errors.length >= 5) criticalReasons.push(`${errorReport.errors.length} errori unici recenti`);
  if (agentErrorRate > 20) criticalReasons.push(`Agent error rate ${agentErrorRate}%`);
  if (errorReport.totalCaptured > 0) attentionReasons.push(`${errorReport.totalCaptured} errori catturati`);
  if (env.missingOptional.length > 0) attentionReasons.push(`${env.missingOptional.length} env opzionali mancanti`);
  if ((Number(contacts.unread) || 0) > 0) attentionReasons.push(`${contacts.unread} messaggi non letti`);
  if ((Number(leads.pending) || 0) > 0) attentionReasons.push(`${leads.pending} lead pending`);
  if (agentErrorRate > 0) attentionReasons.push(`Agenti con errori ${agentErrorRate}%`);

  const status = criticalReasons.length > 0 ? "critical" : attentionReasons.length > 0 ? "attention" : "healthy";

  return {
    generatedAt: new Date().toISOString(),
    days,
    business: {
      users: {
        total: Number(users.total) || 0,
        new7d: Number(users.new7d) || 0,
        new30d: Number(users.new30d) || 0,
        premium: Number(users.premium) || 0,
        conversionRate: percent(Number(users.premium) || 0, Number(users.total) || 0),
      },
      tests: {
        total: Number(tests.total) || 0,
        recent: Number(tests.recent) || 0,
        recent7d: Number(tests.recent7d) || 0,
        recent30d: Number(tests.recent30d) || 0,
        confirmed: Number(tests.confirmed) || 0,
        completionRate: percent(Number(tests.confirmed) || 0, Number(tests.total) || 0),
      },
      topSectors,
    },
    funnels: {
      userToTestRate: percent(Number(tests.total) || 0, Number(users.total) || 0),
      userToPremiumRate: percent(Number(users.premium) || 0, Number(users.total) || 0),
      leadConversionRate: percent(Number(leads.converted) || 0, Number(leads.total) || 0),
    },
    technical: {
      status,
      label: status === "healthy" ? "Tutto stabile" : status === "attention" ? "Attenzione" : "Intervento richiesto",
      reasons: [...criticalReasons, ...attentionReasons],
      uptimeSeconds: Math.floor(process.uptime()),
      services,
      dbReady,
      errors: {
        totalCaptured: errorReport.totalCaptured,
        unique: errorReport.errors.length,
        recent: recentErrors,
        brokenComponents: errorReport.brokenComponents.slice(0, 5),
      },
      agents: {
        totalRuns: Number(agents.total) || 0,
        failedRuns: Number(agents.failed) || 0,
        runningRuns: Number(agents.running) || 0,
        errorRate: agentErrorRate,
        avgDurationMs: agents.avgDurationMs ?? null,
        recentFailures: recentFailedRuns,
      },
      ai: {
        requests: Number(ai.requests) || 0,
        errors: Number(ai.errors) || 0,
        errorRate: aiErrorRate,
      },
    },
    env,
    inbox: {
      messages: contacts,
      leads,
    },
    actions: [
      { label: "Review suggerimenti", section: "queue", path: "/admin/review", count: null },
      { label: "Coda crescita", section: "crescita", path: "/admin/crescita", count: null },
      { label: "Agenti", section: "agents", path: "/admin/agenti", count: Number(agents.failed) || 0 },
      { label: "Status", section: "status", path: "/admin/status", count: criticalReasons.length + attentionReasons.length },
      { label: "Messaggi", section: "messaggi", path: "/admin/messaggi", count: Number(contacts.unread) || 0 },
      { label: "Affiliazione", section: "affiliazione", path: "/admin/affiliazione", count: Number(leads.pending) || 0 },
    ],
  };
}

router.get("/metrics", async (_req: Request, res: Response) => {
  try {
    const snapshot = await getBusinessStatusSnapshot(30);
    res.json({
      users: snapshot.business.users,
      tests: snapshot.business.tests,
      topSectors: snapshot.business.topSectors,
      funnels: snapshot.funnels,
      generatedAt: snapshot.generatedAt,
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/metrics] error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/business-status", async (req: Request, res: Response) => {
  try {
    const snapshot = await getBusinessStatusSnapshot(req.query.days);
    res.json(snapshot);
  } catch (err) {
    rootLogger.error({ err }, "[admin/business-status] error");
    res.status(500).json({ error: String(err) });
  }
});

export default router;
