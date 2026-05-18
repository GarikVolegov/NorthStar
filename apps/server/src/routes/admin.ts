import { Router, type Request, type Response } from "express";
import {
  affiliationLeadsTable,
  aiRequestLogTable,
  agentPromptVersionsTable,
  agentPromptsTable,
  agentRunsTable,
  agentSuggestionsTable,
  auditLogsTable,
  auditLogTable,
  calendarEventsTable,
  coachSessionsTable,
  contactMessagesTable,
  db,
  growthArticlesTable,
  llmUsageTable,
  professionsTable,
  qualityMetrics,
  responseFeedbackTable,
  reviewQueueTable,
  sectorsTable,
  supervisorLogs,
  testSessionsTable,
  usersTable,
} from "@workspace/db";
import { and, desc, eq, gte, ilike, isNull, sql } from "drizzle-orm";
import { register } from "@workspace/ai-server/metrics";
import { runCollector, runEnricher, runSectorDataAgent, generateEmbeddingsBatch, buildEmbeddingText } from "@workspace/ai-server";
import { writeAuditLog } from "../middleware/audit";
import { rootLogger } from "../middleware/logger";
import { executionMonitor } from "../lib/execution-monitor";
import { requireAdminAccess } from "../middleware/auth";

const router = Router();

type AgentPrompt = {
  key: string;
  label: string;
  description: string;
  placeholders: string[];
  requiredPlaceholders?: string[];
  defaultValue: string;
};

const DEFAULT_PROMPTS: AgentPrompt[] = [
  {
    key: "wendy.system",
    label: "Wendy - Sistema",
    description: "Identita operativa dell'assistente principale.",
    placeholders: ["{{USER_CONTEXT}}", "{{TOOLS}}"],
    requiredPlaceholders: ["{{USER_CONTEXT}}", "{{TOOLS}}"],
    defaultValue:
      "Sei Wendy, assistente operativa di NorthStar. Aiuta l'utente a orientarsi, pianificare e usare i tool dell'app in modo concreto.",
  },
  {
    key: "knowledge.auto_link",
    label: "Knowledge Graph - Collegamenti",
    description: "Istruzioni per suggerire relazioni semantiche tra nodi.",
    placeholders: ["{{SOURCE_NODE}}", "{{CANDIDATES}}"],
    requiredPlaceholders: ["{{SOURCE_NODE}}", "{{CANDIDATES}}"],
    defaultValue:
      "Analizza il nodo sorgente e collega solo candidati con relazione semantica chiara. Restituisci etichette brevi e motivazioni verificabili.",
  },
  {
    key: "growth.research",
    label: "Growth Research",
    description: "Guida per generare contenuti di crescita professionale.",
    placeholders: ["{{TOPIC}}", "{{AUDIENCE}}"],
    requiredPlaceholders: ["{{TOPIC}}", "{{AUDIENCE}}"],
    defaultValue:
      "Crea contenuti pratici, aggiornati e orientati all'azione per professionisti e team. Evita generalita e includi passi concreti.",
  },
];

const RUNNABLE_AGENTS = [
  {
    key: "news-research",
    label: "News Research",
    description: "Registra una run manuale per la ricerca news e prepara il collector reale.",
    endpoint: "/admin/research/news/run",
    method: "POST",
    risk: "low",
    requiresInput: true,
  },
  {
    key: "growth-research",
    label: "Growth Research",
    description: "Registra una run manuale per contenuti di crescita professionale.",
    endpoint: "/admin/research/growth/run",
    method: "POST",
    risk: "low",
    requiresInput: false,
  },
  {
    key: "collector",
    label: "Collector Notizie",
    description: "Avvia il collector di notizie configurato nel server AI.",
    endpoint: "/admin/agents/collect",
    method: "POST",
    risk: "medium",
    requiresInput: false,
  },
  {
    key: "enricher",
    label: "Enricher LLM",
    description: "Arricchisce batch di contenuti tramite LLM.",
    endpoint: "/admin/agents/enrich",
    method: "POST",
    risk: "medium",
    requiresInput: false,
  },
  {
    key: "sector-data",
    label: "Sector Data",
    description: "Aggiorna dati mercato per settori e professioni.",
    endpoint: "/admin/agents/sector-data",
    method: "POST",
    risk: "medium",
    requiresInput: false,
  },
  {
    key: "backfill-embeddings",
    label: "Backfill Embeddings",
    description: "Genera embedding mancanti per settori e professioni.",
    endpoint: "/admin/agents/backfill",
    method: "POST",
    risk: "high",
    requiresInput: false,
  },
] as const;

function getLimit(req: Request, fallback = 100, max = 200) {
  return Math.max(1, Math.min(Number(req.query.limit) || fallback, max));
}

router.use(requireAdminAccess);

function adminAuth(_req: Request, _res: Response): boolean {
  return true;
}

async function writeAgentRunSnapshot(params: {
  agentName: string;
  taskType: string;
  startedAt: Date;
  status: "completed" | "failed";
  inputSummary?: string;
  outputSummary?: string;
  errorMessage?: string;
}) {
  const finishedAt = new Date();
  const [run] = await db
    .insert(agentRunsTable)
    .values({
      agentName: params.agentName,
      taskType: params.taskType,
      inputSummary: params.inputSummary,
      outputSummary: params.outputSummary,
      status: params.status,
      startedAt: params.startedAt,
      finishedAt,
      durationMs: finishedAt.getTime() - params.startedAt.getTime(),
      errorMessage: params.errorMessage,
    })
    .returning();
  return run;
}

function findDefaultPrompt(key: string) {
  return DEFAULT_PROMPTS.find((prompt) => prompt.key === key);
}

function extractPromptPlaceholders(value: string) {
  return Array.from(new Set(value.match(/{{\s*[A-Z0-9_]+\s*}}/g) ?? []))
    .map((placeholder) => placeholder.replace(/\s+/g, ""));
}

