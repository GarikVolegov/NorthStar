import { runCollector, runEnricher, runSectorDataAgent, runNewsPublisher } from "@workspace/ai-server";
import { rootLogger } from "../middleware/logger";
import { runWeakSignalDetector } from "./weak-signal-detector";
import { runProactiveInsightGenerator } from "./proactive-insight-generator";
import { runBriefingGenerator } from "./briefing-generator";

const COLLECTOR_INTERVAL_MS        = Number(process.env.COLLECTOR_INTERVAL_MS) || 6 * 60 * 60 * 1000;       // 6 ore
const ENRICHER_INTERVAL_MS         = Number(process.env.ENRICHER_INTERVAL_MS)  || 2 * 60 * 60 * 1000;       // 2 ore
const STARTUP_DELAY_MS             = Number(process.env.CRON_STARTUP_DELAY_MS) || 30_000;                    // 30s
const WEAK_SIGNAL_INTERVAL_MS       = Number(process.env.WEAK_SIGNAL_INTERVAL_MS)       || 7 * 24 * 60 * 60 * 1000; // 7 giorni
const PROACTIVE_INSIGHT_INTERVAL_MS = Number(process.env.PROACTIVE_INSIGHT_INTERVAL_MS) || 24 * 60 * 60 * 1000; // 24 ore
const BRIEFING_WEEKLY_INTERVAL_MS   = Number(process.env.BRIEFING_WEEKLY_INTERVAL_MS)   || 7 * 24 * 60 * 60 * 1000; // 7 giorni (lunedì)
const BRIEFING_DAILY_INTERVAL_MS    = Number(process.env.BRIEFING_DAILY_INTERVAL_MS)    || 24 * 60 * 60 * 1000; // 24 ore

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

async function safeRunNewsPublisher(): Promise<void> {
  try {
    rootLogger.info("[cron] news-publisher starting");
    const result = await runNewsPublisher();
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

export function startCronJobs(): void {
  rootLogger.info({
    collectorIntervalH:        COLLECTOR_INTERVAL_MS        / 3_600_000,
    enricherIntervalH:         ENRICHER_INTERVAL_MS         / 3_600_000,
    sectorDataIntervalD:       SECTOR_DATA_INTERVAL_MS      / 86_400_000,
    weakSignalIntervalD:       WEAK_SIGNAL_INTERVAL_MS      / 86_400_000,
    proactiveInsightIntervalH: PROACTIVE_INSIGHT_INTERVAL_MS / 3_600_000,
    briefingWeeklyIntervalD:   BRIEFING_WEEKLY_INTERVAL_MS  / 86_400_000,
    briefingDailyIntervalH:    BRIEFING_DAILY_INTERVAL_MS   / 3_600_000,
  }, "[cron] starting scheduled jobs");

  // Run iniziale dopo startup delay (dà tempo al DB di inizializzarsi)
  setTimeout(() => {
    void safeRunCollector();
    void safeRunEnricher();
    void safeRunNewsPublisher();
  }, STARTUP_DELAY_MS);

  // Collector ogni 6 ore
  setInterval(() => { void safeRunCollector(); }, COLLECTOR_INTERVAL_MS);

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
