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
      console.error("[reminder-dispatcher] error:", err);
    }
  }, POLL_INTERVAL_MS);

  // Run once immediately on startup
  dispatchDueReminders(wss, options).catch((err) =>
    console.error("[reminder-dispatcher] initial dispatch error:", err),
  );

  return () => clearInterval(interval);
}

async function dispatchDueReminders(
  wss: NorthStarWss,
  options: ReminderDispatcherOptions,
): Promise<void> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + POLL_INTERVAL_MS);

  // Find reminders that are enabled, not yet sent, and due within next poll window
  const dueReminders = await db
    .select({
      reminderId: eventRemindersTable.id,
      minutesBefore: eventRemindersTable.minutesBefore,
      eventId: calendarEventsTable.id,
      eventTitle: calendarEventsTable.title,
      startAt: calendarEventsTable.startAt,
      userId: calendarEventsTable.userId,
    })
    .from(eventRemindersTable)
    .innerJoin(
      calendarEventsTable,
      eq(eventRemindersTable.eventId, calendarEventsTable.id),
    )
    .where(
      and(
        eq(eventRemindersTable.enabled, true),
        isNull(eventRemindersTable.sentAt),
        // reminderFireAt = startAt - minutesBefore * interval '1 minute'
        lte(
          sql`${calendarEventsTable.startAt} - ${eventRemindersTable.minutesBefore} * interval '1 minute'`,
          windowEnd,
        ),
        gte(
          sql`${calendarEventsTable.startAt} - ${eventRemindersTable.minutesBefore} * interval '1 minute'`,
          now,
        ),
      ),
    );

  // Atomic claim: only the first instance gets the row (race-condition safe)
  const claimed = await db
    .update(eventRemindersTable)
    .set({ sentAt: now })
    .where(
      and(
        eq(eventRemindersTable.enabled, true),
        isNull(eventRemindersTable.sentAt),
        lte(
          sql`${calendarEventsTable.startAt} - ${eventRemindersTable.minutesBefore} * interval '1 minute'`,
          windowEnd,
        ),
        gte(
          sql`${calendarEventsTable.startAt} - ${eventRemindersTable.minutesBefore} * interval '1 minute'`,
          now,
        ),
      ),
    )
    .returning();

  for (const row of claimed) {
    // Fetch the corresponding calendar event
    const event = dueReminders.find((r) => r.reminderId === row.id);
    if (!event) continue;

    const { userId, eventId, eventTitle, startAt, minutesBefore } = event;

    if (wss.isOnline(userId)) {
      wss.emit(userId, {
        type: "calendar:reminder",
        payload: {
          eventId,
          eventTitle,
          startAt: startAt.toISOString(),
          minutesBefore,
        },
      });
    } else if (options.onFallbackPush) {
      await options.onFallbackPush({ userId, eventId, eventTitle, startAt, minutesBefore });
    }
  }
}
