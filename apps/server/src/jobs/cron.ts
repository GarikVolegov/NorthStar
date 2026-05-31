import { applyNeuralEdgeDecay, dispatchQueuedAgentTasks, executeAgentTask, recoverStaleAgentTasks, runCollector, runEnricher, runSectorDataAgent, runNewsPublisher, refreshCatalog, runGrowthLibraryAgent, runJobPostingsAgent } from "@workspace/ai-server";
import { rootLogger } from "../middleware/logger";
import { runWeakSignalDetector } from "./weak-signal-detector";
import { runProactiveInsightGenerator } from "./proactive-insight-generator";
import { runBriefingGenerator } from "./briefing-generator";
import { safeRunRoutineScheduler } from "./routine-scheduler";
import { runFastCollector } from "./fast-collector";
import { runVaultIngest } from "./vault-ingest";
import { writeAgentRunSnapshot } from "../lib/agent-runs";
import { notifyAgentTaskFinished } from "../services/agents/agent-task-notifications";

const COLLECTOR_INTERVAL_MS        = Number(process.env.COLLECTOR_INTERVAL_MS) || 6 * 60 * 60 * 1000;       // 6 ore
const FAST_COLLECTOR_INTERVAL_MS   = Number(process.env.FAST_COLLECTOR_INTERVAL_MS) || 90 * 60 * 1000;      // 90 min
const ENRICHER_INTERVAL_MS         = Number(process.env.ENRICHER_INTERVAL_MS)  || 2 * 60 * 60 * 1000;       // 2 ore
const STARTUP_DELAY_MS             = Number(process.env.CRON_STARTUP_DELAY_MS) || 30_000;                    // 30s
const WEAK_SIGNAL_INTERVAL_MS       = Number(process.env.WEAK_SIGNAL_INTERVAL_MS)       || 7 * 24 * 60 * 60 * 1000; // 7 giorni
const PROACTIVE_INSIGHT_INTERVAL_MS = Number(process.env.PROACTIVE_INSIGHT_INTERVAL_MS) || 24 * 60 * 60 * 1000; // 24 ore
const BRIEFING_WEEKLY_INTERVAL_MS   = Number(process.env.BRIEFING_WEEKLY_INTERVAL_MS)   || 7 * 24 * 60 * 60 * 1000; // 7 giorni (lunedì)
const BRIEFING_DAILY_INTERVAL_MS    = Number(process.env.BRIEFING_DAILY_INTERVAL_MS)    || 24 * 60 * 60 * 1000; // 24 ore
const GROWTH_LIBRARY_INTERVAL_MS    = Number(process.env.GROWTH_LIBRARY_INTERVAL_MS)    || 24 * 60 * 60 * 1000; // 24 ore
const JOB_POSTINGS_INTERVAL_MS      = Number(process.env.JOB_POSTINGS_INTERVAL_MS)      || 24 * 60 * 60 * 1000; // 24 ore
const VAULT_INGEST_INTERVAL_MS      = Number(process.env.VAULT_INGEST_INTERVAL_MS)      || 24 * 60 * 60 * 1000; // 24 ore
const WENDY_NEURAL_DECAY_INTERVAL_MS = Number(process.env.WENDY_NEURAL_DECAY_INTERVAL_MS) || 24 * 60 * 60 * 1000; // 24 ore
const ROUTINE_SCHEDULER_INTERVAL_MS = Number(process.env.ROUTINE_SCHEDULER_INTERVAL_MS) || 30 * 60 * 1000; // 30 min
const AGENT_OPERATOR_INTERVAL_MS = Number(process.env.AGENT_OPERATOR_INTERVAL_MS) || 5 * 60 * 1000; // 5 min
const RUN_STARTUP_HEAVY_JOBS =
  process.env.CRON_RUN_ON_STARTUP === "true" ||
  (process.env.NODE_ENV === "production" && process.env.CRON_RUN_ON_STARTUP !== "false");

