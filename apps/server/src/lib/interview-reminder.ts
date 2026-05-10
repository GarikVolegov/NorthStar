import { db, jobApplicationsTable, usersTable } from "@workspace/db";
import { eq, and, lt, or, isNull, sql } from "drizzle-orm";
import { sendInterviewReminderEmail } from "./email.js";
import { logger } from "./logger.js";

const STALE_DAYS = 7;
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function runInterviewReminderCheck(): Promise<{ usersNotified: number; appsFlagged: number }> {
  logger.info("[interview-reminder] Starting stale interview check…");

  const threshold = sql`NOW() - INTERVAL '${sql.raw(String(STALE_DAYS))} days'`;

  // Find stale interviews: status=interview, updated >7 days ago,
  // and (reminder_sent_at is null OR reminder_sent_at is also >7 days ago)
  const staleApps = await db
    .select({
      id:             jobApplicationsTable.id,
      userId:         jobApplicationsTable.userId,
      company:        jobApplicationsTable.company,
      role:           jobApplicationsTable.role,
      updatedAt:      jobApplicationsTable.updatedAt,
      reminderSentAt: jobApplicationsTable.reminderSentAt,
      userName:       usersTable.name,
      userEmail:      usersTable.email,
    })
    .from(jobApplicationsTable)
    .innerJoin(usersTable, eq(jobApplicationsTable.userId, usersTable.id))
    .where(
      and(
        eq(jobApplicationsTable.status, "interview"),
        lt(jobApplicationsTable.updatedAt, sql`NOW() - INTERVAL '${sql.raw(String(STALE_DAYS))} days'`),
        or(
          isNull(jobApplicationsTable.reminderSentAt),
          lt(jobApplicationsTable.reminderSentAt, sql`NOW() - INTERVAL '${sql.raw(String(STALE_DAYS))} days'`),
        ),
      ),
    );

  if (staleApps.length === 0) {
    logger.info("[interview-reminder] No stale interviews found.");
    return { usersNotified: 0, appsFlagged: 0 };
  }

  // Group by user
  const byUser = new Map<number, typeof staleApps>();
  for (const app of staleApps) {
    if (!byUser.has(app.userId)) byUser.set(app.userId, []);
    byUser.get(app.userId)!.push(app);
  }

  let usersNotified = 0;
  const remindedIds: number[] = [];

  for (const [userId, apps] of byUser) {
    const { userEmail, userName } = apps[0];
    try {
      await sendInterviewReminderEmail(
        userEmail,
        userName,
        apps.map((a) => ({ id: a.id, company: a.company, role: a.role, updatedAt: a.updatedAt })),
      );
      usersNotified++;
      remindedIds.push(...apps.map((a) => a.id));
      logger.info(`[interview-reminder] Email inviata a userId=${userId} per ${apps.length} app(s)`);
    } catch (err) {
      logger.error({ err }, `[interview-reminder] Errore email per userId=${userId}`);
    }
  }

  // Stamp reminder_sent_at on all reminded applications
  if (remindedIds.length > 0) {
    for (const id of remindedIds) {
      await db
        .update(jobApplicationsTable)
        .set({ reminderSentAt: new Date() })
        .where(eq(jobApplicationsTable.id, id));
    }
  }

  logger.info(`[interview-reminder] Done: ${usersNotified} users notified, ${remindedIds.length} apps flagged.`);
  return { usersNotified, appsFlagged: remindedIds.length };
}

export function startInterviewReminderScheduler(): void {
  // First run after 60 seconds (let server warm up), then every 24 hours
  const firstRun = setTimeout(() => {
    runInterviewReminderCheck().catch((err) =>
      logger.error({ err }, "[interview-reminder] Scheduled check failed"),
    );
  }, 60_000);

  const interval = setInterval(() => {
    runInterviewReminderCheck().catch((err) =>
      logger.error({ err }, "[interview-reminder] Scheduled check failed"),
    );
  }, CHECK_INTERVAL_MS);

  // Allow process to exit without waiting for timers
  firstRun.unref();
  interval.unref();

  logger.info(`[interview-reminder] Scheduler avviato — prima esecuzione tra 60s, poi ogni 24h`);
}
