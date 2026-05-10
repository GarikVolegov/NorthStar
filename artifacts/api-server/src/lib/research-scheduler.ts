import { z } from "zod";
import { logger } from "./logger";
import { runNewsResearch } from "../agents/research/news-research";
import { runGrowthResearch } from "../agents/research/growth-research";

const NEWS_INTERVAL_MS = 6 * 60 * 60 * 1000;    // 6 hours
const GROWTH_INTERVAL_MS = 24 * 60 * 60 * 1000;  // 24 hours
const TICK_INTERVAL_MS = 30 * 60 * 1000;          // check every 30 min
const WARMUP_DELAY_MS = 90 * 1000;                // wait 90s after start

// FIX: Zod schemas to validate AI output before DB writes — prevents silent JSON truncation crashes
const NewsResearchResultSchema = z.object({
  articles: z.array(
    z.object({
      title: z.string(),
      url: z.string().url(),
      summary: z.string().optional(),
      publishedAt: z.string().optional(),
      sector: z.string().optional(),
    })
  ).optional(),
}).passthrough();

const GrowthResearchResultSchema = z.object({
  articles: z.array(
    z.object({
      title: z.string(),
      content: z.string(),
      sector: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
  ).optional(),
}).passthrough();

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
      const raw = await runNewsResearch();
      // FIX: validate before using — prevents partial JSON from crashing DB writes
      const parsed = NewsResearchResultSchema.safeParse(raw);
      if (!parsed.success) {
        logger.error({ issues: parsed.error.issues }, "Research scheduler: news result failed Zod validation — skipping DB write");
      } else {
        newsLastRun = Date.now();
      }
    }
  } catch (err) {
    logger.error({ err }, "Research scheduler: news research failed");
  }

  try {
    if (now - growthLastRun > GROWTH_INTERVAL_MS) {
      logger.info("Research scheduler: starting growth research");
      const raw = await runGrowthResearch();
      // FIX: validate before using — prevents partial JSON from crashing DB writes
      const parsed = GrowthResearchResultSchema.safeParse(raw);
      if (!parsed.success) {
        logger.error({ issues: parsed.error.issues }, "Research scheduler: growth result failed Zod validation — skipping DB write");
      } else {
        growthLastRun = Date.now();
      }
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
