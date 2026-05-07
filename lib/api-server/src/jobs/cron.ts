/**
 * Cron job scheduler.
 *
 * Imported ONCE in app.ts as a side-effect:
 *   import "./jobs/cron";
 *
 * Schedules:
 *   - Weekly digest:              every Monday at 08:00 Europe/Rome
 *   - Supervisor pattern analysis: every Monday at 09:00 Europe/Rome
 *
 * Uses node-cron. Add to package.json if not present:
 *   pnpm add node-cron
 *   pnpm add -D @types/node-cron
 *
 * SUPERVISOR JOB (Phase 6 — self-improvement)
 * ───────────────────────────────────────────
 * Reads the last 7 days of supervisor_logs (rewrites), sends the batch
 * to GPT-4o-mini, and proposes new PLATITUDE_PATTERNS + ACTION_PATTERNS.
 * The proposal is logged to console and optionally posted to Slack
 * (set SLACK_SUPERVISOR_WEBHOOK in env). It does NOT auto-apply changes —
 * a human reviews and merges the suggested patterns.
 *
 * The job is skipped gracefully if DATABASE_URL is not set.
 */
import cron from "node-cron";
import { runWeeklyDigestForAllUsers } from "./weekly-digest";
import { runPatternAnalysis } from "../../../integrations-openai-ai-server/src/growth-agent/supervisor-pattern-analyzer";

// ── Weekly Digest: every Monday at 08:00 (Europe/Rome) ─────────────────────
cron.schedule(
  "0 8 * * 1",
  async () => {
    console.log("[cron] weekly digest starting...");
    try {
      await runWeeklyDigestForAllUsers();
      console.log("[cron] weekly digest complete");
    } catch (err) {
      console.error("[cron] weekly digest error:", err);
    }
  },
  { timezone: "Europe/Rome" },
);

// ── Supervisor Pattern Analysis: every Monday at 09:00 (Europe/Rome) ────────
// Runs 1 hour after the digest to avoid concurrent DB + OpenAI pressure.
cron.schedule(
  "0 9 * * 1",
  async () => {
    console.log("[cron] supervisor pattern analysis starting...");
    try {
      const proposal = await runPatternAnalysis();
      if (proposal) {
        console.log(
          `[cron] supervisor analysis complete — ${proposal.totalRewrites} rewrites analyzed,` +
          ` ${proposal.newPlatitudePatterns.length} new platitude patterns,` +
          ` ${proposal.newActionPatterns.length} new action patterns proposed`,
        );
      } else {
        console.log("[cron] supervisor analysis: no rewrite logs found in last 7 days, skipped");
      }
    } catch (err) {
      console.error("[cron] supervisor pattern analysis error:", err);
    }
  },
  { timezone: "Europe/Rome" },
);

console.log(
  "[cron] scheduler registered:\n" +
  "  • weekly digest            — every Monday 08:00 Europe/Rome\n" +
  "  • supervisor pattern job   — every Monday 09:00 Europe/Rome",
);
