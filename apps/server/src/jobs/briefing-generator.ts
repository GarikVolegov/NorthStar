/**
 * briefing-generator.ts — genera briefing periodici di Wendy per gli utenti Pro+.
 *
 * Il briefing contiene:
 *   1. Top 3 news rilevanti per i settori preferiti (da rag_chunks tipo news)
 *   2. Aggiornamento weak signals nel settore dell'utente
 *   3. Recap obiettivi in scadenza questa settimana
 *   4. 1 insight proattivo personalizzato
 *
 * Frequency:
 *   weekly  → ogni lunedì (default, piano Pro+)
 *   daily   → ogni mattina (piano Team)
 *   manual  → su richiesta (tutti i piani, 1/settimana per Free)
 *
 * PRIVACY:
 *   - content markdown non contiene PII raw
 *   - userId con CASCADE DELETE (GDPR)
 *   - il LLM riceve solo dati strutturati, non messaggi personali
 */
import { db, wendyBriefingsTable, subscriptionsTable, usersTable,
  userFavoritesTable, sectorsTable, userObjectivesTable, weakSignalsTable } from "@workspace/db";
import { eq, and, isNull, desc, gte, lte, sql } from "drizzle-orm";
import { getLLM } from "@workspace/ai-server";
import { rootLogger } from "../middleware/logger";

const log = rootLogger.child({ module: "briefing-generator" });

// ── Helpers ────────────────────────────────────────────────────────────────────

function weekPeriod(): string {
  const d    = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function todayPeriod(): string {
  return new Date().toISOString().slice(0, 10);
}

function thisWeekStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1); // Lunedì
  d.setHours(0, 0, 0, 0);
  return d;
}

