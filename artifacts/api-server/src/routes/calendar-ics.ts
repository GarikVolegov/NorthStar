import { Router } from "express";
import { db } from "@workspace/db";
import { calendarEventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../lib/auth-jwt.js";

const router = Router();

function toICSDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeICS(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

router.get("/calendar/export.ics", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;

  const events = await db
    .select()
    .from(calendarEventsTable)
    .where(eq(calendarEventsTable.userId, userId));

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NorthStar//NorthStar Calendar//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:NorthStar — Il mio percorso",
    "X-WR-TIMEZONE:Europe/Rome",
  ];

  for (const ev of events) {
    const start = new Date(ev.startAt);
    const end = new Date(ev.endAt);
    const uid = `northstar-${ev.id}@northstar.app`;
    const now = toICSDate(new Date());

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${now}`);

    if (ev.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${start.toISOString().slice(0, 10).replace(/-/g, "")}`);
      lines.push(`DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, "")}`);
    } else {
      lines.push(`DTSTART:${toICSDate(start)}`);
      lines.push(`DTEND:${toICSDate(end)}`);
    }

    lines.push(`SUMMARY:${escapeICS(ev.title)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeICS(ev.description)}`);

    const catLabel: Record<string, string> = {
      study: "EDUCATION", training: "EDUCATION", interview: "BUSINESS",
      deadline: "DEADLINE", task: "WORK", "follow-up": "WORK",
    };
    lines.push(`CATEGORIES:${catLabel[ev.category] ?? "WORK"}`);

    const priority: Record<string, number> = { high: 1, medium: 5, low: 9 };
    lines.push(`PRIORITY:${priority[ev.priority] ?? 5}`);
    lines.push(`STATUS:${ev.status === "done" ? "COMPLETED" : "CONFIRMED"}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const icsContent = lines.join("\r\n");
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="northstar-calendario.ics"');
  res.send(icsContent);
});

export default router;
