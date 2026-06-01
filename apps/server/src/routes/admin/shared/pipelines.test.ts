import { describe, expect, it, vi } from "vitest";
import {
  RUNNABLE_PIPELINES,
  runGrowthResearchReviewPipeline,
  runMarketRefreshPipeline,
  runNewsPublishingPipeline,
} from "./pipelines";

type AgentRunSnapshotInput = {
  agentName: string;
  taskType: string;
  startedAt: Date;
  status: "completed" | "failed";
  inputSummary?: string;
  outputSummary?: string;
  errorMessage?: string;
};

function agentRunSnapshot(id: number, input: AgentRunSnapshotInput) {
  const finishedAt = new Date(input.startedAt.getTime() + 100);
  return {
    id,
    agentName: input.agentName,
    userId: null,
    taskType: input.taskType,
    inputSummary: input.inputSummary ?? null,
    outputSummary: input.outputSummary ?? null,
    status: input.status,
    retryCount: 0,
    startedAt: input.startedAt,
    finishedAt,
    durationMs: finishedAt.getTime() - input.startedAt.getTime(),
    errorMessage: input.errorMessage ?? null,
    createdAt: input.startedAt,
  };
}

function stableNewsDiagnostics() {
  return {
    status: "ready",
    providerStatus: "ready",
    enabledSources: 1,
    sourcesWithErrors: 0,
    totalFetched: 10,
    lastFetchAt: "2026-06-01T08:00:00.000Z",
    lastAttemptAt: "2026-06-01T08:00:00.000Z",
    stalenessMs: 0,
    refreshAction: "wait_for_next_refresh",
    nextAction: "wait_for_next_refresh",
    actionLabel: "Attendi prossimo refresh",
    message: "Ready",
  } as const;
}

