import { logger } from "./logger";
import { runNewsResearch } from "../agents/research/news-research";
import { runGrowthResearch } from "../agents/research/growth-research";

const NEWS_INTERVAL_MS = 6 * 60 * 60 * 1000;    // 6 hours
const GROWTH_INTERVAL_MS = 24 * 60 * 60 * 1000;  // 24 hours
const TICK_INTERVAL_MS = 30 * 60 * 1000;          // check every 30 min
const WARMUP_DELAY_MS = 90 * 1000;                // wait 90s after start

let newsLastRun = 0;
let growthLastRun = 0;
let running = false;

async function tick(): Promise<void> {
  if (running) return;
  running = true;

  const now = Date.now();

  try {
    if (now - newsLastRun > NEWS_INTERVAL_MS) {
      logger.info("Research scheduler: starting news research");
      await runNewsResearch();
      newsLastRun = Date.now();
    }
  } catch (err) {
    logger.error({ err }, "Research scheduler: news research failed");
  }

  try {
    if (now - growthLastRun > GROWTH_INTERVAL_MS) {
      logger.info("Research scheduler: starting growth research");
      await runGrowthResearch();
      growthLastRun = Date.now();
    }
  } catch (err) {
    logger.error({ err }, "Research scheduler: growth research failed");
  }

  running = false;
}

export function startResearchScheduler(): void {
  if (!process.env.TAVILY_API_KEY) {
    logger.warn("TAVILY_API_KEY not configured — research scheduler is disabled");
    return;
  }

  logger.info({ newsIntervalH: 6, growthIntervalH: 24 }, "Research scheduler starting");

  setTimeout(() => {
    tick().catch((err) => logger.error({ err }, "Initial research tick failed"));
    setInterval(() => {
      tick().catch((err) => logger.error({ err }, "Research tick failed"));
    }, TICK_INTERVAL_MS);
  }, WARMUP_DELAY_MS);
}
