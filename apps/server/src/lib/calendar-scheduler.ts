import {
  db, calendarEventsTable, eventRemindersTable,
  notificationsLogTable, pushSubscriptionsTable, usersTable,
} from "@workspace/db";
import { eq, and, lte, isNull, inArray, sql } from "drizzle-orm";
import { sendEmail } from "./email-helper.js";
import { logger } from "./logger.js";

const CHECK_INTERVAL_MS = 60_000;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatInTimezone(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("it-IT", {
      timeZone: timezone,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("it-IT", {
      timeZone: "Europe/Rome",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }
}

async function sendPushNotification(
  endpoint: string,
  p256dh: string,
  auth: string,
  title: string,
  body: string,
): Promise<void> {
  const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
  const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
  const VAPID_EMAIL = process.env.VAPID_EMAIL ?? "mailto:info@northstar.app";

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;

  try {
    const webpush = await import("web-push").catch(() => null);
    if (!webpush) { logger.warn("[calendar-scheduler] web-push module not available"); return; }
    webpush.default.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
    await webpush.default.sendNotification(
      { endpoint, keys: { p256dh, auth } },
      JSON.stringify({ title, body }),
    );
  } catch (err) {
    logger.warn({ err }, "[calendar-scheduler] Push notification failed");
  }
}

export async function runCalendarReminderCheck(): Promise<void> {
  logger.info("[calendar-scheduler] Checking due reminders…");
  const now = new Date();

  const dueIds = db
    .select({ id: eventRemindersTable.id })
    .from(eventRemindersTable)
    .innerJoin(calendarEventsTable, eq(eventRemindersTable.eventId, calendarEventsTable.id))
    .where(
      and(
        eq(eventRemindersTable.enabled, true),
        isNull(eventRemindersTable.sentAt),
        lte(
          sql`${calendarEventsTable.startAt} - (${eventRemindersTable.minutesBefore} * INTERVAL '1 minute')`,
          sql`NOW()`,
        ),
      ),
    );

  const claimedReminders = await db
    .update(eventRemindersTable)
    .set({ sentAt: now })
    .where(
      and(
        isNull(eventRemindersTable.sentAt),
        inArray(eventRemindersTable.id, dueIds),
      ),
    )
    .returning({ reminderId: eventRemindersTable.id, eventId: eventRemindersTable.eventId });

  if (claimedReminders.length === 0) {
    logger.info("[calendar-scheduler] No due reminders.");
    return;
  }

  const claimedIds = claimedReminders.map((r) => r.reminderId);
  logger.info(`[calendar-scheduler] Claimed ${claimedIds.length} reminder(s).`);

  const dueReminders = await db
    .select({
      reminderId: eventRemindersTable.id,
      minutesBefore: eventRemindersTable.minutesBefore,
      eventId: calendarEventsTable.id,
      eventTitle: calendarEventsTable.title,
      eventStart: calendarEventsTable.startAt,
      eventPriority: calendarEventsTable.priority,
      userId: calendarEventsTable.userId,
      userEmail: usersTable.email,
      userName: usersTable.name,
      userTimezone: usersTable.timezone,
    })
    .from(eventRemindersTable)
    .innerJoin(calendarEventsTable, eq(eventRemindersTable.eventId, calendarEventsTable.id))
    .innerJoin(usersTable, eq(calendarEventsTable.userId, usersTable.id))
    .where(inArray(eventRemindersTable.id, claimedIds));

  for (const reminder of dueReminders) {
    const minutesText =
      reminder.minutesBefore >= 60
        ? `${reminder.minutesBefore / 60}h`
        : `${reminder.minutesBefore} min`;

    const notifTitle = `Promemoria: ${reminder.eventTitle}`;
    const notifBody = `Inizia tra ${minutesText}`;

    await db.insert(notificationsLogTable).values({
      userId: reminder.userId,
      eventId: reminder.eventId,
      channel: "inapp",
      title: notifTitle,
      body: notifBody,
      sentAt: now,
    });

    if (reminder.eventPriority === "high") {
      const timezone = reminder.userTimezone ?? "Europe/Rome";
      const localTime = formatInTimezone(new Date(reminder.eventStart), timezone);
      try {
        await sendEmail(
          reminder.userEmail,
          `Promemoria: ${reminder.eventTitle}`,
          buildReminderEmailHtml(reminder.userName, reminder.eventTitle, notifBody, localTime),
        );
        await db.insert(notificationsLogTable).values({
          userId: reminder.userId,
          eventId: reminder.eventId,
          channel: "email",
          title: notifTitle,
          body: notifBody,
          sentAt: now,
        });
      } catch (err) {
        logger.error({ err }, "[calendar-scheduler] Email reminder failed");
      }
    }

    const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
    const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
    if (VAPID_PUBLIC && VAPID_PRIVATE) {
      const subscriptions = await db
        .select()
        .from(pushSubscriptionsTable)
        .where(eq(pushSubscriptionsTable.userId, reminder.userId));

      for (const sub of subscriptions) {
        const pushOk = await sendPushNotification(sub.endpoint, sub.p256dh, sub.auth, notifTitle, notifBody)
          .then(() => true)
          .catch(() => false);
        if (pushOk) {
          await db.insert(notificationsLogTable).values({
            userId: reminder.userId,
            eventId: reminder.eventId,
            channel: "push",
            title: notifTitle,
            body: notifBody,
            sentAt: now,
          });
        }
      }
    }
  }

  logger.info(`[calendar-scheduler] Processed ${dueReminders.length} reminder(s).`);
}

function buildReminderEmailHtml(
  name: string,
  title: string,
  body: string,
  localTime: string,
): string {
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body);
  const safeTime = escapeHtml(localTime);

  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#1a3a2a;padding:24px 28px;">
      <p style="margin:0;color:#86efac;font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;">NorthStar</p>
      <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">Promemoria Evento</h1>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 8px;color:#374151;font-size:16px;">Ciao <strong>${safeName}</strong>,</p>
      <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6;">Hai un evento ad alta priorità in arrivo:</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 6px;color:#1a3a2a;font-size:18px;font-weight:700;">${safeTitle}</p>
        <p style="margin:0 0 4px;color:#15803d;font-size:14px;">${safeBody}</p>
        <p style="margin:0;color:#6b7280;font-size:13px;">Inizio: ${safeTime}</p>
      </div>
      <p style="margin:0;color:#9ca3af;font-size:12px;">Apri NorthStar per vedere i dettagli dell'evento.</p>
    </div>
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:14px 28px;">
      <p style="margin:0;color:#9ca3af;font-size:11px;">© NorthStar · La tua bussola professionale</p>
    </div>
  </div>
</body>
</html>`;
}

export function startCalendarReminderScheduler(): void {
  const firstRun = setTimeout(() => {
    runCalendarReminderCheck().catch((err) =>
      logger.error({ err }, "[calendar-scheduler] Check failed"),
    );
  }, 30_000);

  const interval = setInterval(() => {
    runCalendarReminderCheck().catch((err) =>
      logger.error({ err }, "[calendar-scheduler] Check failed"),
    );
  }, CHECK_INTERVAL_MS);

  firstRun.unref();
  interval.unref();

  logger.info("[calendar-scheduler] Scheduler avviato — ogni 60s");
}