async function recordCronRun<T>(
  agentName: string,
  taskType: string,
  run: () => Promise<T>,
  summarize: (result: T) => Record<string, unknown>,
): Promise<T> {
  const startedAt = new Date();
  try {
    const result = await run();
    await writeAgentRunSnapshot({
      agentName,
      taskType,
      startedAt,
      status: "completed",
      outputSummary: JSON.stringify(summarize(result)).slice(0, 1000),
    }).catch((err) => rootLogger.warn({ err, agentName }, "[cron] agent run snapshot failed"));
    return result;
  } catch (err) {
    await writeAgentRunSnapshot({
      agentName,
      taskType,
      startedAt,
      status: "failed",
      errorMessage: String(err).slice(0, 1000),
    }).catch((snapshotErr) => rootLogger.warn({ err: snapshotErr, agentName }, "[cron] agent run snapshot failed"));
    throw err;
  }
}

async function safeRunCollector(): Promise<void> {
  try {
    rootLogger.info("[cron] collector starting");
    const result = await recordCronRun("collector", "cron", runCollector, (result) => ({
      totalCollected: result.totalCollected,
      totalInserted: result.totalInserted,
      durationMs: result.durationMs,
    }));
    rootLogger.info({ totalCollected: result.totalCollected, totalInserted: result.totalInserted, bySource: result.bySource, durationMs: result.durationMs }, "[cron] collector complete");
  } catch (err) {
    rootLogger.error({ err }, "[cron] collector failed");
  }
}

async function safeRunFastCollector(): Promise<void> {
  try {
    rootLogger.info("[cron] fast collector starting");
    const result = await recordCronRun("fast-collector", "cron", runFastCollector, (result) => ({
      totalCollected: result.totalCollected,
      totalInserted: result.totalInserted,
      durationMs: result.durationMs,
    }));
    rootLogger.info({ totalCollected: result.totalCollected, totalInserted: result.totalInserted, bySource: result.bySource, durationMs: result.durationMs }, "[cron] fast collector complete");
  } catch (err) {
    rootLogger.error({ err }, "[cron] fast collector failed");
  }
}

async function safeRunEnricher(): Promise<void> {
  try {
    rootLogger.info("[cron] enricher starting");
    const result = await recordCronRun("enricher", "cron", runEnricher, (result) => ({
      processed: result.processed,
      enriched: result.enriched,
      filtered: result.filtered,
      durationMs: result.durationMs,
    }));
    rootLogger.info({ processed: result.processed, enriched: result.enriched, filtered: result.filtered, durationMs: result.durationMs }, "[cron] enricher complete");
  } catch (err) {
    rootLogger.error({ err }, "[cron] enricher failed");
  }
}

async function safeRunNewsPublisher(): Promise<void> {
  try {
    rootLogger.info("[cron] news-publisher starting");
    const result = await recordCronRun("news-publisher", "cron", runNewsPublisher, (result) => ({
      transferred: result.transferred,
      missingCoverage: result.missingCoverage.length,
      durationMs: result.durationMs,
    }));
    rootLogger.info(
      {
        transferred: result.transferred,
        missingCoverage: result.missingCoverage.length,
        durationMs: result.durationMs,
      },
      "[cron] news-publisher complete",
    );
  } catch (err) {
    rootLogger.error({ err }, "[cron] news-publisher failed");
  }
}

async function safeRunGrowthLibraryAgent(): Promise<void> {
  try {
    rootLogger.info("[cron] growth-library-agent starting");
    const result = await recordCronRun("growth-library", "cron", runGrowthLibraryAgent, (result) => ({
      curated: result.curated,
      generated: result.generated,
      gapCount: result.gaps.length,
      durationMs: result.durationMs,
    }));
    rootLogger.info({ ...result, gapCount: result.gaps.length }, "[cron] growth-library-agent complete");
  } catch (err) {
    rootLogger.error({ err }, "[cron] growth-library-agent failed");
  }
}