function validatePromptValue(
  value: string,
  allowedPlaceholders: string[],
  requiredPlaceholders: string[],
) {
  const placeholders = extractPromptPlaceholders(value);
  const unknownPlaceholders = placeholders.filter(
    (placeholder) => !allowedPlaceholders.includes(placeholder),
  );
  const missingPlaceholders = allowedPlaceholders.filter(
    (placeholder) => !placeholders.includes(placeholder),
  );
  const missingRequiredPlaceholders = requiredPlaceholders.filter(
    (placeholder) => !placeholders.includes(placeholder),
  );
  const errors: string[] = [];
  const warnings: string[] = [];

  if (value.trim().length < 10) errors.push("Il prompt deve contenere almeno 10 caratteri.");
  if (unknownPlaceholders.length > 0) {
    errors.push(`Placeholder non supportati: ${unknownPlaceholders.join(", ")}`);
  }
  if (missingRequiredPlaceholders.length > 0) {
    errors.push(`Placeholder obbligatori mancanti: ${missingRequiredPlaceholders.join(", ")}`);
  }
  if (missingPlaceholders.length > 0) {
    warnings.push(`Placeholder non usati: ${missingPlaceholders.join(", ")}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    placeholders,
    unknownPlaceholders,
    missingPlaceholders,
    missingRequiredPlaceholders,
  };
}

function sampleVariables(placeholders: string[], provided?: Record<string, unknown>) {
  const defaults: Record<string, string> = {
    USER_CONTEXT: "Utente: Product Manager, obiettivo: pianificare crescita professionale nei prossimi 90 giorni.",
    TOOLS: "calendar.createEvent, objectives.create, knowledge.linkNodes, news.search",
    SOURCE_NODE: "Nodo: AI Strategy - competenze, decisioni e opportunita correlate.",
    CANDIDATES: "Product Strategy, Automazione Processi, Roadmap Competenze",
    TOPIC: "leadership operativa con AI",
    AUDIENCE: "professionisti e team business",
  };
  const variables: Record<string, string> = {};
  for (const placeholder of placeholders) {
    const key = placeholder.replace(/[{}]/g, "");
    variables[key] = String(provided?.[key] ?? defaults[key] ?? `[${key}]`);
  }
  return variables;
}

function renderPrompt(value: string, variables: Record<string, string>) {
  return value.replace(/{{\s*([A-Z0-9_]+)\s*}}/g, (_match, key: string) => variables[key] ?? `[${key}]`);
}

function safeSnippet(value: string | null | undefined, max = 180) {
  if (!value) return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

function qualityStatus(score: number | null, rewriteRate: number, clarificationRate = 0) {
  if ((score != null && score < 0.6) || rewriteRate > 0.3) return "critical";
  if ((score != null && score < 0.75) || rewriteRate > 0.15 || clarificationRate > 0.2) return "attention";
  return "healthy";
}

async function ensurePromptRegistry(prompt: AgentPrompt) {
  const requiredPlaceholders = prompt.requiredPlaceholders ?? [];
  const now = new Date();
  const existing = await db
    .select()
    .from(agentPromptsTable)
    .where(eq(agentPromptsTable.key, prompt.key))
    .limit(1);

  let record = existing[0];
  if (!record) {
    [record] = await db
      .insert(agentPromptsTable)
      .values({
        key: prompt.key,
        label: prompt.label,
        description: prompt.description,
        defaultValue: prompt.defaultValue,
        placeholders: prompt.placeholders,
        requiredPlaceholders,
        updatedAt: now,
      })
      .returning();
  } else {
    [record] = await db
      .update(agentPromptsTable)
      .set({
        label: prompt.label,
        description: prompt.description,
        defaultValue: prompt.defaultValue,
        placeholders: prompt.placeholders,
        requiredPlaceholders,
        updatedAt: now,
      })
      .where(eq(agentPromptsTable.id, record.id))
      .returning();
  }

  const active = await db
    .select()
    .from(agentPromptVersionsTable)
    .where(and(
      eq(agentPromptVersionsTable.promptId, record.id),
      eq(agentPromptVersionsTable.status, "active"),
    ))
    .orderBy(desc(agentPromptVersionsTable.createdAt))
    .limit(1);

  if (!active[0]) {
    const [version] = await db
      .insert(agentPromptVersionsTable)
      .values({
        promptId: record.id,
        versionNumber: 1,
        status: "active",
        value: prompt.defaultValue,
        notes: "Versione default iniziale",
        publishedAt: now,
      })
      .returning();
    [record] = await db
      .update(agentPromptsTable)
      .set({ activeVersionId: version.id, updatedAt: now })
      .where(eq(agentPromptsTable.id, record.id))
      .returning();
  }

  return record;
}

async function getNextPromptVersionNumber(promptId: number) {
  const [row] = await db
    .select({
      next: sql<number>`coalesce(max(${agentPromptVersionsTable.versionNumber}), 0)::int + 1`,
    })
    .from(agentPromptVersionsTable)
    .where(eq(agentPromptVersionsTable.promptId, promptId));
  return Number(row?.next) || 1;
}

async function getPromptVersions(promptId: number) {
  return db
    .select()
    .from(agentPromptVersionsTable)
    .where(eq(agentPromptVersionsTable.promptId, promptId))
    .orderBy(desc(agentPromptVersionsTable.versionNumber));
}

async function getPromptPayload(prompt: AgentPrompt) {
  const registry = await ensurePromptRegistry(prompt);
  const versions = await getPromptVersions(registry.id);
  const activeVersion =
    versions.find((version) => version.id === registry.activeVersionId) ??
    versions.find((version) => version.status === "active") ??
    null;
  const draftVersion = versions.find((version) => version.status === "draft") ?? null;
  const currentValue = activeVersion?.value ?? registry.defaultValue;
  const draftValue = draftVersion?.value ?? currentValue;
  const validation = validatePromptValue(
    draftValue,
    registry.placeholders,
    registry.requiredPlaceholders,
  );

  return {
    key: registry.key,
    label: registry.label,
    description: registry.description,
    placeholders: registry.placeholders,
    requiredPlaceholders: registry.requiredPlaceholders,
    defaultValue: registry.defaultValue,
    currentValue,
    draftValue,
    isOverridden: currentValue !== registry.defaultValue,
    hasDraft: Boolean(draftVersion),
    activeVersionId: activeVersion?.id ?? null,
    activeVersionNumber: activeVersion?.versionNumber ?? null,
    draftVersionId: draftVersion?.id ?? null,
    draftVersionNumber: draftVersion?.versionNumber ?? null,
    updatedAt: activeVersion?.publishedAt?.toISOString() ?? activeVersion?.updatedAt.toISOString() ?? null,
    updatedBy: activeVersion?.createdBy ? `User #${activeVersion.createdBy}` : null,
    validation,
  };
}

router.get("/overview", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const now = new Date();
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const errorReport = executionMonitor.getReport();

    const [
      suggestionStats,
      growthStats,
      inboxStats,
      leadStats,
      userStats,
      testStats,
      calendarStats,
      agentRows,
      failedRuns,
    ] = await Promise.all([
      db
        .select({
          status: agentSuggestionsTable.status,
          count: sql<number>`count(*)::int`,
        })
        .from(agentSuggestionsTable)
        .groupBy(agentSuggestionsTable.status),
      db
        .select({
          status: growthArticlesTable.status,
          count: sql<number>`count(*)::int`,
        })
        .from(growthArticlesTable)
        .groupBy(growthArticlesTable.status),
      db
        .select({
          total: sql<number>`count(*)::int`,
          unread: sql<number>`count(*) filter (where ${contactMessagesTable.read} = false)::int`,
        })
        .from(contactMessagesTable)
        .where(isNull(contactMessagesTable.deletedAt)),
      db
        .select({
          total: sql<number>`count(*)::int`,
          pending: sql<number>`count(*) filter (where ${affiliationLeadsTable.status} = 'pending')::int`,
          contacted: sql<number>`count(*) filter (where ${affiliationLeadsTable.status} = 'contacted')::int`,
        })
        .from(affiliationLeadsTable),
      db
        .select({
          total: sql<number>`count(*)::int`,
          premium: sql<number>`count(*) filter (where ${usersTable.isPremium} = true or ${usersTable.stripeSubscriptionId} is not null)::int`,
          new30d: sql<number>`count(*) filter (where ${usersTable.createdAt} >= ${since30d})::int`,
        })
        .from(usersTable),
      db.select({ total: sql<number>`count(*)::int` }).from(testSessionsTable),
      db
        .select({
          upcoming: sql<number>`count(*) filter (where ${calendarEventsTable.endAt} >= ${now})::int`,
          next24h: sql<number>`count(*) filter (where ${calendarEventsTable.startAt} >= ${now} and ${calendarEventsTable.startAt} < ${new Date(Date.now() + 24 * 60 * 60 * 1000)})::int`,
        })
        .from(calendarEventsTable),
      db
        .select({
          agentName: agentRunsTable.agentName,
          totalCalls30d: sql<number>`count(*)::int`,
          errorCount30d: sql<number>`count(*) filter (where ${agentRunsTable.status} in ('failed', 'cancelled'))::int`,
          avgDurationMs: sql<number>`avg(${agentRunsTable.durationMs})::int`,
        })
        .from(agentRunsTable)
        .where(gte(agentRunsTable.startedAt, since30d))
        .groupBy(agentRunsTable.agentName)
        .orderBy(agentRunsTable.agentName),
      db
        .select({
          id: agentRunsTable.id,
          agentName: agentRunsTable.agentName,
          taskType: agentRunsTable.taskType,
          startedAt: agentRunsTable.startedAt,
          durationMs: agentRunsTable.durationMs,
          errorMessage: agentRunsTable.errorMessage,
          status: agentRunsTable.status,
        })
        .from(agentRunsTable)
        .where(sql`${agentRunsTable.status} in ('failed', 'cancelled')`)
        .orderBy(desc(agentRunsTable.startedAt))
        .limit(5),
    ]);

    const suggestionByStatus = Object.fromEntries(
      suggestionStats.map((row) => [row.status, Number(row.count) || 0]),
    );
    const growthByStatus = Object.fromEntries(
      growthStats.map((row) => [row.status, Number(row.count) || 0]),
    );
    const pendingReview = suggestionByStatus.pending_review ?? 0;
    const growthPending = growthByStatus.pending ?? growthByStatus.draft ?? 0;
    const unreadMessages = Number(inboxStats[0]?.unread) || 0;
    const pendingLeads = Number(leadStats[0]?.pending) || 0;

    const agents = agentRows.map((row) => {
      const total = Number(row.totalCalls30d) || 0;
      const errors = Number(row.errorCount30d) || 0;
      const errorRate = total > 0 ? Math.round((errors / total) * 100) : 0;
      const successRate = total > 0 ? Math.round(((total - errors) / total) * 100) : 100;
      return {
        agentName: row.agentName,
        totalCalls30d: total,
        errorCount30d: errors,
        errorRate30d: errorRate,
        successRate30d: successRate,
        avgDurationMs: row.avgDurationMs ?? null,
        status: errorRate > 20 ? "critical" : errorRate >= 5 ? "degraded" : "healthy",
      };
    });

    const criticalAgents = agents.filter((agent) => agent.status === "critical");
    const degradedAgents = agents.filter((agent) => agent.status === "degraded");
    const actionItems = pendingReview + growthPending + unreadMessages + pendingLeads;
    const reasons: string[] = [];
    if (pendingReview > 0) reasons.push(`${pendingReview} richieste in revisione`);
    if (growthPending > 0) reasons.push(`${growthPending} articoli crescita pending`);
    if (unreadMessages > 0) reasons.push(`${unreadMessages} messaggi non letti`);
    if (pendingLeads > 0) reasons.push(`${pendingLeads} lead da contattare`);
    if (criticalAgents.length > 0) reasons.push(`${criticalAgents.length} agenti critici`);
    if (degradedAgents.length > 0) reasons.push(`${degradedAgents.length} agenti degradati`);
    if (errorReport.totalCaptured > 0) reasons.push(`${errorReport.totalCaptured} errori catturati`);

    const healthStatus =
      criticalAgents.length > 0 || errorReport.errors.length >= 5
        ? "critical"
        : reasons.length > 0
          ? "attention"
          : "healthy";

    res.json({
      generatedAt: new Date().toISOString(),
      health: {
        status: healthStatus,
        label:
          healthStatus === "healthy"
            ? "Tutto stabile"
            : healthStatus === "attention"
              ? "Attenzione"
              : "Intervento richiesto",
        reasons,
        criticalCount: criticalAgents.length + (errorReport.errors.length >= 5 ? 1 : 0),
        actionItems,
      },
      queues: {
        reviewPending: pendingReview,
        growthPending,
        totalOpen: pendingReview + growthPending,
      },
      errors: {
        totalCaptured: errorReport.totalCaptured,
        unique: errorReport.errors.length,
        brokenComponents: errorReport.brokenComponents.slice(0, 5),
        recent: errorReport.errors.slice(0, 5).map((error) => ({
          file: error.file,
          function: error.function,
          message: error.message,
          code: error.code ?? null,
          capturedAt: error.capturedAt,
          occurrences: error.occurrences,
        })),
      },
      agents: {
        total: agents.length,
        critical: criticalAgents.length,
        degraded: degradedAgents.length,
        failedRecent: failedRuns.map((run) => ({
          id: run.id,
          agentName: run.agentName,
          taskType: run.taskType,
          startedAt: run.startedAt,
          durationMs: run.durationMs,
          errorMessage: run.errorMessage,
          status: run.status,
        })),
        health: agents,
      },
      metrics: {
        users: userStats[0] ?? { total: 0, premium: 0, new30d: 0 },
        tests: testStats[0] ?? { total: 0 },
        calendar: calendarStats[0] ?? { upcoming: 0, next24h: 0 },
      },
      inbox: {
        unreadMessages,
        pendingLeads,
        contactedLeads: Number(leadStats[0]?.contacted) || 0,
        totalMessages: Number(inboxStats[0]?.total) || 0,
        totalLeads: Number(leadStats[0]?.total) || 0,
      },
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/overview] error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/stats", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const [suggestionStats, runStats] = await Promise.all([
      db
        .select({
          status: agentSuggestionsTable.status,
          count: sql<number>`count(*)::int`,
        })
        .from(agentSuggestionsTable)
        .groupBy(agentSuggestionsTable.status),
      db
        .select({ totalRuns: sql<number>`count(*)::int` })
        .from(agentRunsTable),
    ]);

    const byStatus = Object.fromEntries(
      suggestionStats.map((row) => [row.status, Number(row.count) || 0]),
    );

    res.json({
      pending: byStatus.pending_review ?? 0,
      approved: byStatus.approved ?? 0,
      rejected: byStatus.rejected ?? 0,
      applied: byStatus.applied ?? 0,
      archived: byStatus.archived ?? 0,
      totalRuns: runStats[0]?.totalRuns ?? 0,
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/stats] error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/suggestions", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const limit = getLimit(req);
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const entityType = typeof req.query.entity_type === "string" ? req.query.entity_type : "";
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const confidenceMin = Number(req.query.confidence_min);

    const conditions = [];
    if (status && status !== "all") conditions.push(eq(agentSuggestionsTable.status, status as any));
    if (entityType && entityType !== "all") conditions.push(eq(agentSuggestionsTable.entityType, entityType));
    if (search) conditions.push(ilike(agentSuggestionsTable.entityName, `%${search}%`));
    if (Number.isFinite(confidenceMin) && confidenceMin > 0) {
      conditions.push(sql`${agentSuggestionsTable.confidenceScore} >= ${confidenceMin}`);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const items = await db
      .select({
        id: agentSuggestionsTable.id,
        agentRunId: agentSuggestionsTable.agentRunId,
        entityType: agentSuggestionsTable.entityType,
        entityName: agentSuggestionsTable.entityName,
        payloadJson: agentSuggestionsTable.payloadJson,
        confidenceScore: agentSuggestionsTable.confidenceScore,
        status: agentSuggestionsTable.status,
        reviewedBy: agentSuggestionsTable.reviewedBy,
        reviewedAt: agentSuggestionsTable.reviewedAt,
        notes: agentSuggestionsTable.notes,
        createdAt: agentSuggestionsTable.createdAt,
        updatedAt: agentSuggestionsTable.updatedAt,
        agentName: agentRunsTable.agentName,
        queuePriority: reviewQueueTable.priority,
        queueStatus: reviewQueueTable.queueStatus,
      })
      .from(agentSuggestionsTable)
      .leftJoin(agentRunsTable, eq(agentSuggestionsTable.agentRunId, agentRunsTable.id))
      .leftJoin(reviewQueueTable, eq(reviewQueueTable.suggestionId, agentSuggestionsTable.id))
      .where(where)
      .orderBy(desc(agentSuggestionsTable.createdAt))
      .limit(limit);

    const [{ total } = { total: 0 }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(agentSuggestionsTable)
      .where(where);

    res.json({ items, total });
  } catch (err) {
    rootLogger.error({ err }, "[admin/suggestions] error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/suggestions/:id", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const id = Number(req.params.id);
    const [suggestion] = await db
      .select()
      .from(agentSuggestionsTable)
      .where(eq(agentSuggestionsTable.id, id))
      .limit(1);

    if (!suggestion) {
      res.status(404).json({ error: "Suggestion not found" });
      return;
    }

    const [agentRun] = suggestion.agentRunId
      ? await db.select().from(agentRunsTable).where(eq(agentRunsTable.id, suggestion.agentRunId)).limit(1)
      : [null];
    const [queueItem] = await db
      .select()
      .from(reviewQueueTable)
      .where(eq(reviewQueueTable.suggestionId, id))
      .limit(1);
    const auditTrail = await db
      .select()
      .from(auditLogTable)
      .where(and(
        eq(auditLogTable.targetId, id),
        sql`${auditLogTable.action} like 'admin_suggestion_%'`,
      ))
      .orderBy(desc(auditLogTable.createdAt))
      .limit(20);

    res.json({
      suggestion,
      agentRun: agentRun ?? null,
      queueItem: queueItem ?? null,
      auditTrail: auditTrail
        .map((log) => ({
          id: log.id,
          actorId: log.actorId,
          action: log.action,
          category: log.category,
          metadata: log.metadata,
          createdAt: log.createdAt,
        })),
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/suggestions/:id] error");
    res.status(500).json({ error: String(err) });
  }
});

async function reviewSuggestion(
  req: Request,
  res: Response,
  status: "approved" | "rejected" | "archived",
  notes?: string,
) {
  if (!adminAuth(req, res)) return;

  try {
    const id = Number(req.params.id);
    const [current] = await db
      .select()
      .from(agentSuggestionsTable)
      .where(eq(agentSuggestionsTable.id, id))
      .limit(1);

    if (!current) {
      res.status(404).json({ error: "Suggestion not found" });
      return;
    }

    const [suggestion] = await db
      .update(agentSuggestionsTable)
      .set({
        status: status as any,
        notes: notes ?? null,
        reviewedBy: req.user?.email ?? req.user?.name ?? "admin",
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentSuggestionsTable.id, id))
      .returning();

    if (!suggestion) {
      res.status(404).json({ error: "Suggestion not found" });
      return;
    }

    await db
      .update(reviewQueueTable)
      .set({
        queueStatus: status === "archived" ? "done" : "done",
        updatedAt: new Date(),
      })
      .where(eq(reviewQueueTable.suggestionId, id));

    await writeAuditLog(req, {
      action:
        status === "approved"
          ? "admin_suggestion_approved"
          : status === "rejected"
            ? "admin_suggestion_rejected"
            : "admin_suggestion_archived",
      category: "admin_action",
      targetId: id,
      metadata: {
        entityType: current.entityType,
        entityName: current.entityName,
        previousStatus: current.status,
        newStatus: status,
        notes: notes ?? null,
        confidenceScore: current.confidenceScore,
      },
    });

    res.json({ ok: true, suggestion });
  } catch (err) {
    rootLogger.error({ err }, "[admin/suggestions/review] error");
    res.status(500).json({ error: String(err) });
  }
}

router.post("/suggestions/:id/approve", async (req: Request, res: Response) => {
  await reviewSuggestion(req, res, "approved");
});

router.post("/suggestions/:id/reject", async (req: Request, res: Response) => {
  await reviewSuggestion(
    req,
    res,
    "rejected",
    typeof req.body?.notes === "string" ? req.body.notes : undefined,
  );
});

router.post("/suggestions/:id/archive", async (req: Request, res: Response) => {
  await reviewSuggestion(
    req,
    res,
    "archived",
    typeof req.body?.notes === "string" ? req.body.notes : "Archiviato",
  );
});

router.post("/suggestions/:id/apply", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const id = Number(req.params.id);
    const notes = typeof req.body?.notes === "string" ? req.body.notes : undefined;
    const [current] = await db
      .select()
      .from(agentSuggestionsTable)
      .where(eq(agentSuggestionsTable.id, id))
      .limit(1);

    if (!current) {
      res.status(404).json({ error: "Suggestion not found" });
      return;
    }

    if (current.status !== "approved") {
      res.status(400).json({ error: "Solo i suggerimenti approvati possono essere applicati" });
      return;
    }

    const [suggestion] = await db
      .update(agentSuggestionsTable)
      .set({
        status: "applied",
        notes: notes ?? current.notes,
        reviewedBy: req.user?.email ?? req.user?.name ?? "admin",
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentSuggestionsTable.id, id))
      .returning();

    await writeAuditLog(req, {
      action: "admin_suggestion_applied",
      category: "admin_action",
      targetId: id,
      metadata: {
        entityType: current.entityType,
        entityName: current.entityName,
        previousStatus: current.status,
        newStatus: "applied",
        notes: notes ?? null,
        confidenceScore: current.confidenceScore,
        workflowOnly: true,
      },
    });

    res.json({ ok: true, suggestion });
  } catch (err) {
    rootLogger.error({ err }, "[admin/suggestions/apply] error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/agent-runs", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const runs = await db
      .select()
      .from(agentRunsTable)
      .orderBy(desc(agentRunsTable.startedAt))
      .limit(getLimit(req));
    res.json(runs);
  } catch (err) {
    rootLogger.error({ err }, "[admin/agent-runs] error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/logs", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const canonical = await db
      .select()
      .from(auditLogTable)
      .orderBy(desc(auditLogTable.createdAt))
      .limit(getLimit(req));

    res.json(
      canonical.map((log) => ({
        id: log.id,
        userId: log.actorId == null ? null : String(log.actorId),
        action: log.action,
        targetType: log.category ?? "system",
        targetId: log.targetId,
        metadataJson: (log.metadata as Record<string, unknown> | null) ?? null,
        createdAt: log.createdAt,
      })),
    );
  } catch {
    try {
      const legacy = await db
        .select()
        .from(auditLogsTable)
        .orderBy(desc(auditLogsTable.createdAt))
        .limit(getLimit(req));
      res.json(legacy);
    } catch (err) {
      rootLogger.error({ err }, "[admin/logs] error");
      res.status(500).json({ error: String(err) });
    }
  }
});

router.get("/prompts", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const payload = [];
    for (const prompt of DEFAULT_PROMPTS) {
      payload.push(await getPromptPayload(prompt));
    }
    res.json(payload);
  } catch (err) {
    rootLogger.error({ err }, "[admin/prompts] error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/prompts/:key/versions", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const prompt = findDefaultPrompt(req.params.key);
    if (!prompt) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }
    const registry = await ensurePromptRegistry(prompt);
    const versions = await getPromptVersions(registry.id);
    res.json({
      promptKey: registry.key,
      activeVersionId: registry.activeVersionId,
      versions: versions.map((version) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        status: version.status,
        value: version.value,
        notes: version.notes,
        createdBy: version.createdBy,
        publishedAt: version.publishedAt,
        createdAt: version.createdAt,
        updatedAt: version.updatedAt,
        validation: validatePromptValue(
          version.value,
          registry.placeholders,
          registry.requiredPlaceholders,
        ),
      })),
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/prompts/:key/versions] error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/prompts/:key/draft", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const prompt = findDefaultPrompt(req.params.key);
    const value = typeof req.body?.value === "string" ? req.body.value : "";
    const notes = typeof req.body?.notes === "string" ? req.body.notes : null;
    if (!prompt) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }

    const registry = await ensurePromptRegistry(prompt);
    const validation = validatePromptValue(
      value,
      registry.placeholders,
      registry.requiredPlaceholders,
    );
    const now = new Date();
    const draft = await db.transaction(async (tx) => {
      const [existingDraft] = await tx
        .select()
        .from(agentPromptVersionsTable)
        .where(and(
          eq(agentPromptVersionsTable.promptId, registry.id),
          eq(agentPromptVersionsTable.status, "draft"),
        ))
        .orderBy(desc(agentPromptVersionsTable.createdAt))
        .limit(1);

      if (existingDraft) {
        const [updated] = await tx
          .update(agentPromptVersionsTable)
          .set({
            value,
            notes,
            createdBy: req.user?.id ?? null,
            updatedAt: now,
          })
          .where(eq(agentPromptVersionsTable.id, existingDraft.id))
          .returning();
        return updated;
      }

      const [row] = await tx
        .select({
          next: sql<number>`coalesce(max(${agentPromptVersionsTable.versionNumber}), 0)::int + 1`,
        })
        .from(agentPromptVersionsTable)
        .where(eq(agentPromptVersionsTable.promptId, registry.id));

      const [created] = await tx
        .insert(agentPromptVersionsTable)
        .values({
          promptId: registry.id,
          versionNumber: Number(row?.next) || 1,
          status: "draft",
          value,
          notes,
          createdBy: req.user?.id ?? null,
          updatedAt: now,
        })
        .returning();
      return created;
    });

    await writeAuditLog(req, {
      action: "admin_prompt_draft_saved",
      category: "admin_action",
      metadata: {
        promptKey: registry.key,
        promptId: registry.id,
        versionId: draft.id,
        versionNumber: draft.versionNumber,
        validation,
      },
    });

    res.json({ ok: true, draft, validation });
  } catch (err) {
    rootLogger.error({ err }, "[admin/prompts/:key/draft] error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/prompts/:key/publish", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const prompt = findDefaultPrompt(req.params.key);
    if (!prompt) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }
    const registry = await ensurePromptRegistry(prompt);
    const [draft] = await db
      .select()
      .from(agentPromptVersionsTable)
      .where(and(
        eq(agentPromptVersionsTable.promptId, registry.id),
        eq(agentPromptVersionsTable.status, "draft"),
      ))
      .orderBy(desc(agentPromptVersionsTable.createdAt))
      .limit(1);
    if (!draft) {
      res.status(400).json({ error: "Nessuna bozza da pubblicare" });
      return;
    }
    const validation = validatePromptValue(
      draft.value,
      registry.placeholders,
      registry.requiredPlaceholders,
    );
    if (!validation.ok) {
      res.status(400).json({ error: validation.errors[0] ?? "Prompt non valido", validation });
      return;
    }

    const now = new Date();
    const active = await db.transaction(async (tx) => {
      await tx
        .update(agentPromptVersionsTable)
        .set({ status: "archived", updatedAt: now })
        .where(and(
          eq(agentPromptVersionsTable.promptId, registry.id),
          eq(agentPromptVersionsTable.status, "active"),
        ));
      const [published] = await tx
        .update(agentPromptVersionsTable)
        .set({
          status: "active",
          createdBy: req.user?.id ?? draft.createdBy ?? null,
          publishedAt: now,
          updatedAt: now,
        })
        .where(eq(agentPromptVersionsTable.id, draft.id))
        .returning();
      await tx
        .update(agentPromptsTable)
        .set({ activeVersionId: published.id, updatedAt: now })
        .where(eq(agentPromptsTable.id, registry.id));
      return published;
    });

    await writeAuditLog(req, {
      action: "admin_prompt_published",
      category: "admin_action",
      metadata: {
        promptKey: registry.key,
        promptId: registry.id,
        versionId: active.id,
        versionNumber: active.versionNumber,
        validation,
      },
    });

    res.json({ ok: true, active, validation });
  } catch (err) {
    rootLogger.error({ err }, "[admin/prompts/:key/publish] error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/prompts/:key/rollback", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const prompt = findDefaultPrompt(req.params.key);
    const versionId = Number(req.body?.versionId);
    if (!prompt || !Number.isFinite(versionId)) {
      res.status(400).json({ error: "Rollback non valido" });
      return;
    }
    const registry = await ensurePromptRegistry(prompt);
    const [source] = await db
      .select()
      .from(agentPromptVersionsTable)
      .where(and(
        eq(agentPromptVersionsTable.promptId, registry.id),
        eq(agentPromptVersionsTable.id, versionId),
      ))
      .limit(1);
    if (!source) {
      res.status(404).json({ error: "Versione prompt non trovata" });
      return;
    }
    const validation = validatePromptValue(
      source.value,
      registry.placeholders,
      registry.requiredPlaceholders,
    );
    if (!validation.ok) {
      res.status(400).json({ error: validation.errors[0] ?? "Versione non valida", validation });
      return;
    }

    const nextVersionNumber = await getNextPromptVersionNumber(registry.id);
    const now = new Date();
    const active = await db.transaction(async (tx) => {
      await tx
        .update(agentPromptVersionsTable)
        .set({ status: "rolled_back", updatedAt: now })
        .where(and(
          eq(agentPromptVersionsTable.promptId, registry.id),
          eq(agentPromptVersionsTable.status, "active"),
        ));
      await tx
        .update(agentPromptVersionsTable)
        .set({ status: "archived", updatedAt: now })
        .where(and(
          eq(agentPromptVersionsTable.promptId, registry.id),
          eq(agentPromptVersionsTable.status, "draft"),
        ));
      const [created] = await tx
        .insert(agentPromptVersionsTable)
        .values({
          promptId: registry.id,
          versionNumber: nextVersionNumber,
          status: "active",
          value: source.value,
          notes: `Rollback da v${source.versionNumber}`,
          createdBy: req.user?.id ?? null,
          publishedAt: now,
          updatedAt: now,
        })
        .returning();
      await tx
        .update(agentPromptsTable)
        .set({ activeVersionId: created.id, updatedAt: now })
        .where(eq(agentPromptsTable.id, registry.id));
      return created;
    });

    await writeAuditLog(req, {
      action: "admin_prompt_rollback",
      category: "admin_action",
      metadata: {
        promptKey: registry.key,
        promptId: registry.id,
        sourceVersionId: source.id,
        sourceVersionNumber: source.versionNumber,
        newVersionId: active.id,
        newVersionNumber: active.versionNumber,
      },
    });

    res.json({ ok: true, active });
  } catch (err) {
    rootLogger.error({ err }, "[admin/prompts/:key/rollback] error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/prompts/:key/reset", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const prompt = findDefaultPrompt(req.params.key);
    if (!prompt) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }
    const registry = await ensurePromptRegistry(prompt);
    const validation = validatePromptValue(
      registry.defaultValue,
      registry.placeholders,
      registry.requiredPlaceholders,
    );
    if (!validation.ok) {
      res.status(400).json({ error: validation.errors[0] ?? "Default non valido", validation });
      return;
    }

    const nextVersionNumber = await getNextPromptVersionNumber(registry.id);
    const now = new Date();
    const active = await db.transaction(async (tx) => {
      await tx
        .update(agentPromptVersionsTable)
        .set({ status: "archived", updatedAt: now })
        .where(eq(agentPromptVersionsTable.promptId, registry.id));
      const [created] = await tx
        .insert(agentPromptVersionsTable)
        .values({
          promptId: registry.id,
          versionNumber: nextVersionNumber,
          status: "active",
          value: registry.defaultValue,
          notes: "Reset al default",
          createdBy: req.user?.id ?? null,
          publishedAt: now,
          updatedAt: now,
        })
        .returning();
      await tx
        .update(agentPromptsTable)
        .set({ activeVersionId: created.id, updatedAt: now })
        .where(eq(agentPromptsTable.id, registry.id));
      return created;
    });

    await writeAuditLog(req, {
      action: "admin_prompt_reset_default",
      category: "admin_action",
      metadata: {
        promptKey: registry.key,
        promptId: registry.id,
        versionId: active.id,
        versionNumber: active.versionNumber,
      },
    });

    res.json({ ok: true, active, validation });
  } catch (err) {
    rootLogger.error({ err }, "[admin/prompts/:key/reset] error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/prompts/:key/preview", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const prompt = findDefaultPrompt(req.params.key);
    if (!prompt) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }
    const registry = await ensurePromptRegistry(prompt);
    const value =
      typeof req.body?.value === "string"
        ? req.body.value
        : (await getPromptPayload(prompt)).draftValue;
    const variables = sampleVariables(
      registry.placeholders,
      typeof req.body?.variables === "object" && req.body.variables ? req.body.variables : undefined,
    );
    const validation = validatePromptValue(
      value,
      registry.placeholders,
      registry.requiredPlaceholders,
    );
    res.json({
      ok: true,
      rendered: renderPrompt(value, variables),
      variables,
      validation,
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/prompts/:key/preview] error");
    res.status(500).json({ error: String(err) });
  }
});

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

    writeAuditLog(req, {
      action: "admin_quality_view",
      category: "admin_action",
      metadata: { domains: supervisorStats.map((s: any) => s.domain) },
    });

    res.json({
      supervisorStats,
      qualityStats,
      totals: totals[0] ?? { total: 0, avgEvalScore: 0, avgSupervisorScore: 0, rewrites: 0, clarifications: 0, uiTools: 0 },
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/quality] query failed");
    res.status(500).json({ error: String(err) });
  }
});

