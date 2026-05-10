import { logger } from "./logger.js";
import { db, usersTable, testSessionsTable, userObjectivesTable, sectorsTable, newsArticlesTable } from "@workspace/db";
import { eq, and, isNotNull, lte, gt } from "drizzle-orm";
import { sendEmail } from "./email.js";

const DIGEST_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const TICK_INTERVAL_MS = 60 * 60 * 1000;

let lastDigestRun = 0;

function isMonday8amRome(): boolean {
  const now = new Date();
  const rome = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "short",
    hour: "numeric",
  }).formatToParts(now);
  const weekday = rome.find((p) => p.type === "weekday")?.value;
  const hour = parseInt(rome.find((p) => p.type === "hour")?.value ?? "0");
  return weekday === "lun" && hour === 8;
}

async function sendWeeklyDigest(): Promise<void> {
  logger.info("[weekly-digest] Starting...");

  const users = await db
    .select()
    .from(usersTable)
    .where(and(isNotNull(usersTable.testSessionId), eq(usersTable.emailVerified, true)))
    .limit(500);

  let sent = 0;

  for (const user of users) {
    try {
      if (!user.testSessionId) continue;
      const [session] = await db.select().from(testSessionsTable).where(eq(testSessionsTable.id, user.testSessionId));
      if (!session) continue;

      let sectorName = "";
      let sectorNews: string[] = [];
      if (session.confirmedSectorId) {
        const [sector] = await db.select().from(sectorsTable).where(eq(sectorsTable.id, session.confirmedSectorId));
        sectorName = sector?.name ?? "";

        const news = await db
          .select({ title: newsArticlesTable.title, url: newsArticlesTable.url })
          .from(newsArticlesTable)
          .limit(3);
        sectorNews = news.map((n) => `<li><a href="${n.url}" style="color:#4f46e5">${n.title}</a></li>`);
      }

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const dueSoon = await db
        .select()
        .from(userObjectivesTable)
        .where(
          and(
            eq(userObjectivesTable.userId, user.id),
            eq(userObjectivesTable.completed, false),
            lte(userObjectivesTable.dueDate, nextWeek.toISOString().split("T")[0]),
            gt(userObjectivesTable.dueDate, new Date().toISOString().split("T")[0])
          )
        )
        .limit(3);

      const html = buildDigestEmail({
        name: user.name,
        sectorName,
        riasecTypes: (session.primaryTypes as string[]) ?? [],
        sectorNews,
        dueSoon: dueSoon.map((o) => ({ text: o.text, dueDate: o.dueDate, progress: o.progress })),
      });

      await sendEmail(user.email, `☀️ Il tuo digest settimanale NorthStar`, html);
      sent++;

      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (err) {
      logger.error({ err, userId: user.id }, "[weekly-digest] Failed to send digest to user");
    }
  }

  logger.info({ sent, total: users.length }, "[weekly-digest] Completed");
}

function buildDigestEmail(data: {
  name: string;
  sectorName: string;
  riasecTypes: string[];
  sectorNews: string[];
  dueSoon: Array<{ text: string; dueDate: string | null; progress: number }>;
}): string {
  const newsSection = data.sectorNews.length > 0
    ? `<h3 style="color:#1e293b;margin:24px 0 8px">📰 Notizie dal tuo settore${data.sectorName ? ` — ${data.sectorName}` : ""}</h3>
       <ul style="margin:0;padding:0 0 0 20px;color:#374151;font-size:14px;line-height:1.8">${data.sectorNews.join("")}</ul>`
    : "";

  const dueSection = data.dueSoon.length > 0
    ? `<h3 style="color:#1e293b;margin:24px 0 8px">⏰ Obiettivi in scadenza questa settimana</h3>
       <ul style="margin:0;padding:0 0 0 20px;color:#374151;font-size:14px;line-height:1.8">
         ${data.dueSoon.map((o) => `<li><strong>${o.text}</strong> — ${o.progress}% completato${o.dueDate ? ` · Scadenza: ${new Date(o.dueDate).toLocaleDateString("it-IT")}` : ""}</li>`).join("")}
       </ul>
       <a href="https://northstar.replit.app/profilo" style="display:inline-block;margin-top:12px;background:#4f46e5;color:#fff;padding:8px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">Vai ai tuoi obiettivi →</a>`
    : "";

  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:linear-gradient(135deg,#1e293b,#312e81);padding:28px;">
      <p style="margin:0;color:#a5b4fc;font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:700">NorthStar</p>
      <h1 style="margin:8px 0 0;color:#f8fafc;font-size:20px;font-weight:700">Buongiorno, ${data.name}! ☀️</h1>
      <p style="margin:6px 0 0;color:#94a3b8;font-size:13px">Il tuo digest di carriera settimanale</p>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6">
        Ecco cosa c'è di nuovo questa settimana per il tuo percorso professionale.
      </p>
      ${newsSection}
      ${dueSection}
      ${!data.sectorName ? `<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:16px;margin-top:20px;">
        <p style="margin:0;color:#0369a1;font-size:14px;">💡 <strong>Non hai ancora scelto il tuo settore.</strong> Completa il test per ricevere consigli personalizzati!</p>
        <a href="https://northstar.replit.app/test" style="display:inline-block;margin-top:12px;background:#0284c7;color:#fff;padding:8px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">Fai il test →</a>
      </div>` : ""}
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0;">
        <a href="https://northstar.replit.app/dashboard" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 24px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600;margin-right:12px">Vai alla Dashboard</a>
        <a href="https://northstar.replit.app/coach" style="display:inline-block;background:#f1f5f9;color:#374151;padding:10px 24px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600">Parla col Coach AI</a>
      </div>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 28px;">
      <p style="margin:0;color:#94a3b8;font-size:11px;">© NorthStar · La tua bussola professionale</p>
    </div>
  </div>
</body>
</html>`;
}

async function tick(): Promise<void> {
  const now = Date.now();
  if (now - lastDigestRun < DIGEST_INTERVAL_MS) return;
  if (!isMonday8amRome()) return;

  lastDigestRun = now;
  await sendWeeklyDigest();
}

export function startWeeklyDigestScheduler(): void {
  if (!process.env.RESEND_API_KEY) {
    logger.warn("[weekly-digest] RESEND_API_KEY non configurato — scheduler disabilitato");
    return;
  }

  logger.info("[weekly-digest] Scheduler avviato");

  setInterval(() => {
    tick().catch((err) => logger.error({ err }, "[weekly-digest] Tick failed"));
  }, TICK_INTERVAL_MS);
}
