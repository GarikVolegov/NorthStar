import {
  agentRunsTable,
  db,
  discoveryItemsTable,
  growthArticlesTable,
  jobPostingSnapshotsTable,
  newsArticlesTable,
} from "@workspace/db";
import { getOpenAIFallbackConfig, PUBLIC_NEWS_SOURCES } from "@workspace/ai-server";
import { desc, eq, sql } from "drizzle-orm";

export type AgentConfigBlocker = {
  key: string;
  label: string;
  status: "configured" | "missing";
  severity: "critical" | "warning";
  message: string;
};

export type ReadyOutputStatus = "ready" | "attention" | "empty" | "blocked_or_empty";

export type AgentReadyOutputsInput = {
  realNews: number;
  pendingDiscovery: number;
  growthArticles: number;
  jobSnapshots: number;
  latestNews: Array<{ id: number; title: string; source: string; createdAt: Date | string }>;
  latestGrowthArticles: Array<{ id: number; title: string; status: string; createdAt: Date | string }>;
};

export function buildAgentConfigBlockers(env: Record<string, string | undefined> = process.env): AgentConfigBlocker[] {
  const checks: AgentConfigBlocker[] = [
    {
      key: "OPENAI_API_KEY",
      label: "OpenAI fallback",
      status: getOpenAIFallbackConfig(env) ? "configured" : "missing",
      severity: "critical",
      message: "Fallback stabile per Wendy quando OpenRouter free va in rate limit.",
    },
    {
      key: "ADZUNA_APP_ID",
      label: "Adzuna app id",
      status: env.ADZUNA_APP_ID ? "configured" : "missing",
      severity: "warning",
      message: "Necessario per popolare job_posting_snapshots da Adzuna.",
    },
    {
      key: "ADZUNA_API_KEY",
      label: "Adzuna API key",
      status: env.ADZUNA_API_KEY ? "configured" : "missing",
      severity: "warning",
      message: "Necessaria per popolare job_posting_snapshots da Adzuna.",
    },
    {
      key: "JOOBLE_API_KEY",
      label: "Jooble API key",
      status: env.JOOBLE_API_KEY ? "configured" : "missing",
      severity: "warning",
      message: "Opzionale ma utile per aumentare copertura offerte lavoro.",
    },
    {
      key: "PRINTING_PRESS_BRIDGE_URL",
      label: "Printing Press bridge",
      status: env.PRINTING_PRESS_BRIDGE_URL ? "configured" : "missing",
      severity: "warning",
      message: "Necessario per scraping strutturato tramite skill /printing-press.",
    },
  ];

  return checks.filter((check) => check.status === "missing");
}

export function summarizeReadyOutputs(input: AgentReadyOutputsInput) {
  return {
    realNews: {
      count: input.realNews,
      status: input.realNews > 0 ? "ready" : "empty",
      latest: input.latestNews,
    },
    pendingDiscovery: {
      count: input.pendingDiscovery,
      status: input.pendingDiscovery > 0 ? "attention" : "ready",
    },
    growthArticles: {
      count: input.growthArticles,
      status: input.growthArticles > 0 ? "ready" : "empty",
      latest: input.latestGrowthArticles,
    },
    jobSnapshots: {
      count: input.jobSnapshots,
      status: input.jobSnapshots > 0 ? "ready" : "blocked_or_empty",
    },
  } satisfies Record<string, { count: number; status: ReadyOutputStatus; latest?: unknown[] }>;
}

export function getAiProviderStatus(env: Record<string, string | undefined> = process.env) {
  const openRouterConfigured = Boolean(env.OPENROUTER_API_KEY);
  const openAiFallbackConfigured = Boolean(getOpenAIFallbackConfig(env));
  return {
    activeProvider: env.AI_PROVIDER ?? "openai",
    openRouterConfigured,
    openAiFallbackConfigured,
    model: env.OPENROUTER_MODEL ?? env.OPENAI_MODEL ?? "gpt-4o-mini",
    status: openRouterConfigured || openAiFallbackConfigured ? "configured" : "missing_provider",
  };
}

export async function buildAgentControlRoom() {
  const sourceList = sql.join(PUBLIC_NEWS_SOURCES.map((source) => sql`${source}`), sql`, `);
  const [
    realNewsRows,
    pendingDiscoveryRows,
    growthRows,
    jobRows,
    latestNews,
    latestGrowthArticles,
    latestRuns,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(newsArticlesTable)
      .where(sql`lower(${newsArticlesTable.source}) in (${sourceList})`),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(discoveryItemsTable)
      .where(eq(discoveryItemsTable.isEnriched, false)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(growthArticlesTable),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobPostingSnapshotsTable),
    db
      .select({
        id: newsArticlesTable.id,
        title: newsArticlesTable.title,
        source: newsArticlesTable.source,
        createdAt: newsArticlesTable.createdAt,
      })
      .from(newsArticlesTable)
      .where(sql`lower(${newsArticlesTable.source}) in (${sourceList})`)
      .orderBy(desc(newsArticlesTable.createdAt))
      .limit(5),
    db
      .select({
        id: growthArticlesTable.id,
        title: growthArticlesTable.title,
        status: growthArticlesTable.status,
        createdAt: growthArticlesTable.createdAt,
      })
      .from(growthArticlesTable)
      .orderBy(desc(growthArticlesTable.createdAt))
      .limit(5),
    db
      .select({
        id: agentRunsTable.id,
        agentName: agentRunsTable.agentName,
        status: agentRunsTable.status,
        startedAt: agentRunsTable.startedAt,
        errorMessage: agentRunsTable.errorMessage,
      })
      .from(agentRunsTable)
      .orderBy(desc(agentRunsTable.startedAt))
      .limit(8),
  ]);

  return {
    ai: getAiProviderStatus(),
    configBlockers: buildAgentConfigBlockers(),
    readyOutputs: summarizeReadyOutputs({
      realNews: Number(realNewsRows[0]?.count ?? 0),
      pendingDiscovery: Number(pendingDiscoveryRows[0]?.count ?? 0),
      growthArticles: Number(growthRows[0]?.count ?? 0),
      jobSnapshots: Number(jobRows[0]?.count ?? 0),
      latestNews,
      latestGrowthArticles,
    }),
    latestRuns,
  };
}