// ── Wendy Prometheus metrics as JSON ───────────────────────────────

router.get("/quality/overview", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const days = Math.max(1, Math.min(Number(req.query.days) || 30, 90));
    const limit = getLimit(req, 50, 100);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      totalsRows,
      domainRows,
      trendRows,
      aiTrendRows,
      supervisorRows,
      feedbackRows,
      problemSupervisorRows,
      negativeFeedbackRows,
    ] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          avgEvalScore: sql<number>`avg(${qualityMetrics.evalScore})::float`,
          avgSupervisorScore: sql<number>`avg(${qualityMetrics.supervisorScore})::float`,
          rewrites: sql<number>`count(*) filter (where ${qualityMetrics.rewritten} = true)::int`,
          clarifications: sql<number>`count(*) filter (where ${qualityMetrics.needsClarification} = true)::int`,
          uiTools: sql<number>`count(*) filter (where ${qualityMetrics.usedUiTool} = true)::int`,
          avgResponseTimeMs: sql<number>`avg(${qualityMetrics.responseTimeMs})::float`,
        })
        .from(qualityMetrics)
        .where(gte(qualityMetrics.createdAt, since)),
      db
        .select({
          domain: qualityMetrics.domain,
          total: sql<number>`count(*)::int`,
          avgEvalScore: sql<number>`avg(${qualityMetrics.evalScore})::float`,
          avgSupervisorScore: sql<number>`avg(${qualityMetrics.supervisorScore})::float`,
          rewrites: sql<number>`count(*) filter (where ${qualityMetrics.rewritten} = true)::int`,
          clarifications: sql<number>`count(*) filter (where ${qualityMetrics.needsClarification} = true)::int`,
          uiTools: sql<number>`count(*) filter (where ${qualityMetrics.usedUiTool} = true)::int`,
          avgResponseTimeMs: sql<number>`avg(${qualityMetrics.responseTimeMs})::float`,
        })
        .from(qualityMetrics)
        .where(gte(qualityMetrics.createdAt, since))
        .groupBy(qualityMetrics.domain)
        .orderBy(sql`avg(${qualityMetrics.evalScore}) asc nulls last`),
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${qualityMetrics.createdAt}), 'YYYY-MM-DD')`,
          total: sql<number>`count(*)::int`,
          avgEvalScore: sql<number>`avg(${qualityMetrics.evalScore})::float`,
          avgSupervisorScore: sql<number>`avg(${qualityMetrics.supervisorScore})::float`,
          rewrites: sql<number>`count(*) filter (where ${qualityMetrics.rewritten} = true)::int`,
          clarifications: sql<number>`count(*) filter (where ${qualityMetrics.needsClarification} = true)::int`,
          uiTools: sql<number>`count(*) filter (where ${qualityMetrics.usedUiTool} = true)::int`,
        })
        .from(qualityMetrics)
        .where(gte(qualityMetrics.createdAt, since))
        .groupBy(sql`date_trunc('day', ${qualityMetrics.createdAt})`)
        .orderBy(sql`date_trunc('day', ${qualityMetrics.createdAt}) asc`),
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${aiRequestLogTable.createdAt}), 'YYYY-MM-DD')`,
          avgLatencyMs: sql<number>`avg(${aiRequestLogTable.latencyMs})::float`,
          aiRequests: sql<number>`count(*)::int`,
          aiErrors: sql<number>`count(*) filter (where ${aiRequestLogTable.status} <> 'success')::int`,
          toolCalls: sql<number>`coalesce(sum(${aiRequestLogTable.toolCallsCount}), 0)::int`,
        })
        .from(aiRequestLogTable)
        .where(gte(aiRequestLogTable.createdAt, since))
        .groupBy(sql`date_trunc('day', ${aiRequestLogTable.createdAt})`)
        .orderBy(sql`date_trunc('day', ${aiRequestLogTable.createdAt}) asc`),
      db
        .select({
          total: sql<number>`count(*)::int`,
          avgScoreBefore: sql<number>`avg(${supervisorLogs.scoreBefore})::float`,
          avgScoreAfter: sql<number>`avg(${supervisorLogs.scoreAfter})::float`,
        })
        .from(supervisorLogs)
        .where(gte(supervisorLogs.createdAt, since)),
      db
        .select({
          total: sql<number>`count(*)::int`,
          negative: sql<number>`count(*) filter (where ${responseFeedbackTable.rating} < 0)::int`,
          positive: sql<number>`count(*) filter (where ${responseFeedbackTable.rating} > 0)::int`,
        })
        .from(responseFeedbackTable)
        .where(gte(responseFeedbackTable.createdAt, since)),
      db
        .select({
          id: supervisorLogs.id,
          createdAt: supervisorLogs.createdAt,
          sessionId: supervisorLogs.sessionId,
          domain: supervisorLogs.domain,
          intent: supervisorLogs.intent,
          userMessage: supervisorLogs.userMessage,
          draft: supervisorLogs.draft,
          finalText: supervisorLogs.finalText,
          scoreBefore: supervisorLogs.scoreBefore,
          scoreAfter: supervisorLogs.scoreAfter,
          reasons: supervisorLogs.reasons,
        })
        .from(supervisorLogs)
        .where(gte(supervisorLogs.createdAt, since))
        .orderBy(supervisorLogs.scoreBefore, desc(supervisorLogs.createdAt))
        .limit(limit),
      db
        .select({
          id: responseFeedbackTable.id,
          createdAt: responseFeedbackTable.createdAt,
          sessionId: responseFeedbackTable.sessionId,
          messageIndex: responseFeedbackTable.messageIndex,
          rating: responseFeedbackTable.rating,
          comment: responseFeedbackTable.comment,
          title: coachSessionsTable.title,
        })
        .from(responseFeedbackTable)
        .leftJoin(coachSessionsTable, eq(responseFeedbackTable.sessionId, coachSessionsTable.id))
        .where(and(gte(responseFeedbackTable.createdAt, since), sql`${responseFeedbackTable.rating} < 0`))
        .orderBy(desc(responseFeedbackTable.createdAt))
        .limit(Math.min(limit, 25)),
    ]);

    const totals = totalsRows[0] ?? {
      total: 0,
      avgEvalScore: null,
      avgSupervisorScore: null,
      rewrites: 0,
      clarifications: 0,
      uiTools: 0,
      avgResponseTimeMs: null,
    };
    const feedback = feedbackRows[0] ?? { total: 0, negative: 0, positive: 0 };
    const supervisor = supervisorRows[0] ?? { total: 0, avgScoreBefore: null, avgScoreAfter: null };
    const total = Number(totals.total) || 0;
    const rewrites = Number(totals.rewrites) || 0;
    const clarifications = Number(totals.clarifications) || 0;
    const uiTools = Number(totals.uiTools) || 0;
    const negativeFeedback = Number(feedback.negative) || 0;
    const feedbackTotal = Number(feedback.total) || 0;
    const rewriteRate = total > 0 ? rewrites / total : 0;
    const clarificationRate = total > 0 ? clarifications / total : 0;
    const toolUsageRate = total > 0 ? uiTools / total : 0;
    const negativeFeedbackRate = feedbackTotal > 0 ? negativeFeedback / feedbackTotal : 0;
    const avgScore =
      totals.avgEvalScore != null
        ? Number(totals.avgEvalScore)
        : totals.avgSupervisorScore != null
          ? Number(totals.avgSupervisorScore)
          : null;

    const domains = domainRows.map((row) => {
      const rowTotal = Number(row.total) || 0;
      const rowRewrites = Number(row.rewrites) || 0;
      const rowClarifications = Number(row.clarifications) || 0;
      const score = row.avgEvalScore != null ? Number(row.avgEvalScore) : row.avgSupervisorScore != null ? Number(row.avgSupervisorScore) : null;
      const rowRewriteRate = rowTotal > 0 ? rowRewrites / rowTotal : 0;
      const rowClarificationRate = rowTotal > 0 ? rowClarifications / rowTotal : 0;
      return {
        domain: row.domain,
        total: rowTotal,
        avgEvalScore: row.avgEvalScore != null ? Number(row.avgEvalScore) : null,
        avgSupervisorScore: row.avgSupervisorScore != null ? Number(row.avgSupervisorScore) : null,
        rewrites: rowRewrites,
        clarifications: rowClarifications,
        uiTools: Number(row.uiTools) || 0,
        rewriteRate: rowRewriteRate,
        clarificationRate: rowClarificationRate,
        toolUsageRate: rowTotal > 0 ? (Number(row.uiTools) || 0) / rowTotal : 0,
        avgResponseTimeMs: row.avgResponseTimeMs != null ? Math.round(Number(row.avgResponseTimeMs)) : null,
        status: qualityStatus(score, rowRewriteRate, rowClarificationRate),
      };
    });

    const aiByDay = new Map(aiTrendRows.map((row) => [row.day, row]));
    const trends = trendRows.map((row) => {
      const ai = aiByDay.get(row.day);
      const rowTotal = Number(row.total) || 0;
      const rowRewrites = Number(row.rewrites) || 0;
      const rowClarifications = Number(row.clarifications) || 0;
      const rowUiTools = Number(row.uiTools) || 0;
      return {
        day: row.day,
        total: rowTotal,
        avgEvalScore: row.avgEvalScore != null ? Number(row.avgEvalScore) : null,
        avgSupervisorScore: row.avgSupervisorScore != null ? Number(row.avgSupervisorScore) : null,
        rewriteRate: rowTotal > 0 ? rowRewrites / rowTotal : 0,
        clarificationRate: rowTotal > 0 ? rowClarifications / rowTotal : 0,
        toolUsageRate: rowTotal > 0 ? rowUiTools / rowTotal : 0,
        avgLatencyMs: ai?.avgLatencyMs != null ? Math.round(Number(ai.avgLatencyMs)) : null,
        aiRequests: ai ? Number(ai.aiRequests) || 0 : 0,
        aiErrors: ai ? Number(ai.aiErrors) || 0 : 0,
        toolCalls: ai ? Number(ai.toolCalls) || 0 : 0,
      };
    });

    const reasonCounts = new Map<string, number>();
    for (const row of problemSupervisorRows) {
      for (const reason of String(row.reasons ?? "")
        .split(/\n|;|,|\|/)
        .map((item) => item.trim())
        .filter(Boolean)) {
        reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
      }
    }
    const rewriteReasons = Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({ reason: safeSnippet(reason, 120), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const problemConversations = [
      ...problemSupervisorRows.map((row) => ({
        id: `supervisor-${row.id}`,
        source: "supervisor",
        createdAt: row.createdAt,
        sessionId: row.sessionId,
        domain: row.domain,
        intent: row.intent,
        score: row.scoreBefore,
        scoreAfter: row.scoreAfter,
        reason: safeSnippet(row.reasons, 180),
        snippet: safeSnippet(row.userMessage || row.draft || row.finalText, 180),
      })),
      ...negativeFeedbackRows.map((row) => ({
        id: `feedback-${row.id}`,
        source: "feedback",
        createdAt: row.createdAt,
        sessionId: row.sessionId,
        domain: "feedback",
        intent: row.title ?? "session_feedback",
        score: null,
        scoreAfter: null,
        reason: safeSnippet(row.comment || "Feedback negativo", 180),
        snippet: `Sessione #${row.sessionId}, messaggio ${row.messageIndex}`,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt as Date).getTime() - new Date(a.createdAt as Date).getTime())
      .slice(0, limit);

    const alerts: Array<{ level: "attention" | "critical"; title: string; message: string; domain: string | null }> = [];
    if (avgScore != null && avgScore < 0.6) {
      alerts.push({ level: "critical", title: "Score qualita critico", message: `Score medio ${(avgScore * 100).toFixed(0)}% sotto soglia 60%.`, domain: null });
    } else if (avgScore != null && avgScore < 0.75) {
      alerts.push({ level: "attention", title: "Score qualita in calo", message: `Score medio ${(avgScore * 100).toFixed(0)}% sotto soglia 75%.`, domain: null });
    }
    if (rewriteRate > 0.3) {
      alerts.push({ level: "critical", title: "Rewrite rate alto", message: `${(rewriteRate * 100).toFixed(1)}% dei turni richiede rewrite.`, domain: null });
    } else if (rewriteRate > 0.15) {
      alerts.push({ level: "attention", title: "Rewrite rate da monitorare", message: `${(rewriteRate * 100).toFixed(1)}% dei turni richiede rewrite.`, domain: null });
    }
    if (clarificationRate > 0.2) {
      alerts.push({ level: "attention", title: "Troppe chiarificazioni", message: `${(clarificationRate * 100).toFixed(1)}% dei turni chiede chiarimenti.`, domain: null });
    }
    if (negativeFeedbackRate > 0.25 && negativeFeedback >= 3) {
      alerts.push({ level: "critical", title: "Feedback negativo alto", message: `${negativeFeedback} feedback negativi su ${feedbackTotal}.`, domain: null });
    }
    for (const domain of domains.filter((item) => item.status !== "healthy").slice(0, 5)) {
      alerts.push({
        level: domain.status === "critical" ? "critical" : "attention",
        title: `Dominio ${domain.domain} ${domain.status === "critical" ? "critico" : "debole"}`,
        message: `${domain.total} turni, rewrite ${(domain.rewriteRate * 100).toFixed(1)}%, chiarificazioni ${(domain.clarificationRate * 100).toFixed(1)}%.`,
        domain: domain.domain,
      });
    }

    writeAuditLog(req, {
      action: "admin_quality_overview_view",
      category: "admin_action",
      metadata: { days, total, alerts: alerts.length },
    });

    res.json({
      generatedAt: new Date().toISOString(),
      days,
      summary: {
        total,
        avgEvalScore: totals.avgEvalScore != null ? Number(totals.avgEvalScore) : null,
        avgSupervisorScore: totals.avgSupervisorScore != null ? Number(totals.avgSupervisorScore) : null,
        rewriteRate,
        clarificationRate,
        toolUsageRate,
        rewrites,
        clarifications,
        uiTools,
        avgResponseTimeMs: totals.avgResponseTimeMs != null ? Math.round(Number(totals.avgResponseTimeMs)) : null,
        supervisorRewriteCount: Number(supervisor.total) || 0,
        avgScoreBeforeRewrite: supervisor.avgScoreBefore != null ? Number(supervisor.avgScoreBefore) : null,
        avgScoreAfterRewrite: supervisor.avgScoreAfter != null ? Number(supervisor.avgScoreAfter) : null,
        feedbackTotal,
        negativeFeedback,
        positiveFeedback: Number(feedback.positive) || 0,
        negativeFeedbackRate,
      },
      trends,
      domains,
      problemConversations,
      rewriteReasons,
      alerts,
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/quality/overview] error");
    res.status(500).json({ error: String(err) });
  }
});

function metricToJson(metricName: string) {
  const m = register.getSingleMetric(metricName);
  if (!m) return null;
  const data = (m as any).get();
  return {
    name: data.name,
    help: data.help,
    type: data.type,
    values: data.values ?? [],
  };
}

router.get("/wendy-metrics", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const requests = metricToJson("wendy_requests_total");
    const latency = metricToJson("wendy_latency_seconds");
    const rewrites = metricToJson("wendy_supervisor_rewrites_total");
    const tokens = metricToJson("wendy_llm_tokens_total");
    const confidence = metricToJson("wendy_router_confidence_histogram");

    // Aggregate volume per domain from requests
    const volumeByDomain: Record<string, number> = {};
    if (requests?.values) {
      for (const v of requests.values) {
        const domain = v.labels?.domain ?? "unknown";
        volumeByDomain[domain] = (volumeByDomain[domain] ?? 0) + (v.value ?? 0);
      }
    }

    // Aggregate rewrite rate
    const totalRequests = Object.values(volumeByDomain).reduce((a, b) => a + b, 0);
    const totalRewrites = rewrites?.values?.reduce((s: number, v: any) => s + (v.value ?? 0), 0) ?? 0;
    const rewriteRate = totalRequests > 0 ? totalRewrites / totalRequests : 0;

    // Aggregate avg latency per phase from latency histogram
    const latencyByPhase: Record<string, { sum: number; count: number }> = {};
    if (latency?.values) {
      for (const v of latency.values) {
        const phase = v.labels?.phase ?? "unknown";
        if (!latencyByPhase[phase]) latencyByPhase[phase] = { sum: 0, count: 0 };
        // prometheus histograms have _sum and _count buckets
        if (v.metricName?.endsWith("_sum")) {
          latencyByPhase[phase].sum += v.value ?? 0;
        } else if (v.metricName?.endsWith("_count")) {
          latencyByPhase[phase].count += v.value ?? 0;
        }
      }
    }

    res.json({
      volumeByDomain,
      totalRequests,
      totalRewrites,
      rewriteRate,
      latencyByPhase,
      confidence,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/wendy-metrics] error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/catalogs/sectors", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const sectors = await db
      .select({
        id: sectorsTable.id,
        name: sectorsTable.name,
        description: sectorsTable.description,
        trend: sectorsTable.trend,
        growthRate: sectorsTable.growthRate,
        automationRisk: sectorsTable.automationRisk,
        updatedAt: sectorsTable.updatedAt,
      })
      .from(sectorsTable)
      .orderBy(sectorsTable.name)
      .limit(getLimit(req, 100, 500));
    res.json(sectors);
  } catch (err) {
    rootLogger.error({ err }, "[admin/catalogs/sectors] error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/agent-health", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        agentName: agentRunsTable.agentName,
        totalCalls30d: sql<number>`count(*)::int`,
        errorCount30d: sql<number>`count(*) filter (where ${agentRunsTable.status} = 'failed')::int`,
        avgDurationMs: sql<number>`avg(${agentRunsTable.durationMs})::int`,
      })
      .from(agentRunsTable)
      .where(gte(agentRunsTable.startedAt, since))
      .groupBy(agentRunsTable.agentName)
      .orderBy(agentRunsTable.agentName);

    res.json({
      generatedAt: new Date().toISOString(),
      agents: rows.map((row) => {
        const total = Number(row.totalCalls30d) || 0;
        const errors = Number(row.errorCount30d) || 0;
        const successRate = total > 0 ? Math.round(((total - errors) / total) * 100) : 100;
        return {
          agentName: row.agentName,
          totalCalls30d: total,
          errorCount30d: errors,
          avgDurationMs: row.avgDurationMs ?? null,
          successRate30d: successRate,
          status: successRate >= 95 ? "healthy" : successRate >= 80 ? "degraded" : "critical",
        };
      }),
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/agent-health] error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/agents/overview", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const days = Math.max(1, Math.min(Number(req.query.days) || 30, 90));
    const limit = getLimit(req, 100, 200);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      agentRows,
      recentRuns,
      recentErrors,
      llmCostRows,
      llmProviderRows,
      aiRequestRows,
    ] = await Promise.all([
      db
        .select({
          agentName: agentRunsTable.agentName,
          totalCalls: sql<number>`count(*)::int`,
          completed: sql<number>`count(*) filter (where ${agentRunsTable.status} = 'completed')::int`,
          running: sql<number>`count(*) filter (where ${agentRunsTable.status} = 'running')::int`,
          errorCount: sql<number>`count(*) filter (where ${agentRunsTable.status} in ('failed', 'cancelled'))::int`,
          avgDurationMs: sql<number>`avg(${agentRunsTable.durationMs})::int`,
          lastRunAt: sql<Date>`max(${agentRunsTable.startedAt})`,
          lastErrorAt: sql<Date>`max(${agentRunsTable.startedAt}) filter (where ${agentRunsTable.status} in ('failed', 'cancelled'))`,
        })
        .from(agentRunsTable)
        .where(gte(agentRunsTable.startedAt, since))
        .groupBy(agentRunsTable.agentName)
        .orderBy(agentRunsTable.agentName),
      db
        .select({
          id: agentRunsTable.id,
          agentName: agentRunsTable.agentName,
          userId: agentRunsTable.userId,
          taskType: agentRunsTable.taskType,
          inputSummary: agentRunsTable.inputSummary,
          outputSummary: agentRunsTable.outputSummary,
          status: agentRunsTable.status,
          startedAt: agentRunsTable.startedAt,
          finishedAt: agentRunsTable.finishedAt,
          durationMs: agentRunsTable.durationMs,
          errorMessage: agentRunsTable.errorMessage,
          createdAt: agentRunsTable.createdAt,
        })
        .from(agentRunsTable)
        .where(gte(agentRunsTable.startedAt, since))
        .orderBy(desc(agentRunsTable.startedAt))
        .limit(limit),
      db
        .select({
          id: agentRunsTable.id,
          agentName: agentRunsTable.agentName,
          taskType: agentRunsTable.taskType,
          startedAt: agentRunsTable.startedAt,
          durationMs: agentRunsTable.durationMs,
          errorMessage: agentRunsTable.errorMessage,
          status: agentRunsTable.status,
        })
        .from(agentRunsTable)
        .where(and(gte(agentRunsTable.startedAt, since), sql`${agentRunsTable.status} in ('failed', 'cancelled')`))
        .orderBy(desc(agentRunsTable.startedAt))
        .limit(Math.min(limit, 50)),
      db
        .select({
          estimatedCostUsd: sql<number>`coalesce(sum(${llmUsageTable.estimatedCostUsd}), 0)`,
          totalTokens: sql<number>`coalesce(sum(${llmUsageTable.totalTokens}), 0)::int`,
          promptTokens: sql<number>`coalesce(sum(${llmUsageTable.promptTokens}), 0)::int`,
          completionTokens: sql<number>`coalesce(sum(${llmUsageTable.completionTokens}), 0)::int`,
          requestCount: sql<number>`count(*)::int`,
        })
        .from(llmUsageTable)
        .where(gte(llmUsageTable.createdAt, since)),
      db
        .select({
          provider: llmUsageTable.provider,
          costUsd: sql<number>`coalesce(sum(${llmUsageTable.estimatedCostUsd}), 0)`,
          tokens: sql<number>`coalesce(sum(${llmUsageTable.totalTokens}), 0)::int`,
          requests: sql<number>`count(*)::int`,
        })
        .from(llmUsageTable)
        .where(gte(llmUsageTable.createdAt, since))
        .groupBy(llmUsageTable.provider)
        .orderBy(sql`coalesce(sum(${llmUsageTable.estimatedCostUsd}), 0) desc`),
      db
        .select({
          aiRequestCostUsd: sql<number>`coalesce(sum(${aiRequestLogTable.costUsdEst}), 0)`,
          aiRequestTokens: sql<number>`coalesce(sum(${aiRequestLogTable.inputTokens} + ${aiRequestLogTable.outputTokens}), 0)::int`,
          aiRequests: sql<number>`count(*)::int`,
          aiErrors: sql<number>`count(*) filter (where ${aiRequestLogTable.status} <> 'success')::int`,
        })
        .from(aiRequestLogTable)
        .where(gte(aiRequestLogTable.createdAt, since)),
    ]);

    const agents = agentRows.map((row) => {
      const total = Number(row.totalCalls) || 0;
      const errors = Number(row.errorCount) || 0;
      const errorRate = total > 0 ? errors / total : 0;
      const successRate = total > 0 ? Math.round(((total - errors) / total) * 100) : 100;
      const status = errorRate > 0.2 ? "critical" : errorRate >= 0.05 ? "degraded" : "healthy";
      return {
        agentName: row.agentName,
        totalCalls30d: total,
        completed30d: Number(row.completed) || 0,
        running30d: Number(row.running) || 0,
        errorCount30d: errors,
        errorRate30d: Math.round(errorRate * 100),
        successRate30d: successRate,
        avgDurationMs: row.avgDurationMs ?? null,
        lastRunAt: row.lastRunAt ? row.lastRunAt.toISOString() : null,
        lastErrorAt: row.lastErrorAt ? row.lastErrorAt.toISOString() : null,
        status,
      };
    });

    const totalRuns = agents.reduce((sum, agent) => sum + agent.totalCalls30d, 0);
    const failedRuns = agents.reduce((sum, agent) => sum + agent.errorCount30d, 0);
    const runningRuns = agents.reduce((sum, agent) => sum + agent.running30d, 0);
    const avgDurationValues = agents
      .map((agent) => agent.avgDurationMs)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const avgDurationMs =
      avgDurationValues.length > 0
        ? Math.round(avgDurationValues.reduce((sum, value) => sum + value, 0) / avgDurationValues.length)
        : null;
    const llmCosts = llmCostRows[0] ?? {
      estimatedCostUsd: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      requestCount: 0,
    };
    const aiRequests = aiRequestRows[0] ?? {
      aiRequestCostUsd: 0,
      aiRequestTokens: 0,
      aiRequests: 0,
      aiErrors: 0,
    };
    const llmCost = Number(llmCosts.estimatedCostUsd) || 0;
    const aiRequestCost = Number(aiRequests.aiRequestCostUsd) || 0;

    res.json({
      generatedAt: new Date().toISOString(),
      summary: {
        totalRuns,
        totalAgents: agents.length,
        successRate30d: totalRuns > 0 ? Math.round(((totalRuns - failedRuns) / totalRuns) * 100) : 100,
        avgDurationMs,
        failedRuns,
        runningRuns,
        degradedAgents: agents.filter((agent) => agent.status === "degraded").length,
        criticalAgents: agents.filter((agent) => agent.status === "critical").length,
        costUsd30d: Math.max(llmCost, aiRequestCost),
        totalTokens30d: Math.max(Number(llmCosts.totalTokens) || 0, Number(aiRequests.aiRequestTokens) || 0),
        aiRequests30d: Math.max(Number(llmCosts.requestCount) || 0, Number(aiRequests.aiRequests) || 0),
        aiErrors30d: Number(aiRequests.aiErrors) || 0,
      },
      agents,
      recentRuns,
      recentErrors,
      costs: {
        days,
        estimatedCostUsd: llmCost,
        totalTokens: Number(llmCosts.totalTokens) || 0,
        promptTokens: Number(llmCosts.promptTokens) || 0,
        completionTokens: Number(llmCosts.completionTokens) || 0,
        requestCount: Number(llmCosts.requestCount) || 0,
        aiRequestCostUsd: aiRequestCost,
        aiRequestTokens: Number(aiRequests.aiRequestTokens) || 0,
        aiRequestCount: Number(aiRequests.aiRequests) || 0,
        aiErrorCount: Number(aiRequests.aiErrors) || 0,
        byProvider: llmProviderRows.map((row) => ({
          provider: row.provider,
          costUsd: Number(row.costUsd) || 0,
          tokens: Number(row.tokens) || 0,
          requests: Number(row.requests) || 0,
        })),
      },
      runnableAgents: RUNNABLE_AGENTS,
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/agents/overview] error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/metrics", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [users, tests, topSectors] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          premium: sql<number>`count(*) filter (where ${usersTable.isPremium} = true or ${usersTable.stripeSubscriptionId} is not null)::int`,
          new30d: sql<number>`count(*) filter (where ${usersTable.createdAt} >= ${since})::int`,
        })
        .from(usersTable),
      db.select({ total: sql<number>`count(*)::int` }).from(testSessionsTable),
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
    ]);

    res.json({
      users: users[0] ?? { total: 0, premium: 0, new30d: 0 },
      tests: tests[0] ?? { total: 0 },
      topSectors,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/metrics] error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/growth-queue", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const [queue, stats] = await Promise.all([
      db
        .select()
        .from(growthArticlesTable)
        .orderBy(desc(growthArticlesTable.createdAt))
        .limit(getLimit(req, 50, 100)),
      db
        .select({
          status: growthArticlesTable.status,
          count: sql<number>`count(*)::int`,
        })
        .from(growthArticlesTable)
        .groupBy(growthArticlesTable.status),
    ]);

    const byStatus = Object.fromEntries(stats.map((row) => [row.status, Number(row.count) || 0]));
    res.json({
      queue,
      stats: {
        pending: byStatus.pending ?? byStatus.draft ?? 0,
        published: byStatus.published ?? 0,
        rejected: byStatus.rejected ?? 0,
      },
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/growth-queue] error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/research/runs", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const runs = await db
      .select()
      .from(agentRunsTable)
      .where(sql`${agentRunsTable.agentName} in ('news', 'growth', 'news-research', 'growth-research')`)
      .orderBy(desc(agentRunsTable.startedAt))
      .limit(getLimit(req, 50, 100));

    res.json(
      runs.map((run) => ({
        id: String(run.id),
        agent: run.agentName.includes("growth") ? "growth" : "news",
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        durationMs: run.durationMs,
        status: run.status === "cancelled" ? "failed" : run.status,
        input: { summary: run.inputSummary },
        result: run.outputSummary ? { summary: run.outputSummary } : null,
        error: run.errorMessage,
      })),
    );
  } catch (err) {
    rootLogger.error({ err }, "[admin/research/runs] error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/research/news/run", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  const startedAt = new Date();
  try {
    const [run] = await db
      .insert(agentRunsTable)
      .values({
        agentName: "news-research",
        taskType: "manual_admin_run",
        inputSummary: JSON.stringify(req.body ?? {}),
        status: "completed",
        startedAt,
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        outputSummary: "Run registrata. Collegare collector reale quando le chiavi news sono configurate.",
      })
      .returning();
    res.status(201).json({ ok: true, added: 0, checked: 0, runId: run.id });
  } catch (err) {
    rootLogger.error({ err }, "[admin/research/news/run] error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/research/growth/run", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  const startedAt = new Date();
  try {
    const [run] = await db
      .insert(agentRunsTable)
      .values({
        agentName: "growth-research",
        taskType: "manual_admin_run",
        inputSummary: JSON.stringify(req.body ?? {}),
        status: "completed",
        startedAt,
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        outputSummary: "Run registrata. La generazione automatica resta agganciabile al job AI dedicato.",
      })
      .returning();
    res.status(201).json({ ok: true, added: 0, attempted: 0, runId: run.id });
  } catch (err) {
    rootLogger.error({ err }, "[admin/research/growth/run] error");
    res.status(500).json({ error: String(err) });
  }
});

// ── Agent Triggers ────────────────────────────────────────────────────────────

/** POST /api/admin/agents/collect — avvia il collector di notizie */
router.post("/agents/collect", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  const startedAt = new Date();
  try {
    const result = await runCollector();
    const run = await writeAgentRunSnapshot({
      agentName: "collector",
      taskType: "manual_admin_run",
      startedAt,
      status: "completed",
      outputSummary: JSON.stringify(result).slice(0, 1000),
    });
    rootLogger.info({ result }, "[admin] collector triggered manually");
    res.json({ ok: true, runId: run.id, ...result });
  } catch (err) {
    const run = await writeAgentRunSnapshot({
      agentName: "collector",
      taskType: "manual_admin_run",
      startedAt,
      status: "failed",
      errorMessage: String(err),
    }).catch(() => null);
    rootLogger.error({ err }, "[admin/agents/collect] error");
    res.status(500).json({ ok: false, runId: run?.id, error: String(err) });
  }
});

/** POST /api/admin/agents/enrich — avvia l'enricher LLM */
router.post("/agents/enrich", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  const startedAt = new Date();
  try {
    const batchSize = Number(req.query.batchSize) || 20;
    const result = await runEnricher(batchSize);
    const run = await writeAgentRunSnapshot({
      agentName: "enricher",
      taskType: "manual_admin_run",
      startedAt,
      status: "completed",
      inputSummary: JSON.stringify({ batchSize }),
      outputSummary: JSON.stringify(result).slice(0, 1000),
    });
    rootLogger.info({ result }, "[admin] enricher triggered manually");
    res.json({ ok: true, runId: run.id, ...result });
  } catch (err) {
    const run = await writeAgentRunSnapshot({
      agentName: "enricher",
      taskType: "manual_admin_run",
      startedAt,
      status: "failed",
      errorMessage: String(err),
    }).catch(() => null);
    rootLogger.error({ err }, "[admin/agents/enrich] error");
    res.status(500).json({ ok: false, runId: run?.id, error: String(err) });
  }
});

