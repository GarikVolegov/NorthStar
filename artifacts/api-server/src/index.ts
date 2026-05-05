// Catch uncaught exceptions BEFORE any import that might throw,
// so Vercel returns a JSON 500 with the error message instead of a silent crash.
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

import app from "./app";
import { logger } from "./lib/logger";
import { seedSectors, patchDipendentiSteps, patchWorkModeFields, seedProfessions, seedEducationPaths, ensureCoachSessionsTable, ensurePromptsTable } from "./lib/seed";
import { startInterviewReminderScheduler } from "./lib/interview-reminder.js";
import { startWeeklyDigestScheduler } from "./lib/weekly-digest.js";
import { startCalendarReminderScheduler } from "./lib/calendar-scheduler.js";
import { startResearchScheduler } from "./lib/research-scheduler.js";

// Export at top-level for Vercel serverless (export default cannot be inside an if block)
export default app;

// Local server startup — skipped on Vercel
if (!process.env.VERCEL) {
  const rawPort = process.env["PORT"];

  if (!rawPort) {
    throw new Error("PORT environment variable is required but was not provided.");
  }

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  app.listen(port, async (err?: Error) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");

    try {
      await seedSectors();
      await patchWorkModeFields();
      await patchDipendentiSteps();
      await seedProfessions();
      await seedEducationPaths();
      await ensureCoachSessionsTable();
      await ensurePromptsTable();
      logger.info("Sectors, professions and education paths seeded successfully");
    } catch (seedErr) {
      logger.error({ err: seedErr }, "Failed to seed sectors");
    }

    startInterviewReminderScheduler();
    startCalendarReminderScheduler();
    startResearchScheduler();
    startWeeklyDigestScheduler();
  });
}