async function safeRunJobPostingsAgent(): Promise<void> {
  try {
    rootLogger.info("[cron] job-postings-agent starting");
    const result = await recordCronRun("job-postings", "cron", runJobPostingsAgent, (result) => ({ ...result }));
    rootLogger.info({ ...result }, "[cron] job-postings-agent complete");
  } catch (err) {
    rootLogger.error({ err }, "[cron] job-postings-agent failed");
  }
}

async function safeRunSectorData(): Promise<void> {
  try {
    rootLogger.info("[cron] sector-data agent starting");
    const result = await runSectorDataAgent({ maxSectors: 15, maxProfessions: 50 });
    rootLogger.info({ sectorsUpdated: result.sectorsUpdated, professionsUpdated: result.professionsUpdated, durationMs: result.durationMs }, "[cron] sector-data agent complete");
  } catch (err) {
    rootLogger.error({ err }, "[cron] sector-data agent failed");
  }
}

const SECTOR_DATA_INTERVAL_MS = Number(process.env.SECTOR_DATA_INTERVAL_MS) || 7 * 24 * 60 * 60 * 1000; // 7 giorni
const MODEL_DISCOVERY_INTERVAL_MS = Number(process.env.MODEL_DISCOVERY_INTERVAL_MS) || 7 * 24 * 60 * 60 * 1000; // 7 giorni

async function safeRunModelDiscovery(): Promise<void> {
  try {
    rootLogger.info("[cron] model-discovery starting");
    const report = await refreshCatalog();
    rootLogger.info(
      { candidates: report.candidates.length, source: report.source, message: report.message },
      "[cron] model-discovery complete",
    );
  } catch (err) {
    rootLogger.error({ err }, "[cron] model-discovery failed");
  }
}

async function safeRunWeakSignalDetector(): Promise<void> {
  try {
    rootLogger.info("[cron] weak-signal-detector starting");
    const result = await runWeakSignalDetector();
    rootLogger.info({ ...result }, "[cron] weak-signal-detector complete");
  } catch (err) {
    rootLogger.error({ err }, "[cron] weak-signal-detector failed");
  }
}

async function safeRunProactiveInsightGenerator(): Promise<void> {
  try {
    rootLogger.info("[cron] proactive-insight-generator starting");
    const result = await runProactiveInsightGenerator();
    rootLogger.info({ ...result }, "[cron] proactive-insight-generator complete");
  } catch (err) {
    rootLogger.error({ err }, "[cron] proactive-insight-generator failed");
  }
}

async function safeRunVaultIngest(): Promise<void> {
  try {
    rootLogger.info("[cron] vault-ingest starting");
    const result = await recordCronRun("vault-ingest", "cron", runVaultIngest, (result) => ({
      scanned: result.scanned,
      ingested: result.ingested,
      skippedRuntimeFalse: result.skippedRuntimeFalse,
      skippedUnchanged: result.skippedUnchanged,
      errors: result.errors,
      durationMs: result.durationMs,
    }));
    rootLogger.info({ ...result }, "[cron] vault-ingest complete");
  } catch (err) {
    rootLogger.error({ err }, "[cron] vault-ingest failed");
  }
}

async function safeRunWendyNeuralDecay(): Promise<void> {
  try {
    rootLogger.info("[cron] wendy-neural-decay starting");
    const result = await recordCronRun("wendy-neural-decay", "cron", applyNeuralEdgeDecay, (result) => ({
      archivedEdges: result.archivedEdges,
      decayDays: result.decayDays,
    }));
    rootLogger.info({ ...result }, "[cron] wendy-neural-decay complete");
  } catch (err) {
    rootLogger.error({ err }, "[cron] wendy-neural-decay failed");
  }
}

async function safeRunAgentOperator(): Promise<void> {
  try {
    const recovered = await recoverStaleAgentTasks({
      runningTimeoutMs: Number(process.env.AGENT_OPERATOR_RUNNING_TIMEOUT_MS) || 60 * 60 * 1000,
    });
    await Promise.all(recovered.failedTaskIds.map((taskId) => notifyAgentTaskFinished(taskId)));
    const dispatched = await dispatchQueuedAgentTasks({
      limit: Number(process.env.AGENT_OPERATOR_DISPATCH_LIMIT) || 5,
      executeTask: async (taskId, options) => {
        await executeAgentTask(taskId, options);
        await notifyAgentTaskFinished(taskId);
      },
    });
    rootLogger.info({ recovered, dispatched }, "[cron] agent operator complete");
  } catch (err) {
    rootLogger.error({ err }, "[cron] agent operator failed");
  }
}