describe("admin runnable pipelines", () => {
  it("exposes task-oriented pipelines without atomic agents as primary actions", () => {
    expect(RUNNABLE_PIPELINES.map((pipeline) => pipeline.key)).toEqual([
      "news-publishing",
      "growth-research-review",
      "market-refresh",
    ]);
    expect(RUNNABLE_PIPELINES.map((pipeline) => pipeline.key)).not.toContain("collector");
    expect(RUNNABLE_PIPELINES.map((pipeline) => pipeline.endpoint)).toEqual([
      "/admin/pipelines/news-publishing/run",
      "/admin/pipelines/growth-research-review/run",
      "/admin/pipelines/market-refresh/run",
    ]);
  });

  it("runs news publishing steps in order and records one pipeline run", async () => {
    const order: string[] = [];
    const writeAgentRunSnapshot = vi.fn(async (input: AgentRunSnapshotInput) => agentRunSnapshot(41, input));

    const result = await runNewsPublishingPipeline({
      body: { sectorNames: ["Economia"] },
      startedAt: new Date("2026-05-26T10:00:00Z"),
      deps: {
        runCollector: vi.fn(async () => {
          order.push("collector");
          return { totalCollected: 12, totalInserted: 8, bySource: {}, errors: [], durationMs: 100 };
        }),
        runEnricher: vi.fn(async () => {
          order.push("enricher");
          return { processed: 6, enriched: 6, skipped: 0, filtered: 0, retried: 0, durationMs: 100, errors: [] };
        }),
        runNewsPublisher: vi.fn(async () => {
          order.push("publisher");
          return { transferred: 4, seeded: 0, missingCoverage: [], durationMs: 100 };
        }),
        loadNewsProviderDiagnostics: vi.fn(async () => stableNewsDiagnostics()),
        writeAgentRunSnapshot,
      },
    });

    expect(order).toEqual(["collector", "enricher", "publisher"]);
    expect(writeAgentRunSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      agentName: "news-publishing",
      taskType: "manual_pipeline_run",
      status: "completed",
      inputSummary: JSON.stringify({ sectorNames: ["Economia"] }),
    }));
    expect(result).toMatchObject({ ok: true, runId: 41, added: 4 });
  });

  it("returns news provider diagnostics before and after a manual publishing pipeline", async () => {
    const before = {
      status: "stale",
      providerStatus: "stale",
      enabledSources: 2,
      sourcesWithErrors: 0,
      totalFetched: 12,
      lastFetchAt: "2026-05-30T08:00:00.000Z",
      lastAttemptAt: "2026-05-30T08:00:00.000Z",
      refreshAction: "retry_later",
      nextAction: "retry_later",
      actionLabel: "Riprova piu tardi",
      message: "Stale",
    };
    const after = {
      ...before,
      status: "ready",
      providerStatus: "ready",
      totalFetched: 17,
      lastFetchAt: "2026-05-31T08:00:00.000Z",
      lastAttemptAt: "2026-05-31T08:00:00.000Z",
      refreshAction: "wait_for_next_refresh",
      nextAction: "wait_for_next_refresh",
      actionLabel: "Attendi prossimo refresh",
      message: "Ready",
    };

    const result = await runNewsPublishingPipeline({
      body: {},
      startedAt: new Date("2026-05-26T10:00:00Z"),
      deps: {
        loadNewsProviderDiagnostics: vi.fn()
          .mockResolvedValueOnce(before)
          .mockResolvedValueOnce(after),
        runCollector: vi.fn(async () => ({ totalCollected: 12, totalInserted: 8, bySource: {}, errors: [], durationMs: 100 })),
        runEnricher: vi.fn(async () => ({ processed: 6, enriched: 6, skipped: 0, filtered: 0, retried: 0, durationMs: 100, errors: [] })),
        runNewsPublisher: vi.fn(async () => ({ transferred: 4, seeded: 0, missingCoverage: [], durationMs: 100 })),
        writeAgentRunSnapshot: vi.fn(async (input: AgentRunSnapshotInput) => agentRunSnapshot(46, input)),
      },
    });

    expect(result.providerDiagnosticsBefore).toEqual(before);
    expect(result.providerDiagnostics).toEqual(after);
  });

  it("returns actionable news source diagnostics for empty provider results", async () => {
    const previousGnews = process.env.GNEWS_API_KEY;
    const previousTavily = process.env.TAVILY_API_KEY;
    delete process.env.GNEWS_API_KEY;
    process.env.TAVILY_API_KEY = "test-key";

    try {
      const result = await runNewsPublishingPipeline({
        body: {},
        startedAt: new Date("2026-05-26T10:00:00Z"),
        deps: {
          runCollector: vi.fn(async () => ({
            totalCollected: 4,
            totalInserted: 0,
            bySource: {
              gnews: 0,
              tavily_news: 0,
              static_rss: 4,
              dynamic_sources: 0,
            },
            errors: ["static_rss: HTTP 403 for https://example.com/feed.xml"],
            durationMs: 100,
          })),
          runEnricher: vi.fn(async () => ({ processed: 0, enriched: 0, skipped: 0, filtered: 0, retried: 0, durationMs: 100, errors: [] })),
          runNewsPublisher: vi.fn(async () => ({ transferred: 0, seeded: 0, missingCoverage: [], durationMs: 100 })),
          loadNewsProviderDiagnostics: vi.fn(async () => stableNewsDiagnostics()),
          writeAgentRunSnapshot: vi.fn(async (input: AgentRunSnapshotInput) => agentRunSnapshot(45, input)),
        },
      });

      expect(result.sourceDiagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({
          key: "gnews",
          label: "GNews",
          status: "not_configured",
          action: "Configura GNEWS_API_KEY e rilancia la pipeline.",
        }),
        expect.objectContaining({
          key: "tavily_news",
          label: "Tavily",
          status: "empty",
          action: "Controlla quota, query recenti e filtri lingua/lavoro Tavily.",
        }),
        expect.objectContaining({
          key: "static_rss",
          label: "RSS statici",
          status: "error",
          lastError: "static_rss: HTTP 403 for https://example.com/feed.xml",
        }),
      ]));
    } finally {
      if (previousGnews === undefined) delete process.env.GNEWS_API_KEY;
      else process.env.GNEWS_API_KEY = previousGnews;
      if (previousTavily === undefined) delete process.env.TAVILY_API_KEY;
      else process.env.TAVILY_API_KEY = previousTavily;
    }
  });

  it("records a failed pipeline run when the first news step fails", async () => {
    const writeAgentRunSnapshot = vi.fn(async (input: AgentRunSnapshotInput) => agentRunSnapshot(44, input));

    const result = await runNewsPublishingPipeline({
      body: {},
      startedAt: new Date("2026-05-26T10:00:00Z"),
      deps: {
        runCollector: vi.fn(async () => {
          throw new Error("collector down");
        }),
        loadNewsProviderDiagnostics: vi.fn(async () => stableNewsDiagnostics()),
        writeAgentRunSnapshot,
      },
    });

    expect(writeAgentRunSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      agentName: "news-publishing",
      taskType: "manual_pipeline_run",
      status: "failed",
      errorMessage: expect.stringContaining("collector down"),
    }));
    expect(result).toMatchObject({ ok: false, runId: 44 });
  });

  it("creates growth research outputs as pending review drafts", async () => {
    const inserted: Array<Record<string, unknown>> = [];
    const writeAgentRunSnapshot = vi.fn(async (input: AgentRunSnapshotInput) => agentRunSnapshot(42, input));

    const result = await runGrowthResearchReviewPipeline({
      body: { topics: ["focus lavoro"], limit: 1 },
      startedAt: new Date("2026-05-26T10:00:00Z"),
      deps: {
        searchWeb: vi.fn(async () => [{
          id: 1,
          source: "https://example.com/focus",
          sourceType: "web" as const,
          score: 0.9,
          content: "Una sintesi utile sul focus.",
          metadata: { title: "Focus nel lavoro" },
        }]),
        loadGrowthDiscoverySources: vi.fn(async () => []),
        findExistingGrowthArticleBySlug: vi.fn(async () => null),
        insertGrowthArticle: vi.fn(async (payload) => {
          inserted.push(payload);
          return { id: 7, title: String(payload.title), slug: String(payload.slug) };
        }),
        writeAgentRunSnapshot,
      },
    });

    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ status: "pending" });
    expect(writeAgentRunSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      agentName: "growth-research-review",
      taskType: "manual_pipeline_run",
      status: "completed",
    }));
    expect(result).toMatchObject({ ok: true, runId: 42, added: 1 });
  });

  it("runs market refresh jobs and sector data in order", async () => {
    const order: string[] = [];
    const writeAgentRunSnapshot = vi.fn(async (input: AgentRunSnapshotInput) => agentRunSnapshot(43, input));

    const result = await runMarketRefreshPipeline({
      body: {},
      startedAt: new Date("2026-05-26T10:00:00Z"),
      deps: {
        runJobPostingsAgent: vi.fn(async () => {
          order.push("job-postings");
          return { inserted: 5, updated: 3, processedProfessions: 4 };
        }),
        runSectorDataAgent: vi.fn(async () => {
          order.push("sector-data");
          return { sectorsUpdated: 2, professionsUpdated: 6, errors: [], durationMs: 100 };
        }),
        writeAgentRunSnapshot,
      },
    });

    expect(order).toEqual(["job-postings", "sector-data"]);
    expect(writeAgentRunSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      agentName: "market-refresh",
      taskType: "manual_pipeline_run",
      status: "completed",
    }));
    expect(result).toMatchObject({ ok: true, runId: 43 });
  });
});
