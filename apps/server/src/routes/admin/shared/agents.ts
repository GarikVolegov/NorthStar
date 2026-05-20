import { agentRunsTable, db } from "@workspace/db";
import type { growthArticlesTable } from "@workspace/db";

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

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

export async function writeAgentRunSnapshot(params: {
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
  if (!run) {
    throw new Error("Agent run snapshot insert failed");
  }
  return run;
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
    runnableAgents: RUNNABLE_AGENTS,
  };
}
