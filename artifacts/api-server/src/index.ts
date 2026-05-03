import app from "./app";
import { logger } from "./lib/logger";
import { seedSectors, patchDipendentiSteps, patchWorkModeFields, seedProfessions, seedEducationPaths } from "./lib/seed";
import { startInterviewReminderScheduler } from "./lib/interview-reminder.js";
import { startCalendarReminderScheduler } from "./lib/calendar-scheduler.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async (err) => {
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
    logger.info("Sectors, professions and education paths seeded successfully");
  } catch (seedErr) {
    logger.error({ err: seedErr }, "Failed to seed sectors");
  }

  startInterviewReminderScheduler();
  startCalendarReminderScheduler();
});
