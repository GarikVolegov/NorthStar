import {
  db,
  discoveryItemsTable,
  growthArticlesTable,
} from "@workspace/db";
import {
  runCollector,
  runEnricher,
  runJobPostingsAgent,
  runNewsPublisher,
  runSectorDataAgent,
  searchWeb,
} from "@workspace/ai-server";
import { desc, eq, sql } from "drizzle-orm";
import { asPlainRecord } from "../../../lib/type-guards";
import {
  buildGrowthResearchArticle,
  compactText,
  RUNNABLE_PIPELINES,
  writeAgentRunSnapshot,
} from "./agents";

export { RUNNABLE_PIPELINES };

type AgentRunWriter = typeof writeAgentRunSnapshot;

export type PipelineResponse = Record<string, unknown> & {
  ok: boolean;
  runId?: number;
  warnings: string[];
};

function compactJson(value: unknown, max = 1000): string {
  return JSON.stringify(value).slice(0, max);
}

function warningText(value: unknown): string {
  return String(value).slice(0, 200);
}

export async function runNewsPublishingPipeline({
  body,
  startedAt = new Date(),
  deps = {},
}: {
  body?: Record<string, unknown>;
  startedAt?: Date;
  deps?: Partial<{
    runCollector: typeof runCollector;
    runEnricher: typeof runEnricher;
    runNewsPublisher: typeof runNewsPublisher;
    writeAgentRunSnapshot: AgentRunWriter;
  }>;
}): Promise<PipelineResponse> {
  const warnings: string[] = [];
  const collect = deps.runCollector ?? runCollector;
  const enrich = deps.runEnricher ?? runEnricher;
  const publish = deps.runNewsPublisher ?? runNewsPublisher;
  const writeRun = deps.writeAgentRunSnapshot ?? writeAgentRunSnapshot;

  let collector: Awaited<ReturnType<typeof runCollector>>;
  try {
    collector = await collect();
  } catch (err) {
    const warnings = [`collector: ${warningText(err)}`];
    const run = await writeRun({
      agentName: "news-publishing",
      taskType: "manual_pipeline_run",
      startedAt,
      status: "failed",
      inputSummary: compactJson(body ?? {}),
      outputSummary: compactJson({ warnings }),
      errorMessage: warnings.join(" | "),
    });
    return { ok: false, runId: run.id, warnings, error: String(err) };
  }
  let enricher: Awaited<ReturnType<typeof runEnricher>> | null = null;
  try {
    enricher = await enrich(20);
    if (enricher.errors.length) warnings.push(...enricher.errors.slice(0, 5));
  } catch (err) {
    warnings.push(`enricher: ${warningText(err)}`);
  }

  let publisher: Awaited<ReturnType<typeof runNewsPublisher>> | null = null;
  try {
    publisher = await publish();
    if (publisher.missingCoverage.length) {
      warnings.push(`Mancano news reali per ${publisher.missingCoverage.length} settori.`);
    }
  } catch (err) {
    warnings.push(`publisher: ${warningText(err)}`);
  }

  const output = { collector, enricher, publisher, warnings };
  const status =
    warnings.length && !collector.totalInserted && !publisher?.transferred
      ? "failed"
      : "completed";
  const run = await writeRun({
    agentName: "news-publishing",
    taskType: "manual_pipeline_run",
    startedAt,
    status,
    inputSummary: compactJson(body ?? {}),
    outputSummary: compactJson(output),
    ...(warnings.length ? { errorMessage: warnings.join(" | ").slice(0, 1000) } : {}),
  });

  return {
    ok: status === "completed",
    runId: run.id,
    checked: collector.totalCollected,
    added: publisher?.transferred ?? 0,
    collector,
    enricher,
    publisher,
    warnings,
  };
}

type GrowthCandidate = {
  topic: string;
  title: string;
  url?: string | null;
  source: string;
  summary: string;
};

export type GrowthArticlePayload = ReturnType<typeof buildGrowthResearchArticle>;

function defaultGrowthTopics(body: Record<string, unknown>) {
  const topics = Array.isArray(body.topics) && body.topics.length
    ? body.topics
        .map((topic) => compactText(topic, 120))
        .filter(Boolean)
        .slice(0, 5)
    : [
        "crescita personale lavoro focus produttivita abitudini",
        "orientamento professionale competenze futuro del lavoro",
        "benessere mentale burnout lavoro giovani professionisti",
      ];
  return topics;
}

async function loadDefaultGrowthDiscoverySources(): Promise<GrowthCandidate[]> {
  const discoveryRows = await db
    .select()
    .from(discoveryItemsTable)
    .where(sql`${discoveryItemsTable.type} in ('growth', 'formation')`)
    .orderBy(desc(discoveryItemsTable.createdAt))
    .limit(20);

  return discoveryRows.map((item) => ({
    topic: item.category || item.type,
    title: item.title,
    url: item.url,
    source: item.source || item.collectorSource || "Discovery Collector",
    summary: item.insightText || item.summary,
  }));
}

