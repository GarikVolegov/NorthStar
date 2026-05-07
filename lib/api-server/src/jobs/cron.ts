/**
 * Cron jobs — all scheduled background tasks for the API server.
 *
 * SCHEDULE OVERVIEW:
 *
 *   Every 6 hours  — runCollector()   → collect news/opp/formation from all sources
 *   Every 30 min   — runEnricher()    → enrich unenriched discovery items with GPT-4o-mini
 *   Every Sunday   — analyzeSupervisorPatterns() → Phase 6 self-improvement
 *
 * WHY NODE-CRON:
 *   Lightweight, no external dependencies. Works on single-process deployments
 *   (Replit, Railway, Render). For multi-instance, migrate to BullMQ or pg-boss.
 *
 * NOTE: This file is imported as a SIDE EFFECT in app.ts:
 *   import "./jobs/cron";
 *   All schedules register on first import.
 */
import cron from "node-cron";
import { runCollector }  from "@workspace/integrations-openai-ai-server/discovery-agent/collector-agent";
import { runEnricher }   from "@workspace/integrations-openai-ai-server/discovery-agent/enricher-agent";
import { analyzeSupervisorPatterns } from "@workspace/integrations-openai-ai-server/growth-agent/supervisor-pattern-analyzer";

// ── Discovery: collect every 6 hours (at 00, 06, 12, 18) ────────────────────
cron.schedule("0 */6 * * *", async () => {
  console.log("[cron] discovery collector started");
  try {
    const result = await runCollector();
    console.log("[cron] discovery collector done:", result);
  } catch (err) {
    console.error("[cron] discovery collector failed:", err);
  }
});

// ── Discovery: enrich every 30 minutes ──────────────────────────────────────
cron.schedule("*/30 * * * *", async () => {
  console.log("[cron] discovery enricher started");
  try {
    const result = await runEnricher(20);
    console.log("[cron] discovery enricher done:", result);
  } catch (err) {
    console.error("[cron] discovery enricher failed:", err);
  }
});

// ── Phase 6: supervisor pattern analysis — every Sunday at 02:00 ────────────
cron.schedule("0 2 * * 0", async () => {
  console.log("[cron] supervisor pattern analysis started");
  try {
    await analyzeSupervisorPatterns();
    console.log("[cron] supervisor pattern analysis done");
  } catch (err) {
    console.error("[cron] supervisor pattern analysis failed:", err);
  }
});

console.log("[cron] all schedules registered: collector(6h), enricher(30m), supervisor(Sun 02:00)");
