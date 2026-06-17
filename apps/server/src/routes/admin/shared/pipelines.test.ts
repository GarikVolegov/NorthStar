import { describe, expect, it, vi } from "vitest";
import {
  RUNNABLE_PIPELINES,
  runGrowthResearchReviewPipeline,
  runMarketRefreshPipeline,
  runNewsPublishingPipeline,
  type GrowthArticlePayload,
} from "./pipelines";
import type { writeAgentRunSnapshot } from "../../../lib/agent-runs";

type AgentRunInput = Parameters<typeof writeAgentRunSnapshot>[0];
type AgentRunResult = Awaited<ReturnType<typeof writeAgentRunSnapshot>>;

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
    const writeAgentRunSnapshot = vi.fn(async (input: AgentRunInput) => ({ id: 41, ...input } as unknown as AgentRunResult));

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

  it("records a failed pipeline run when the first news step fails", async () => {
    const writeAgentRunSnapshot = vi.fn(async (input: AgentRunInput) => ({ id: 44, ...input } as unknown as AgentRunResult));

    const result = await runNewsPublishingPipeline({
      body: {},
      startedAt: new Date("2026-05-26T10:00:00Z"),
      deps: {
        runCollector: vi.fn(async () => {
          throw new Error("collector down");
        }),
        writeAgentRunSnapshot,
      },
    });

    expect(writeAgentRunSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      agentName: "news-publishing",
      taskType: "manual_pipeline_run",
      status: "failed",
      errorMessage: expect.stringContaining("collector down") as unknown as string,
    }));
    expect(result).toMatchObject({ ok: false, runId: 44 });
  });

  it("creates growth research outputs as pending review drafts", async () => {
    const inserted: Array<Record<string, unknown>> = [];
    const writeAgentRunSnapshot = vi.fn(async (input: AgentRunInput) => ({ id: 42, ...input } as unknown as AgentRunResult));

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
        insertGrowthArticle: vi.fn(async (payload: GrowthArticlePayload) => {
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
    const writeAgentRunSnapshot = vi.fn(async (input: AgentRunInput) => ({ id: 43, ...input } as unknown as AgentRunResult));

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
