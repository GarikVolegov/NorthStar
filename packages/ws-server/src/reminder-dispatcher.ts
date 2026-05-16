/**
 * Reminder dispatcher — polls the DB for calendar reminders that are due
 * and dispatches them in real-time via WebSocket (if the user is online)
 * or delegates to push notifications (if offline).
 *
 * Usage: call startReminderDispatcher(wss) once at server boot.
 * It returns a cleanup function to stop the interval on shutdown.
 *
 *   const stop = startReminderDispatcher(wss, { db, sendPushFn });
 *   process.on("SIGTERM", stop);
 */

import { logger } from "./logger";
import { db } from "@workspace/db";
import {
  eventRemindersTable,
  calendarEventsTable,
} from "@workspace/db";
import { isNull, sql } from "drizzle-orm";
import type { NorthStarWss } from "./index";

const POLL_INTERVAL_MS = 60_000; // check every 60 seconds

export interface ReminderDispatcherOptions {
  /**
   * Called when user is NOT online (no active WS connection).
   * Implement this with your existing VAPID push logic.
   */
  onFallbackPush?: (params: {
    userId: number;
    eventId: number;
    eventTitle: string;
    startAt: Date;
    minutesBefore: number;
  }) => Promise<void>;
}

export function startReminderDispatcher(
  wss: NorthStarWss,
  options: ReminderDispatcherOptions = {},
): () => void {
  const interval = setInterval(async () => {
    try {
      await dispatchDueReminders(wss, options);
    } catch (err) {
      logger.error({ err }, "[reminder-dispatcher] error");
    }
  }, POLL_INTERVAL_MS);

  // Run once immediately on startup
  dispatchDueReminders(wss, options).catch((err) =>
    logger.error({ err }, "[reminder-dispatcher] initial dispatch error"),
  );

  return () => clearInterval(interval);
}

async function dispatchDueReminders(
  wss: NorthStarWss,
  options: ReminderDispatcherOptions,
): Promise<void> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + POLL_INTERVAL_MS);

  // Atomic CTE: mark reminders as sent AND return them in a single statement.
  // This eliminates the race condition between SELECT and UPDATE.
  const result = await db.execute(
    sql`
      WITH due AS (
        SELECT r.id          AS reminder_id,
               e.id          AS event_id,
               e.title       AS event_title,
               e.start_at    AS start_at,
               e.user_id     AS user_id,
               r.minutes_before
        FROM ${eventRemindersTable} r
        INNER JOIN ${calendarEventsTable} e ON e.id = r.event_id
        WHERE r.enabled = true
          AND r.sent_at IS NULL
          AND e.start_at - r.minutes_before * interval '1 minute' <= ${windowEnd}
          AND e.start_at - r.minutes_before * interval '1 minute' >= ${now}
        FOR UPDATE OF r SKIP LOCKED
      )
      UPDATE ${eventRemindersTable} r
      SET sent_at = ${now}
      FROM due
      WHERE r.id = due.reminder_id
      RETURNING due.reminder_id,
                due.event_id,
                due.event_title,
                due.start_at,
                due.user_id,
                due.minutes_before
    `,
  );

  const rows = result.rows as Array<{
    reminder_id: number;
    event_id: number;
    event_title: string;
    start_at: Date;
    user_id: number;
    minutes_before: number;
  }>;

  for (const row of rows) {
    if (wss.isOnline(row.user_id)) {
      wss.emit(row.user_id, {
        type: "calendar:reminder",
        payload: {
          eventId: row.event_id,
          eventTitle: row.event_title,
          startAt: new Date(row.start_at).toISOString(),
          minutesBefore: row.minutes_before,
        },
      });
    } else if (options.onFallbackPush) {
      await options.onFallbackPush({
        userId: row.user_id,
        eventId: row.event_id,
        eventTitle: row.event_title,
        startAt: new Date(row.start_at),
        minutesBefore: row.minutes_before,
      });
    }
  }
}
