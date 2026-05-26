import type { growthArticlesTable } from "@workspace/db";
export { writeAgentRunSnapshot } from "../../../lib/agent-runs";

export type PipelineRisk = "low" | "medium" | "high";
export type PipelineReviewPolicy = "auto_publish" | "requires_review" | "data_refresh";

export type AdminRunnablePipeline = {
  key: string;
  label: string;
  description: string;
  endpoint: string;
  method: "POST";
  risk: PipelineRisk;
  steps: string[];
  outputs: string[];
  requiredConfigKeys: string[];
  reviewPolicy: PipelineReviewPolicy;
};

export const RUNNABLE_PIPELINES = [
  {
    key: "news-publishing",
    label: "Ricerca e pubblica notizie",
    description: "Raccoglie fonti news, arricchisce i discovery item e pubblica articoli editoriali reali.",
    endpoint: "/admin/pipelines/news-publishing/run",
    method: "POST",
    risk: "low",
    steps: ["Collector", "Enricher", "News publisher"],
    outputs: ["News pubblicate", "Coverage settori", "Warning editoriali"],
    requiredConfigKeys: ["OPENAI_API_KEY"],
    reviewPolicy: "auto_publish",
  },
  {
    key: "growth-research-review",
    label: "Ricerca crescita personale",
    description: "Cerca fonti web e discovery per creare bozze pending nella Coda Crescita.",
    endpoint: "/admin/pipelines/growth-research-review/run",
    method: "POST",
    risk: "low",
    steps: ["Web research", "Discovery", "Coda Crescita"],
    outputs: ["Bozze create", "Topic coperti", "Fonti candidate"],
    requiredConfigKeys: ["TAVILY_API_KEY"],
    reviewPolicy: "requires_review",
  },
  {
    key: "market-refresh",
    label: "Aggiorna lavori e settori",
    description: "Aggiorna snapshot offerte lavoro e dati mercato per settori e professioni.",
    endpoint: "/admin/pipelines/market-refresh/run",
    method: "POST",
    risk: "medium",
    steps: ["Job postings", "Sector data"],
    outputs: ["Snapshot aggiornati", "Settori aggiornati", "Professioni aggiornate"],
    requiredConfigKeys: ["ADZUNA_APP_ID", "ADZUNA_API_KEY"],
    reviewPolicy: "data_refresh",
  },
] as const satisfies readonly AdminRunnablePipeline[];

