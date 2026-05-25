import { Router, type Request, type Response } from "express";
import {
  agentRunsTable,
  db,
  discoveryItemsTable,
  growthArticlesTable,
} from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";
import {
  runCollector,
  runEnricher,
  runNewsPublisher,
  searchWeb,
} from "@workspace/ai-server";
import { rootLogger } from "../../middleware/logger";
import {
  buildGrowthResearchArticle,
  compactText,
  writeAgentRunSnapshot,
} from "./shared/agents";
import { asPlainRecord } from "../../lib/type-guards";

const router = Router();

function getLimit(req: Request, fallback = 100, max = 200) {
  return Math.max(1, Math.min(Number(req.query.limit) || fallback, max));
}

router.get("/research/runs", async (req: Request, res: Response) => {
  try {
    const runs = await db
      .select()
      .from(agentRunsTable)
      .where(
        sql`${agentRunsTable.agentName} in ('news', 'growth', 'news-research', 'growth-research')`,
      )
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
  const startedAt = new Date();
  try {
    const warnings: string[] = [];
    const collector = await runCollector();

    let enricher: Awaited<ReturnType<typeof runEnricher>> | null = null;
    try {
      enricher = await runEnricher(20);
      if (enricher.errors.length) warnings.push(...enricher.errors.slice(0, 5));
    } catch (err) {
      warnings.push(`enricher: ${String(err).slice(0, 200)}`);
    }

    let publisher: Awaited<ReturnType<typeof runNewsPublisher>> | null = null;
    try {
      publisher = await runNewsPublisher();
      if (publisher.missingCoverage.length) {
        warnings.push(
          `Mancano news reali per ${publisher.missingCoverage.length} settori.`,
        );
      }
    } catch (err) {
      warnings.push(`publisher: ${String(err).slice(0, 200)}`);
    }

    const output = {
      collector,
      enricher,
      publisher,
      warnings,
    };
    const run = await writeAgentRunSnapshot({
      agentName: "news-research",
      taskType: "manual_admin_run",
      startedAt,
      status:
        warnings.length && !collector.totalInserted && !publisher?.transferred
          ? "failed"
          : "completed",
      inputSummary: JSON.stringify(req.body ?? {}),
      outputSummary: JSON.stringify(output).slice(0, 1000),
      ...(warnings.length
        ? { errorMessage: warnings.join(" | ").slice(0, 1000) }
        : {}),
    });

    res.status(201).json({
      ok: true,
      runId: run.id,
      checked: collector.totalCollected,
      added: publisher?.transferred ?? 0,
      collector,
      enricher,
      publisher,
      warnings,
    });
  } catch (err) {
    const run = await writeAgentRunSnapshot({
      agentName: "news-research",
      taskType: "manual_admin_run",
      startedAt,
      status: "failed",
      inputSummary: JSON.stringify(req.body ?? {}),
      errorMessage: String(err),
    }).catch(() => null);
    rootLogger.error({ err }, "[admin/research/news/run] error");
    res.status(500).json({ ok: false, runId: run?.id, error: String(err) });
  }
});

router.post("/research/growth/run", async (req: Request, res: Response) => {
  const startedAt = new Date();
  try {
    const body = (req.body ?? {}) as { topics?: unknown; limit?: unknown };
    const topics =
      Array.isArray(body.topics) && body.topics.length
        ? body.topics
            .map((topic) => compactText(topic, 120))
            .filter(Boolean)
            .slice(0, 5)
        : [
            "crescita personale lavoro focus produttivita abitudini",
            "orientamento professionale competenze futuro del lavoro",
            "benessere mentale burnout lavoro giovani professionisti",
          ];
    const perTopic = Math.max(1, Math.min(Number(body.limit) || 3, 5));

    const webResults = (
      await Promise.all(
        topics.map(async (topic) => ({
          topic,
          results: await searchWeb(topic, perTopic),
        })),
      )
    ).flatMap(({ topic, results }) =>
      results.map((result) => ({
        topic,
        title: compactText(
          asPlainRecord(result.metadata).title ?? result.source,
          180,
        ),
        url: result.source,
        source: "Tavily",
        summary: result.content,
      })),
    );

    const discoveryRows = await db
      .select()
      .from(discoveryItemsTable)
      .where(sql`${discoveryItemsTable.type} in ('growth', 'formation')`)
      .orderBy(desc(discoveryItemsTable.createdAt))
      .limit(20);

    const discoveryResults = discoveryRows.map((item) => ({
      topic: item.category || item.type,
      title: item.title,
      url: item.url,
      source: item.source || item.collectorSource || "Discovery Collector",
      summary: item.insightText || item.summary,
    }));

    const candidates = [...webResults, ...discoveryResults]
      .filter((item) => item.title || item.summary)
      .slice(0, 25);

    const created: Array<{
      id: number;
      title: string;
      slug: string;
      source: string;
    }> = [];
    const skipped: string[] = [];

    for (const [index, candidate] of candidates.entries()) {
      const payload = buildGrowthResearchArticle({ ...candidate, index });
      const [existing] = await db
        .select({ id: growthArticlesTable.id })
        .from(growthArticlesTable)
        .where(eq(growthArticlesTable.slug, payload.slug))
        .limit(1);
      if (existing) {
        skipped.push(payload.slug);
        continue;
      }
      const [article] = await db
        .insert(growthArticlesTable)
        .values(payload)
        .returning({
          id: growthArticlesTable.id,
          title: growthArticlesTable.title,
          slug: growthArticlesTable.slug,
        });
      if (article) created.push({ ...article, source: candidate.source });
    }

    const warnings = candidates.length
      ? []
      : [
          "Nessuna fonte trovata: configura TAVILY_API_KEY o avvia il collector discovery.",
        ];
    const output = {
      topics,
      attempted: candidates.length,
      created: created.length,
      skipped: skipped.length,
      webSources: webResults.length,
      discoverySources: discoveryResults.length,
      warnings,
    };
    const run = await writeAgentRunSnapshot({
      agentName: "growth-research",
      taskType: "manual_admin_run",
      startedAt,
      status: "completed",
      inputSummary: JSON.stringify({ topics, perTopic }),
      outputSummary: JSON.stringify(output).slice(0, 1000),
      ...(warnings.length ? { errorMessage: warnings.join(" | ") } : {}),
    });

    res.status(201).json({
      ok: true,
      runId: run.id,
      added: created.length,
      attempted: candidates.length,
      topics,
      created,
      warnings,
    });
  } catch (err) {
    const run = await writeAgentRunSnapshot({
      agentName: "growth-research",
      taskType: "manual_admin_run",
      startedAt,
      status: "failed",
      inputSummary: JSON.stringify(req.body ?? {}),
      errorMessage: String(err),
    }).catch(() => null);
    rootLogger.error({ err }, "[admin/research/growth/run] error");
    res.status(500).json({ ok: false, runId: run?.id, error: String(err) });
  }
});

// ── Agent Triggers ────────────────────────────────────────────────────────────

export default router;