/** GET /api/admin/agents/status — ultimi run degli agenti */
router.get("/agents/status", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  try {
    const runs = await db
      .select()
      .from(agentRunsTable)
      .orderBy(desc(agentRunsTable.startedAt))
      .limit(20);
    res.json({ runs });
  } catch (err) {
    rootLogger.error({ err }, "[admin/agents/status] error");
    res.status(500).json({ error: String(err) });
  }
});

/** POST /api/admin/agents/sector-data — aggiorna dati mercato settori/professioni via LLM */
router.post("/agents/sector-data", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  const startedAt = new Date();
  try {
    const maxSectors     = Number(req.query.maxSectors)     || 5;
    const maxProfessions = Number(req.query.maxProfessions) || 10;
    const result = await runSectorDataAgent({ maxSectors, maxProfessions });
    const run = await writeAgentRunSnapshot({
      agentName: "sector-data",
      taskType: "manual_admin_run",
      startedAt,
      status: "completed",
      inputSummary: JSON.stringify({ maxSectors, maxProfessions }),
      outputSummary: JSON.stringify(result).slice(0, 1000),
    });
    rootLogger.info({ result }, "[admin] sector-data agent triggered");
    res.json({ ok: true, runId: run.id, ...result });
  } catch (err) {
    const run = await writeAgentRunSnapshot({
      agentName: "sector-data",
      taskType: "manual_admin_run",
      startedAt,
      status: "failed",
      errorMessage: String(err),
    }).catch(() => null);
    rootLogger.error({ err }, "[admin/agents/sector-data] error");
    res.status(500).json({ ok: false, runId: run?.id, error: String(err) });
  }
});

