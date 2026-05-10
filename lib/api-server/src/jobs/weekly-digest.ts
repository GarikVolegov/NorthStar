/**
 * Weekly Digest Job
 *
 * WHAT IT DOES (per user):
 *   1. Load user memory (facts + top patterns)
 *   2. Query analytics for the last 7 days
 *   3. Generate a personalised digest paragraph via GPT-4o-mini
 *   4. Send HTML email via Resend
 *   5. Insert in-app notification in coach_notifications
 *
 * ENTRY POINTS:
 *   weeklyDigest(userId)             — single user (testable in isolation)
 *   runWeeklyDigestForAllUsers()     — called by cron job every Monday 08:00
 *
 * ENV VARS REQUIRED:
 *   RESEND_API_KEY  — Resend secret key
 *   APP_URL         — e.g. https://northstar.vercel.app  (used for CTA link)
 */
import { Resend } from "resend";
import { db } from "@workspace/db";
import {
  usersTable,
  coachNotificationsTable,
  coachSessionsTable,
  coachMemoryPatternsTable,
} from "@workspace/db";
import { eq, gte, sql } from "drizzle-orm";
import { openai } from "../client";
import { loadMemory } from "@workspace/integrations-openai-ai-server/growth-agent/memory-manager";
import { buildDigestEmail } from "../email/digest-template";

const resend = new Resend(process.env.RESEND_API_KEY);

// ── GPT digest paragraph generator ───────────────────────────────────────────────

async function generateDigestBody({
  userName,
  topTopics,
  avgConfidence,
  streakDays,
  patternHighlight,
  totalSessions,
}: {
  userName: string;
  topTopics: string[];
  avgConfidence: number | null;
  streakDays: number;
  patternHighlight: string;
  totalSessions: number;
}): Promise<string> {
  const prompt = `
Sei il coach di crescita personale NorthStar. Scrivi UN paragrafo di 3-4 frasi (max 80 parole) in italiano per il digest settimanale di ${userName}.

Dati della settimana:
- Sessioni completate: ${totalSessions}
- Temi principali: ${topTopics.slice(0, 3).join(", ") || "nessuno"}
- Confidence media: ${avgConfidence != null ? Math.round(avgConfidence * 100) + "%" : "non disponibile"}
- Streak: ${streakDays} giorni consecutivi
- Pattern osservato: ${patternHighlight || "nessuno"}

Tono: caldo, diretto, motivante. Non usare frasi generiche. Riferisci sempre ai dati specifici sopra. Non iniziare con "Caro" o "Salve".
  `.trim();

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 150,
    });
    return res.choices[0]?.message?.content?.trim() ?? "Ottima settimana di lavoro!";
  } catch {
    return "Continua così — ogni sessione ti avvicina ai tuoi obiettivi.";
  }
}

// ── Core: single user digest ──────────────────────────────────────────────────────

export async function weeklyDigest(userId: number): Promise<void> {
  // 1. Load user
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!user?.email) {
    console.warn(`[digest] user ${userId} has no email — skipping`);
    return;
  }

  // 2. Analytics last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const sessions = await db
    .select()
    .from(coachSessionsTable)
    .where(
      sql`${coachSessionsTable.userId} = ${userId}
          AND ${coachSessionsTable.startedAt} >= ${sevenDaysAgo}`,
    );

  const totalSessions  = sessions.length;
  const totalMessages  = sessions.reduce((s, r) => s + (r.messageCount ?? 0), 0);
  const avgConf        = sessions.length
    ? sessions.reduce((s, r) => s + (r.avgConfidence ?? 0), 0) / sessions.length
    : null;

  // Streak: count consecutive days from today
  const days = [...new Set(
    sessions.map((s) => s.startedAt.toISOString().slice(0, 10)),
  )].sort().reverse();
  let streakDays = 0;
  let cursor = new Date();
  for (const day of days) {
    const cursorDay = cursor.toISOString().slice(0, 10);
    if (day === cursorDay) {
      streakDays++;
      cursor = new Date(cursor.getTime() - 86400000);
    } else break;
  }

  // Top topics from this week
  const allTopics = sessions.flatMap((s) => (s.topics as string[]) ?? []);
  const topicCount: Record<string, number> = {};
  for (const t of allTopics) {
    topicCount[t] = (topicCount[t] ?? 0) + 1;
  }
  const topTopics = Object.entries(topicCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);

  // Top pattern highlight
  const memory = await loadMemory(userId);
  const topPattern = memory.patterns
    .filter((p) => p.confidence >= 0.65)
    .sort((a, b) => b.confidence - a.confidence)[0];
  const patternHighlight = topPattern?.description ?? "";

  // 3. Week label
  const now     = new Date();
  const monday  = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + 1);
  const sunday  = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("it-IT", { day: "numeric", month: "long" });
  const weekLabel = `${fmt(monday)} – ${fmt(sunday)}`;

  // 4. Generate personalised paragraph
  const digestBody = await generateDigestBody({
    userName: user.name ?? "amico",
    topTopics,
    avgConfidence: avgConf,
    streakDays,
    patternHighlight,
    totalSessions,
  });

  // 5. Build + send email
  const { subject, html } = buildDigestEmail({
    userName:      user.name ?? "amico",
    weekLabel,
    totalSessions,
    totalMessages,
    avgConfidence: avgConf,
    streakDays,
    topTopics,
    patternHighlight,
    digestBody,
    ctaUrl: `${process.env.APP_URL ?? "https://northstar.app"}/coach`,
  });

  await resend.emails.send({
    from:    "NorthStar Coach <digest@northstar.app>",
    to:      user.email,
    subject,
    html,
  });

  // 6. In-app notification
  await db.insert(coachNotificationsTable).values({
    userId,
    type:  "weekly_digest",
    title: `🌟 Digest settimanale — ${weekLabel}`,
    body:  digestBody,
  });

  console.log(`[digest] sent to user ${userId} (${user.email})`);
}

// ── Run for all active users ─────────────────────────────────────────────────────────

export async function runWeeklyDigestForAllUsers(): Promise<void> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Find users with at least 1 session in the last 7 days
  const activeUserIds = await db
    .selectDistinct({ userId: coachSessionsTable.userId })
    .from(coachSessionsTable)
    .where(gte(coachSessionsTable.startedAt, sevenDaysAgo));

  console.log(`[digest] running for ${activeUserIds.length} active users`);

  for (const { userId } of activeUserIds) {
    try {
      await weeklyDigest(userId);
    } catch (err) {
      console.error(`[digest] failed for user ${userId}:`, err);
    }
  }
}
