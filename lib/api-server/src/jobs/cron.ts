/**
 * Cron job scheduler.
 *
 * Imported ONCE in app.ts as a side-effect:
 *   import "./jobs/cron";
 *
 * Schedules:
 *   - Weekly digest: every Monday at 08:00 Europe/Rome
 *
 * Uses node-cron. Add to package.json if not present:
 *   pnpm add node-cron
 *   pnpm add -D @types/node-cron
 */
import cron from "node-cron";
import { runWeeklyDigestForAllUsers } from "./weekly-digest";

// ── Weekly Digest: every Monday at 08:00 (Europe/Rome) ───────────────────────
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

console.log("[cron] scheduler registered: weekly digest every Monday 08:00 Europe/Rome");
