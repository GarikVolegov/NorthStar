import { runCollector, runEnricher, runSectorDataAgent } from "@workspace/ai-server";
import { rootLogger } from "../middleware/logger";

const COLLECTOR_INTERVAL_MS = Number(process.env.COLLECTOR_INTERVAL_MS) || 6 * 60 * 60 * 1000; // 6 ore
const ENRICHER_INTERVAL_MS  = Number(process.env.ENRICHER_INTERVAL_MS)  || 2 * 60 * 60 * 1000; // 2 ore
const STARTUP_DELAY_MS      = Number(process.env.CRON_STARTUP_DELAY_MS) || 30_000;              // 30s

async function safeRunCollector(): Promise<void> {
  try {
    rootLogger.info("[cron] collector starting");
    const result = await runCollector();
    rootLogger.info({ totalCollected: result.totalCollected, totalInserted: result.totalInserted, bySource: result.bySource, durationMs: result.durationMs }, "[cron] collector complete");
  } catch (err) {
    rootLogger.error({ err }, "[cron] collector failed");
  }
}

async function safeRunEnricher(): Promise<void> {
  try {
    rootLogger.info("[cron] enricher starting");
    const result = await runEnricher();
    rootLogger.info({ processed: result.processed, enriched: result.enriched, filtered: result.filtered, durationMs: result.durationMs }, "[cron] enricher complete");
  } catch (err) {
    rootLogger.error({ err }, "[cron] enricher failed");
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

export function startCronJobs(): void {
  rootLogger.info({
    collectorIntervalH:   COLLECTOR_INTERVAL_MS   / 3_600_000,
    enricherIntervalH:    ENRICHER_INTERVAL_MS    / 3_600_000,
    sectorDataIntervalD:  SECTOR_DATA_INTERVAL_MS / 86_400_000,
  }, "[cron] starting scheduled jobs");

  // Run iniziale dopo startup delay (dà tempo al DB di inizializzarsi)
  setTimeout(() => {
    void safeRunCollector();
    void safeRunEnricher();
  }, STARTUP_DELAY_MS);

  // Collector ogni 6 ore
  setInterval(() => { void safeRunCollector(); }, COLLECTOR_INTERVAL_MS);

  // Enricher ogni 2 ore
  setInterval(() => { void safeRunEnricher(); }, ENRICHER_INTERVAL_MS);

  // Sector data agent settimanale (aggiorna skill, trend, salari)
  setInterval(() => { void safeRunSectorData(); }, SECTOR_DATA_INTERVAL_MS);
}