/** POST /api/admin/agents/backfill — genera embeddings mancanti per settori e professioni */
router.post("/agents/backfill", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  const startedAt = new Date();
  try {
    // Settori senza embedding
    const sectors = await db
      .select({ id: sectorsTable.id, name: sectorsTable.name, description: sectorsTable.description })
      .from(sectorsTable)
      .where(isNull(sectorsTable.embedding))
      .limit(100);

    let sectorsDone = 0;
    if (sectors.length > 0) {
      const items = sectors.map((s) => ({
        id: s.id,
        text: buildEmbeddingText([
          { label: "Settore", value: s.name },
          { label: "Descrizione", value: s.description },
        ]),
      }));
      const results = await generateEmbeddingsBatch(items);
      for (const r of results) {
        if (r.embedding) {
          await db
            .update(sectorsTable)
            .set({ embedding: r.embedding as any })
            .where(eq(sectorsTable.id, Number(r.id)));
          sectorsDone++;
        }
      }
    }

    // Professioni senza embedding
    const professions = await db
      .select({ id: professionsTable.id, title: professionsTable.title, description: professionsTable.description })
      .from(professionsTable)
      .where(isNull(professionsTable.embedding))
      .limit(100);

    let professionsDone = 0;
    if (professions.length > 0) {
      const items = professions.map((p) => ({
        id: p.id,
        text: buildEmbeddingText([
          { label: "Ruolo", value: p.title },
          { label: "Descrizione", value: p.description },
        ]),
      }));
      const results = await generateEmbeddingsBatch(items);
      for (const r of results) {
        if (r.embedding) {
          await db
            .update(professionsTable)
            .set({ embedding: r.embedding as any })
            .where(eq(professionsTable.id, Number(r.id)));
          professionsDone++;
        }
      }
    }

    rootLogger.info({ sectorsDone, professionsDone }, "[admin] backfill embeddings completed");
    const run = await writeAgentRunSnapshot({
      agentName: "backfill-embeddings",
      taskType: "manual_admin_run",
      startedAt,
      status: "completed",
      outputSummary: JSON.stringify({ sectorsDone, professionsDone }),
    });
    res.json({ ok: true, runId: run.id, sectorsDone, professionsDone });
  } catch (err) {
    const run = await writeAgentRunSnapshot({
      agentName: "backfill-embeddings",
      taskType: "manual_admin_run",
      startedAt,
      status: "failed",
      errorMessage: String(err),
    }).catch(() => null);
    rootLogger.error({ err }, "[admin/agents/backfill] error");
    res.status(500).json({ ok: false, runId: run?.id, error: String(err) });
  }
});

// ── GET /api/admin/error-report (Step Foundation refactor) ──
// Restituisce snapshot strutturato degli errori catturati da ExecutionMonitor
router.get("/error-report", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  try {
    const report = executionMonitor.getReport();
    res.json(report);
  } catch (err) {
    rootLogger.error({ err }, "[admin/error-report] error");
    res.status(500).json({ error: String(err) });
  }
});

// ── DELETE /api/admin/error-report — pulisce il buffer ──
router.delete("/error-report", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  executionMonitor.clear();
  res.json({ ok: true });
});

export default router;
