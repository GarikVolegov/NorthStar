import { Router, type Request, type Response } from "express";
import { agentEmployeesTable, agentRunsTable, db, professionsTable, sectorsTable } from "@workspace/db";
import { desc, eq, isNull } from "drizzle-orm";
import { buildEmbeddingText, generateEmbeddingsBatch, runCollector, runEnricher, runGrowthLibraryAgent, runJobPostingsAgent, runNewsPublisher, runSectorDataAgent } from "@workspace/ai-server";
import { AgentPatchSchema, type RegistrySnapshot } from "@workspace/api-zod/agent-registry";
import { rootLogger } from "../../middleware/logger";
import { agentRegistry } from "../../lib/agent-registry";
import { writeAgentRunSnapshot } from "./shared/agents";
import { runFastCollector } from "../../jobs/fast-collector";
import { registerAgentOverviewRoutes } from "./agents-overview";

const router = Router();

registerAgentOverviewRoutes(router);

router.post("/agents/fast-collect", async (_req: Request, res: Response) => {
  const startedAt = new Date();
  try {
    const result = await runFastCollector();
    const run = await writeAgentRunSnapshot({
      agentName: "fast-collector",
      taskType: "manual_admin_run",
      startedAt,
      status: "completed",
      outputSummary: JSON.stringify(result).slice(0, 1000),
    });
    res.json({ ok: true, runId: run.id, ...result });
  } catch (err) {
    const run = await writeAgentRunSnapshot({
      agentName: "fast-collector",
      taskType: "manual_admin_run",
      startedAt,
      status: "failed",
      errorMessage: String(err),
    }).catch(() => null);
    rootLogger.error({ err }, "[admin/agents/fast-collect] error");
    res.status(500).json({ ok: false, runId: run?.id, error: String(err) });
  }
});

router.post("/agents/publish-news", async (_req: Request, res: Response) => {
  const startedAt = new Date();
  try {
    const result = await runNewsPublisher();
    const warnings = result.missingCoverage.length
      ? [`Mancano news reali per ${result.missingCoverage.length} settori.`]
      : [];
    const run = await writeAgentRunSnapshot({
      agentName: "news-publisher",
      taskType: "manual_admin_run",
      startedAt,
      status: "completed",
      outputSummary: JSON.stringify(result).slice(0, 1000),
      ...(warnings.length ? { errorMessage: warnings.join(" | ") } : {}),
    });
    res.json({ ok: true, runId: run.id, ...result, warnings });
  } catch (err) {
    const run = await writeAgentRunSnapshot({
      agentName: "news-publisher",
      taskType: "manual_admin_run",
      startedAt,
      status: "failed",
      errorMessage: String(err),
    }).catch(() => null);
    rootLogger.error({ err }, "[admin/agents/publish-news] error");
    res.status(500).json({ ok: false, runId: run?.id, error: String(err) });
  }
});

router.post("/agents/growth-library", async (_req: Request, res: Response) => {
  const startedAt = new Date();
  try {
    const result = await runGrowthLibraryAgent();
    const run = await writeAgentRunSnapshot({
      agentName: "growth-library",
      taskType: "manual_admin_run",
      startedAt,
      status: "completed",
      outputSummary: JSON.stringify({ ...result, gaps: result.gaps.length }).slice(0, 1000),
    });
    res.json({ ok: true, runId: run.id, ...result });
  } catch (err) {
    const run = await writeAgentRunSnapshot({
      agentName: "growth-library",
      taskType: "manual_admin_run",
      startedAt,
      status: "failed",
      errorMessage: String(err),
    }).catch(() => null);
    rootLogger.error({ err }, "[admin/agents/growth-library] error");
    res.status(500).json({ ok: false, runId: run?.id, error: String(err) });
  }
});

router.post("/agents/job-postings", async (_req: Request, res: Response) => {
  const startedAt = new Date();
  try {
    const result = await runJobPostingsAgent();
    const run = await writeAgentRunSnapshot({
      agentName: "job-postings",
      taskType: "manual_admin_run",
      startedAt,
      status: "completed",
      outputSummary: JSON.stringify(result).slice(0, 1000),
    });
    res.json({ ok: true, runId: run.id, ...result });
  } catch (err) {
    const run = await writeAgentRunSnapshot({
      agentName: "job-postings",
      taskType: "manual_admin_run",
      startedAt,
      status: "failed",
      errorMessage: String(err),
    }).catch(() => null);
    rootLogger.error({ err }, "[admin/agents/job-postings] error");
    res.status(500).json({ ok: false, runId: run?.id, error: String(err) });
  }
});

/** POST /api/admin/agents/collect — avvia il collector di notizie */
router.post("/agents/collect", async (_req: Request, res: Response) => {
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
router.get("/agents/status", async (_req: Request, res: Response) => {
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
router.post("/agents/backfill", async (_req: Request, res: Response) => {
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
            .set({ embedding: r.embedding })
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
            .set({ embedding: r.embedding })
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

// ── Agent Room: registry live ────────────────────────────────────────────────

router.get("/agents", async (_req: Request, res: Response) => {
  try {
    const snapshot = await agentRegistry.getSnapshot();
    res.json(snapshot);
  } catch (err) {
    rootLogger.error({ err }, "[admin/agents] snapshot error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/agents/stream", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (snapshot: RegistrySnapshot) => {
    if (res.writableEnded) return;
    res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
  };

  try {
    const initial = await agentRegistry.getSnapshot();
    send(initial);
  } catch (err) {
    rootLogger.warn({ err }, "[admin/agents/stream] initial snapshot failed");
  }

  const onChange = (snapshot: RegistrySnapshot) => send(snapshot);
  agentRegistry.on("change", onChange);

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(":heartbeat\n\n");
  }, 15_000);
  if (typeof heartbeat.unref === "function") heartbeat.unref();

  const cleanup = () => {
    clearInterval(heartbeat);
    agentRegistry.off("change", onChange);
    if (!res.writableEnded) res.end();
  };

  req.on("close", cleanup);
  req.on("aborted", cleanup);
});

router.patch("/agents/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "invalid id" });
    return;
  }

  const parsed = AgentPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid body", details: parsed.error.flatten() });
    return;
  }

  const update: { systemPrompt?: string; isActive?: boolean } = {};
  if (parsed.data.systemPrompt !== undefined) update.systemPrompt = parsed.data.systemPrompt;
  if (parsed.data.isActive !== undefined) update.isActive = parsed.data.isActive;

  try {
    const [row] = await db
      .update(agentEmployeesTable)
      .set(update)
      .where(eq(agentEmployeesTable.id, id))
      .returning();

    if (!row) {
      res.status(404).json({ error: "agent not found" });
      return;
    }

    if (parsed.data.systemPrompt !== undefined) {
      agentRegistry.pushEvent(row.slug, "system_prompt_updated", "Prompt aggiornato dall'admin");
    }
    if (parsed.data.isActive === false) {
      agentRegistry.pushEvent(row.slug, "paused", "Agente messo in pausa");
    } else if (parsed.data.isActive === true) {
      agentRegistry.pushEvent(row.slug, "resumed", "Agente riattivato");
    }

    void agentRegistry.refresh().catch((err) => {
      rootLogger.warn({ err }, "[admin/agents/:id] post-update refresh failed");
    });

    res.json(row);
  } catch (err) {
    rootLogger.error({ err, id }, "[admin/agents/:id] update error");
    res.status(500).json({ error: String(err) });
  }
});

export default router;