export async function runGrowthResearchReviewPipeline({
  body,
  startedAt = new Date(),
  deps = {},
}: {
  body?: Record<string, unknown>;
  startedAt?: Date;
  deps?: Partial<{
    searchWeb: typeof searchWeb;
    loadGrowthDiscoverySources: () => Promise<GrowthCandidate[]>;
    findExistingGrowthArticleBySlug: (slug: string) => Promise<{ id: number } | null>;
    insertGrowthArticle: (payload: GrowthArticlePayload) => Promise<{ id: number; title: string; slug: string } | null>;
    writeAgentRunSnapshot: AgentRunWriter;
  }>;
}): Promise<PipelineResponse> {
  const input = body ?? {};
  const topics = defaultGrowthTopics(input);
  const perTopic = Math.max(1, Math.min(Number(input.limit) || 3, 5));
  const search = deps.searchWeb ?? searchWeb;
  const loadDiscovery = deps.loadGrowthDiscoverySources ?? loadDefaultGrowthDiscoverySources;
  const findExisting = deps.findExistingGrowthArticleBySlug ?? (async (slug: string) => {
    const [existing] = await db
      .select({ id: growthArticlesTable.id })
      .from(growthArticlesTable)
      .where(eq(growthArticlesTable.slug, slug))
      .limit(1);
    return existing ?? null;
  });
  const insertArticle = deps.insertGrowthArticle ?? (async (payload: GrowthArticlePayload) => {
    const [article] = await db
      .insert(growthArticlesTable)
      .values(payload)
      .returning({
        id: growthArticlesTable.id,
        title: growthArticlesTable.title,
        slug: growthArticlesTable.slug,
      });
    return article ?? null;
  });
  const writeRun = deps.writeAgentRunSnapshot ?? writeAgentRunSnapshot;

  const webResults = (
    await Promise.all(
      topics.map(async (topic) => ({
        topic,
        results: await search(topic, perTopic),
      })),
    )
  ).flatMap(({ topic, results }) =>
    results.map((result) => ({
      topic,
      title: compactText(asPlainRecord(result.metadata).title ?? result.source, 180),
      url: result.source,
      source: "Tavily",
      summary: result.content,
    })),
  );

  const discoveryResults = await loadDiscovery();
  const candidates = [...webResults, ...discoveryResults]
    .filter((item) => item.title || item.summary)
    .slice(0, 25);

  const created: Array<{ id: number; title: string; slug: string; source: string }> = [];
  const skipped: string[] = [];

  for (const [index, candidate] of candidates.entries()) {
    const payload = buildGrowthResearchArticle({ ...candidate, index });
    const existing = await findExisting(payload.slug);
    if (existing) {
      skipped.push(payload.slug);
      continue;
    }
    const article = await insertArticle(payload);
    if (article) created.push({ ...article, source: candidate.source });
  }

  const warnings = candidates.length
    ? []
    : ["Nessuna fonte trovata: configura TAVILY_API_KEY o avvia il collector discovery."];
  const output = {
    topics,
    attempted: candidates.length,
    created: created.length,
    skipped: skipped.length,
    webSources: webResults.length,
    discoverySources: discoveryResults.length,
    warnings,
  };
  const run = await writeRun({
    agentName: "growth-research-review",
    taskType: "manual_pipeline_run",
    startedAt,
    status: "completed",
    inputSummary: compactJson({ topics, perTopic }),
    outputSummary: compactJson(output),
    ...(warnings.length ? { errorMessage: warnings.join(" | ") } : {}),
  });

  return {
    ok: true,
    runId: run.id,
    added: created.length,
    attempted: candidates.length,
    topics,
    created,
    warnings,
  };
}

export async function runMarketRefreshPipeline({
  body,
  startedAt = new Date(),
  deps = {},
}: {
  body?: Record<string, unknown>;
  startedAt?: Date;
  deps?: Partial<{
    runJobPostingsAgent: typeof runJobPostingsAgent;
    runSectorDataAgent: typeof runSectorDataAgent;
    writeAgentRunSnapshot: AgentRunWriter;
  }>;
}): Promise<PipelineResponse> {
  const jobs = deps.runJobPostingsAgent ?? runJobPostingsAgent;
  const sectors = deps.runSectorDataAgent ?? runSectorDataAgent;
  const writeRun = deps.writeAgentRunSnapshot ?? writeAgentRunSnapshot;
  const warnings: string[] = [];

  let jobPostings: Awaited<ReturnType<typeof runJobPostingsAgent>> | null = null;
  try {
    jobPostings = await jobs();
  } catch (err) {
    warnings.push(`job-postings: ${warningText(err)}`);
  }

  let sectorData: Awaited<ReturnType<typeof runSectorDataAgent>> | null = null;
  try {
    sectorData = await sectors();
  } catch (err) {
    warnings.push(`sector-data: ${warningText(err)}`);
  }

  const output = { jobPostings, sectorData, warnings };
  const status = warnings.length && !jobPostings && !sectorData ? "failed" : "completed";
  const run = await writeRun({
    agentName: "market-refresh",
    taskType: "manual_pipeline_run",
    startedAt,
    status,
    inputSummary: compactJson(body ?? {}),
    outputSummary: compactJson(output),
    ...(warnings.length ? { errorMessage: warnings.join(" | ").slice(0, 1000) } : {}),
  });

  return {
    ok: status === "completed",
    runId: run.id,
    jobPostings,
    sectorData,
    snapshotsUpdated: jobPostings?.updated ?? 0,
    snapshotsInserted: jobPostings?.inserted ?? 0,
    warnings,
  };
}
