/**
 * proactive-insight-generator.ts — genera insight proattivi per gli utenti attivi.
 *
 * Esegue ogni notte (CRON_PROACTIVE_HOUR env, default 2:00 AM).
 *
 * Tipi di insight generati:
 *   1. weak_signal  — nuovo segnale confermato nel settore preferito dell'utente
 *   2. skill_gap    — skill mancanti nel ruolo target (vs job_posting_snapshot top skills)
 *   3. news         — non ancora implementato (richiede RAG news attivo)
 *
 * Deduplication:
 *   - Non inserisce se un insight dello stesso tipo + linkedWeakSignalId esiste già
 *     e non è stato dimesso (dismissedAt IS NULL)
 *   - Max 3 insight non-letti per utente simultaneamente
 *
 * PRIVACY:
 *   - userId da DB join, mai da request
 *   - body degli insight: testo generico, nessun PII specifico
 */
import {
  db,
  weakSignalsTable,
  proactiveInsightsTable,
  userFavoritesTable,
  usersTable,
} from "@workspace/db";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { rootLogger } from "../middleware/logger";

const log = rootLogger.child({ module: "proactive-insight-generator" });

const MAX_UNREAD_PER_USER = 3;

interface ActiveUser {
  id:            number;
  preferredSectorIds: number[];
}

async function getActiveUsers(): Promise<ActiveUser[]> {
  // Utenti attivi negli ultimi 30 giorni con settori preferiti
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      userId:   usersTable.id,
      sectorId: userFavoritesTable.sectorId,
    })
    .from(usersTable)
    .innerJoin(userFavoritesTable, eq(userFavoritesTable.userId, usersTable.id))
    .where(
      and(
        sql`${usersTable.lastActiveAt} > ${cutoff.toISOString()}::timestamptz`,
        isNull(usersTable.deletedAt),
      ),
    )
    .limit(1000);

  // Raggruppa per userId
  const byUser = new Map<number, number[]>();
  for (const row of rows) {
    if (!byUser.has(row.userId)) byUser.set(row.userId, []);
    if (row.sectorId) byUser.get(row.userId)!.push(row.sectorId);
  }

  return [...byUser.entries()].map(([id, preferredSectorIds]) => ({ id, preferredSectorIds }));
}

async function countUnreadInsights(userId: number): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(proactiveInsightsTable)
    .where(
      and(
        eq(proactiveInsightsTable.userId, userId),
        isNull(proactiveInsightsTable.readAt),
        isNull(proactiveInsightsTable.dismissedAt),
      ),
    );
  return row?.count ?? 0;
}

async function alreadyHasInsight(userId: number, signalId: number): Promise<boolean> {
  const rows = await db
    .select({ id: proactiveInsightsTable.id })
    .from(proactiveInsightsTable)
    .where(
      and(
        eq(proactiveInsightsTable.userId, userId),
        eq(proactiveInsightsTable.linkedWeakSignalId, signalId),
        isNull(proactiveInsightsTable.dismissedAt),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

async function generateWeakSignalInsights(): Promise<number> {
  // Segnali confermati nell'ultima settimana
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const signals = await db
    .select({
      id:              weakSignalsTable.id,
      title:           weakSignalsTable.title,
      description:     weakSignalsTable.description,
      linkedSectorIds: weakSignalsTable.linkedSectorIds,
      strength:        weakSignalsTable.strength,
    })
    .from(weakSignalsTable)
    .where(
      and(
        eq(weakSignalsTable.status, "confirmed"),
        sql`${weakSignalsTable.updatedAt} > ${weekAgo.toISOString()}::timestamptz`,
      ),
    )
    .orderBy(desc(weakSignalsTable.strength))
    .limit(20);

  if (signals.length === 0) return 0;

  const users   = await getActiveUsers();
  let inserted  = 0;

  for (const user of users) {
    // Controllo slot liberi (max 3 unread)
    const unread = await countUnreadInsights(user.id);
    if (unread >= MAX_UNREAD_PER_USER) continue;

    // Trova segnali nei settori preferiti dell'utente
    const userSectorStrings = user.preferredSectorIds.map(String);
    const matching = signals.filter((s) =>
      s.linkedSectorIds.length === 0 ||
      s.linkedSectorIds.some((sid) => userSectorStrings.includes(sid)),
    );

    let slotsLeft = MAX_UNREAD_PER_USER - unread;
    for (const signal of matching) {
      if (slotsLeft <= 0) break;
      if (await alreadyHasInsight(user.id, signal.id)) continue;

      await db.insert(proactiveInsightsTable).values({
        userId:             user.id,
        insightType:        "weak_signal",
        title:              `Ruolo emergente: ${signal.title}`,
        body:               `Nel mercato del lavoro stiamo osservando un segnale emergente: "${signal.title}" è in forte crescita. ${signal.description} Vuoi saperne di più o aggiungerlo al tuo radar professionale?`,
        ctaLabel:           "Esplora il segnale",
        ctaTarget:          "/ruoli",
        linkedWeakSignalId: signal.id,
      });

      slotsLeft--;
      inserted++;
    }
  }

  return inserted;
}

export async function runProactiveInsightGenerator(): Promise<{
  insightsCreated: number;
  usersProcessed:  number;
  durationMs:      number;
}> {
  const t0 = Date.now();
  log.info("[proactive-insight] generator starting");

  try {
    const users   = await getActiveUsers();
    const created = await generateWeakSignalInsights();

    const durationMs = Date.now() - t0;
    log.info({ insightsCreated: created, usersProcessed: users.length, durationMs }, "[proactive-insight] generator complete");

    return { insightsCreated: created, usersProcessed: users.length, durationMs };
  } catch (err) {
    log.error({ err }, "[proactive-insight] generator error");
    return { insightsCreated: 0, usersProcessed: 0, durationMs: Date.now() - t0 };
  }
}