export function startCronJobs(): void {
  rootLogger.info({
    collectorIntervalH:        COLLECTOR_INTERVAL_MS        / 3_600_000,
    fastCollectorIntervalMin:  FAST_COLLECTOR_INTERVAL_MS   / 60_000,
    enricherIntervalH:         ENRICHER_INTERVAL_MS         / 3_600_000,
    sectorDataIntervalD:       SECTOR_DATA_INTERVAL_MS      / 86_400_000,
    weakSignalIntervalD:       WEAK_SIGNAL_INTERVAL_MS      / 86_400_000,
    proactiveInsightIntervalH: PROACTIVE_INSIGHT_INTERVAL_MS / 3_600_000,
    growthLibraryIntervalH:    GROWTH_LIBRARY_INTERVAL_MS    / 3_600_000,
    jobPostingsIntervalH:      JOB_POSTINGS_INTERVAL_MS      / 3_600_000,
    vaultIngestIntervalH:      VAULT_INGEST_INTERVAL_MS      / 3_600_000,
    wendyNeuralDecayIntervalH: WENDY_NEURAL_DECAY_INTERVAL_MS / 3_600_000,
    routineSchedulerIntervalMin: ROUTINE_SCHEDULER_INTERVAL_MS / 60_000,
    agentOperatorIntervalMin: AGENT_OPERATOR_INTERVAL_MS / 60_000,
    briefingWeeklyIntervalD:   BRIEFING_WEEKLY_INTERVAL_MS  / 86_400_000,
    briefingDailyIntervalH:    BRIEFING_DAILY_INTERVAL_MS   / 3_600_000,
  }, "[cron] starting scheduled jobs");

  // Run iniziale dopo startup delay. In development resta opt-in: questi job
  // consumano DB pool e rate limit LLM, e possono rallentare Wendy all'avvio.
  if (RUN_STARTUP_HEAVY_JOBS) {
    setTimeout(() => {
      void safeRunCollector();
      void safeRunEnricher();
      void safeRunNewsPublisher();
    }, STARTUP_DELAY_MS);
  } else {
    rootLogger.info("[cron] startup heavy jobs skipped; set CRON_RUN_ON_STARTUP=true to enable");
  }

  // Collector ogni 6 ore
  setInterval(() => { void safeRunCollector(); }, COLLECTOR_INTERVAL_MS);

  // Fast lane news collector ogni 90 minuti, sfalsato rispetto allo startup.
  if (RUN_STARTUP_HEAVY_JOBS) {
    setTimeout(() => {
      void safeRunFastCollector();
      setInterval(() => { void safeRunFastCollector(); }, FAST_COLLECTOR_INTERVAL_MS);
    }, STARTUP_DELAY_MS + 45_000);
  } else {
    setInterval(() => { void safeRunFastCollector(); }, FAST_COLLECTOR_INTERVAL_MS);
  }

  // Enricher ogni 2 ore → poi publisher pubblica gli arricchiti
  setInterval(async () => {
    await safeRunEnricher();
    void safeRunNewsPublisher();
  }, ENRICHER_INTERVAL_MS);

  // Sector data agent settimanale (aggiorna skill, trend, salari)
  setInterval(() => { void safeRunSectorData(); }, SECTOR_DATA_INTERVAL_MS);

  // Weak signal detector settimanale (rileva professioni emergenti)
  // Delay di 5 min dopo startup per non sovraccaricare il DB all'avvio
  setTimeout(() => {
    void safeRunWeakSignalDetector();
    setInterval(() => { void safeRunWeakSignalDetector(); }, WEAK_SIGNAL_INTERVAL_MS);
  }, 5 * 60 * 1000);

  // Proactive insight generator giornaliero (genera insight per utenti attivi)
  // Delay di 10 min dopo startup
  setTimeout(() => {
    void safeRunProactiveInsightGenerator();
    setInterval(() => { void safeRunProactiveInsightGenerator(); }, PROACTIVE_INSIGHT_INTERVAL_MS);
  }, 10 * 60 * 1000);

  // Growth library agent giornaliero: cura contenuti growth e colma gap tematici.
  setTimeout(() => {
    void safeRunGrowthLibraryAgent();
    setInterval(() => { void safeRunGrowthLibraryAgent(); }, GROWTH_LIBRARY_INTERVAL_MS);
  }, 35 * 60 * 1000);

  // Job postings ingester giornaliero: popola aggregati anonimi per weak signals.
  setTimeout(() => {
    void safeRunJobPostingsAgent();
    setInterval(() => { void safeRunJobPostingsAgent(); }, JOB_POSTINGS_INTERVAL_MS);
  }, 40 * 60 * 1000);

  // Brain vault ingest giornaliero: indicizza solo `.brain/**/*.md` con runtime:true.
  setTimeout(() => {
    void safeRunVaultIngest();
    setInterval(() => { void safeRunVaultIngest(); }, VAULT_INGEST_INTERVAL_MS);
  }, 50 * 60 * 1000);

  // Routine utente: esegue job_monitor, market_report e altri handler dovuti.
  setTimeout(() => {
    void safeRunRoutineScheduler();
    setInterval(() => { void safeRunRoutineScheduler(); }, ROUTINE_SCHEDULER_INTERVAL_MS);
  }, 52 * 60 * 1000);

  setTimeout(() => {
    void safeRunAgentOperator();
    setInterval(() => { void safeRunAgentOperator(); }, AGENT_OPERATOR_INTERVAL_MS);
  }, 54 * 60 * 1000);

  // Wendy Neural decay giornaliero: indebolisce edge non rinforzati senza cancellare dati.
  setTimeout(() => {
    void safeRunWendyNeuralDecay();
    setInterval(() => { void safeRunWendyNeuralDecay(); }, WENDY_NEURAL_DECAY_INTERVAL_MS);
  }, 55 * 60 * 1000);

  // Briefing settimanale (lunedì mattina — Pro+)
  // Delay di 15 min per evitare sovrapposizione con altri job di startup
  setTimeout(() => {
    // Esegui solo se è lunedì (o se il job non è mai stato eseguito)
    const dayOfWeek = new Date().getDay();
    if (dayOfWeek === 1) {
      void runBriefingGenerator("weekly").catch((e) => rootLogger.error({ e }, "[cron] briefing weekly failed"));
    }
    setInterval(() => {
      if (new Date().getDay() === 1) {
        void runBriefingGenerator("weekly").catch((e) => rootLogger.error({ e }, "[cron] briefing weekly failed"));
      }
    }, BRIEFING_WEEKLY_INTERVAL_MS);
  }, 15 * 60 * 1000);

  // Model discovery settimanale (cerca modelli nuovi presso i provider)
  // Delay di 25 min per non gravare sullo startup
  setTimeout(() => {
    void safeRunModelDiscovery();
    setInterval(() => { void safeRunModelDiscovery(); }, MODEL_DISCOVERY_INTERVAL_MS);
  }, 25 * 60 * 1000);

  // Briefing giornaliero (ore 7:00 circa — Team)
  setTimeout(() => {
    const hour = new Date().getHours();
    if (hour >= 7 && hour < 8) {
      void runBriefingGenerator("daily").catch((e) => rootLogger.error({ e }, "[cron] briefing daily failed"));
    }
    setInterval(() => {
      if (new Date().getHours() >= 7 && new Date().getHours() < 8) {
        void runBriefingGenerator("daily").catch((e) => rootLogger.error({ e }, "[cron] briefing daily failed"));
      }
    }, BRIEFING_DAILY_INTERVAL_MS);
  }, 20 * 60 * 1000);
}