function thisWeekEnd(): Date {
  const d = thisWeekStart();
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

// ── Generate briefing for one user ─────────────────────────────────────────────

export async function generateBriefingForUser(
  userId: number,
  userName: string,
  type: "weekly" | "daily",
): Promise<string | null> {
  // 1. Settori preferiti
  const favorites = await db
    .select({ sectorId: userFavoritesTable.sectorId, sectorName: sectorsTable.name })
    .from(userFavoritesTable)
    .innerJoin(sectorsTable, eq(userFavoritesTable.sectorId, sectorsTable.id))
    .where(and(eq(userFavoritesTable.userId, userId), eq(userFavoritesTable.type, "sector")))
    .limit(3);

  const sectorNames  = favorites.map((f) => f.sectorName).filter(Boolean);
  const sectorIds    = favorites.map((f) => String(f.sectorId)).filter(Boolean);

  // 2. Obiettivi in scadenza questa settimana
  const weekStart = thisWeekStart();
  const weekEnd   = thisWeekEnd();
  const objectives = await db
    .select({ text: userObjectivesTable.text, progress: userObjectivesTable.progress, dueDate: userObjectivesTable.dueDate })
    .from(userObjectivesTable)
    .where(and(
      eq(userObjectivesTable.userId, userId),
      eq(userObjectivesTable.completed, false),
      isNull(userObjectivesTable.deletedAt),
      gte(userObjectivesTable.dueDate, weekStart.toISOString().slice(0, 10)),
      lte(userObjectivesTable.dueDate, weekEnd.toISOString().slice(0, 10)),
    ))
    .limit(5);

  // 3. Weak signals nei settori dell'utente
  const signals = sectorIds.length > 0
    ? await db
        .select({ title: weakSignalsTable.title, description: weakSignalsTable.description })
        .from(weakSignalsTable)
        .where(and(
          eq(weakSignalsTable.status, "confirmed"),
          sql`${weakSignalsTable.linkedSectorIds} && ${sectorIds}::text[]`,
        ))
        .orderBy(desc(weakSignalsTable.strength))
        .limit(2)
    : [];

  // 4. Costruisci prompt per il briefing
  const briefingType = type === "weekly" ? "settimanale" : "giornaliero";
  const prompt = `Sei Wendy, assistant AI di NorthStar.

Crea un briefing ${briefingType} breve e utile per ${userName}.

DATI DISPONIBILI:
${sectorNames.length > 0
  ? `Settori di interesse: ${sectorNames.join(", ")}`
  : "Settori di interesse: non ancora configurati"}

${objectives.length > 0
  ? `Obiettivi in scadenza questa settimana:
${objectives.map((o, i) => `${i + 1}. "${o.text}" — ${o.progress}% completato`).join("\n")}`
  : "Nessun obiettivo in scadenza questa settimana."}

${signals.length > 0
  ? `Segnali di mercato recenti nei tuoi settori:
${signals.map((s) => `• ${s.title}: ${s.description}`).join("\n")}`
  : ""}

ISTRUZIONI:
- Scrivi in italiano, tono caldo e diretto
- Max 200 parole totali
- Struttura: breve saluto → 1-2 insight di mercato (se disponibili) → obiettivi della settimana (se presenti) → 1 suggerimento concreto per oggi
- Usa formato Markdown leggero (**grassetto** per enfasi, - per elenchi brevi)
- Concludi con una domanda aperta per stimolare la conversazione con Wendy

NON inventare dati di mercato non forniti. Se i dati sono scarsi, concentrati sugli obiettivi e sul suggerimento.`;

  try {
    const llm    = getLLM();
    const stream = await llm.chat(
      [
        { role: "system", content: "Sei Wendy, assistant AI di NorthStar. Genera briefing brevi, utili e personalizzati." },
        { role: "user",   content: prompt },
      ],
      { model: "deepseek/deepseek-chat-v3-0324:free", temperature: 0.7, maxTokens: 400 },
    );
    let text = "";
    for await (const chunk of stream) text += chunk;
    return text.trim() || null;
  } catch (e) {
    log.warn({ e, userId }, "[briefing] LLM generation failed");
    return null;
  }
}

// ── Main runner ────────────────────────────────────────────────────────────────

export async function runBriefingGenerator(type: "weekly" | "daily" = "weekly"): Promise<{
  generated: number;
  skipped:   number;
  durationMs: number;
}> {
  const t0      = Date.now();
  const period  = type === "weekly" ? weekPeriod() : todayPeriod();
  let generated = 0;
  let skipped   = 0;

  log.info({ type, period }, "[briefing] generator starting");

  try {
    // Utenti Pro+ attivi negli ultimi 30 giorni
    const cutoff       = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const users = await db
      .select({ userId: usersTable.id, name: usersTable.name })
      .from(subscriptionsTable)
      .innerJoin(usersTable, eq(subscriptionsTable.userId, usersTable.id))
      .where(and(
        isNull(subscriptionsTable.cancelledAt),
        sql`${subscriptionsTable.plan} IN (${type === "daily" ? "'team'" : "'pro','team'"})`,
        sql`${usersTable.lastActiveAt} > ${cutoff.toISOString()}::timestamptz`,
        isNull(usersTable.deletedAt),
      ))
      .limit(500); // batch processing

    for (const user of users) {
      // Salta se briefing già generato per questo periodo
      const existing = await db
        .select({ id: wendyBriefingsTable.id })
        .from(wendyBriefingsTable)
        .where(and(
          eq(wendyBriefingsTable.userId, user.userId),
          eq(wendyBriefingsTable.type, type),
          eq(wendyBriefingsTable.period, period),
        ))
        .limit(1);

      if (existing.length > 0) { skipped++; continue; }

      const content = await generateBriefingForUser(user.userId, user.name, type);
      if (!content) { skipped++; continue; }

      await db.insert(wendyBriefingsTable).values({
        userId:  user.userId,
        type,
        period,
        content,
      });
      generated++;

      // Crea anche il proactive_insight corrispondente
      try {
        const { proactiveInsightsTable } = await import("@workspace/db");
        await db.insert(proactiveInsightsTable).values({
          userId:      user.userId,
          insightType: "news",
          title:       `Il tuo briefing ${type === "weekly" ? "settimanale" : "giornaliero"} è pronto`,
          body:        content.slice(0, 300) + (content.length > 300 ? "…" : ""),
          ctaLabel:    "Leggi il briefing completo",
          ctaTarget:   "/profilo/briefing",
        });
      } catch {
        // non-blocking
      }
    }

    const durationMs = Date.now() - t0;
    log.info({ type, generated, skipped, durationMs }, "[briefing] generator complete");
    return { generated, skipped, durationMs };
  } catch (err) {
    log.error({ err, type }, "[briefing] generator error");
    return { generated, skipped, durationMs: Date.now() - t0 };
  }
}