export const RUNNABLE_AGENTS = [
  {
    key: "news-research",
    label: "News Research",
    description:
      "Esegue collector, enrichment e publisher per portare notizie reali nella piattaforma.",
    endpoint: "/admin/research/news/run",
    method: "POST",
    risk: "low",
    requiresInput: true,
  },
  {
    key: "growth-research",
    label: "Growth Research",
    description:
      "Cerca fonti web/documentali e crea bozze pending nella Coda Crescita.",
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
    key: "fast-collector",
    label: "Fast Collector",
    description: "Raccoglie solo fonti prioritarie per aggiornare le news entro 1-2 ore.",
    endpoint: "/admin/agents/fast-collect",
    method: "POST",
    risk: "low",
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
    key: "news-publisher",
    label: "News Publisher",
    description: "Pubblica in /news solo discovery item arricchiti da fonti editoriali reali.",
    endpoint: "/admin/agents/publish-news",
    method: "POST",
    risk: "low",
    requiresInput: false,
  },
  {
    key: "growth-library",
    label: "Growth Library",
    description: "Cura e genera articoli di crescita personale quando la configurazione AI lo consente.",
    endpoint: "/admin/agents/growth-library",
    method: "POST",
    risk: "medium",
    requiresInput: false,
  },
  {
    key: "job-postings",
    label: "Job Postings",
    description: "Popola snapshot aggregati offerte lavoro da provider configurati.",
    endpoint: "/admin/agents/job-postings",
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

export async function optionalAdminRead<T>(
  read: () => Promise<T>,
  fallback: T,
): Promise<{ value: T; unavailable: boolean; error?: string }> {
  try {
    return { value: await read(), unavailable: false };
  } catch (err) {
    return {
      value: fallback,
      unavailable: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export type RecentAgentRunBase = {
  id: number;
  agentName: string;
  taskType: string | null;
  inputSummary: string | null;
  outputSummary: string | null;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  durationMs: number | null;
  errorMessage: string | null;
};

export function formatRecentAgentRuns(rows: RecentAgentRunBase[]) {
  return rows.map((row) => ({
    ...row,
    userId: null,
    createdAt: row.startedAt,
  }));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

export function compactText(value: unknown, max = 700) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function estimateReadTimeMinutes(content: string) {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.ceil(words / 180));
}

export function growthResearchTags(topic: string, extra: string[] = []) {
  const topicTags = topic
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((part) => part.length > 3)
    .slice(0, 4);
  return Array.from(
    new Set(["ricerca", "crescita", "documenti", ...topicTags, ...extra]),
  ).slice(0, 8);
}

export function buildGrowthResearchArticle(input: {
  title: string;
  url?: string | null;
  source: string;
  summary: string;
  topic: string;
  index: number;
}) {
  const title =
    compactText(input.title, 140) || `Ricerca crescita: ${input.topic}`;
  const summary = compactText(input.summary, 900);
  const url = input.url ? compactText(input.url, 500) : "";
  const content = [
    `# ${title}`,
    "",
    "## Fonte",
    url ? `${input.source}: ${url}` : input.source,
    "",
    "## Sintesi",
    summary ||
      "Fonte raccolta dall'agente di ricerca. Da completare in revisione editoriale.",
    "",
    "## Perche conta per NorthStar",
    `Questo spunto e collegato al tema "${input.topic}" e puo aiutare Wendy a proporre contenuti pratici per orientamento, lavoro e crescita professionale.`,
    "",
    "## Spunti da validare",
    "- Verificare accuratezza e freschezza della fonte.",
    "- Adattare esempi e tono al pubblico NorthStar.",
    "- Trasformare la ricerca in una guida applicabile prima della pubblicazione.",
  ].join("\n");

  return {
    title,
    slug: slugify(`${title}-${Date.now()}-${input.index}`),
    category: "crescita-professionale",
    subcategory: "ricerca",
    description:
      summary.slice(0, 240) ||
      `Bozza generata dall'agente ricerca crescita su ${input.topic}.`,
    content,
    tags: growthResearchTags(input.topic, [
      input.source.toLowerCase().replace(/\s+/g, "-"),
    ]),
    difficulty: "base",
    personalityMatches: [],
    sectorLinks: [],
    status: "pending",
    readTimeMinutes: estimateReadTimeMinutes(content),
    updatedAt: new Date(),
  } satisfies typeof growthArticlesTable.$inferInsert;
}

export function emptyAgentsOverview(days: number, reason?: string) {
  const fallbackKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "";
  const fallbackLooksUsable =
    Boolean(fallbackKey) &&
    !/placeholder|inactive|changeme/i.test(fallbackKey);
  return {
    generatedAt: new Date().toISOString(),
    days,
    persistenceUnavailable: Boolean(reason),
    reason: reason ?? null,
    setupAction: reason ? "run_migrations" : null,
    summary: {
      totalRuns: 0,
      totalAgents: 0,
      successRate30d: 100,
      avgDurationMs: null,
      failedRuns: 0,
      runningRuns: 0,
      degradedAgents: 0,
      criticalAgents: 0,
      costUsd30d: 0,
      totalTokens30d: 0,
      aiRequests30d: 0,
      aiErrors30d: 0,
    },
    agents: [],
    recentRuns: [],
    recentErrors: [],
    costs: {
      days,
      estimatedCostUsd: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      requestCount: 0,
      aiRequestCostUsd: 0,
      aiRequestTokens: 0,
      aiRequestCount: 0,
      aiErrorCount: 0,
      byProvider: [],
    },
    runnablePipelines: RUNNABLE_PIPELINES,
    advancedRunnableAgents: RUNNABLE_AGENTS,
    runnableAgents: RUNNABLE_AGENTS,
    controlRoom: {
      ai: {
        activeProvider: process.env.AI_PROVIDER ?? "openai",
        openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
        openAiFallbackConfigured: fallbackLooksUsable,
        model: process.env.OPENROUTER_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        status: "unknown",
      },
      configBlockers: [],
      readyOutputs: {
        realNews: { count: 0, status: "empty", latest: [] },
        pendingDiscovery: { count: 0, status: "ready" },
        growthArticles: { count: 0, status: "empty", latest: [] },
        jobSnapshots: { count: 0, status: "blocked_or_empty" },
      },
      latestRuns: [],
    },
  };
}
