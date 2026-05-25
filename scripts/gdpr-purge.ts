/**
 * gdpr-purge.ts — GDPR data retention purge job
 *
 * Scopo: eliminare definitivamente i dati degli utenti che hanno
 * richiesto la cancellazione dell'account (soft-delete) e per i quali
 * è scaduto il periodo di retention.
 *
 * Retention period: 90 giorni (default). Configurabile via env:
 *   GDPR_PURGE_AFTER_DAYS=90
 *
 * Utilizzo:
 *   pnpm tsx scripts/gdpr-purge.ts              # dry-run
 *   pnpm tsx scripts/gdpr-purge.ts --execute     # purge effettivo
 *
 * Questo script è progettato per essere eseguito come cron job:
 *   0 3 * * * cd /app && pnpm tsx scripts/gdpr-purge.ts --execute
 */

import dotenv from "dotenv";
dotenv.config();

import { db, usersTable, nftCertificatesTable, coachSessionsTable, voiceSessionsTable, userObjectivesTable, businessIdeasTable, coachMemoryFactsTable, coachMemoryPatternsTable, sessionSummariesTable, conversations, messages, chatMessagesTable } from "@workspace/db";
import { eq, lt, isNotNull, and, sql } from "drizzle-orm";

const PURGE_AFTER_DAYS = parseInt(process.env.GDPR_PURGE_AFTER_DAYS ?? "90", 10);
const DRY_RUN = !process.argv.includes("--execute");

async function main() {
  console.log(`[gdpr-purge] Starting ${DRY_RUN ? "DRY-RUN" : "PURGE"} (retention: ${PURGE_AFTER_DAYS} days)`);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - PURGE_AFTER_DAYS);

  const usersToPurge = await db
    .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, deletedAt: usersTable.deletedAt })
    .from(usersTable)
    .where(
      and(
        isNotNull(usersTable.deletedAt),
        lt(usersTable.deletedAt, cutoff),
        isNull(usersTable.purgedAt),
      ),
    );

  console.log(`[gdpr-purge] Found ${usersToPurge.length} users to purge`);

  if (usersToPurge.length === 0) {
    console.log("[gdpr-purge] Nothing to do.");
    return;
  }

  for (const user of usersToPurge) {
    console.log(`  [${user.id}] ${user.email ?? "N/A"} — deleted at ${user.deletedAt}`);
  }

  if (DRY_RUN) {
    console.log("[gdpr-purge] Dry-run complete. Pass --execute to actually purge.");
    return;
  }

  for (const user of usersToPurge) {
    const userId = user.id;
    console.log(`  Purging user ${userId}...`);

    await db.transaction(async (tx) => {
      // Delete related data (cascade handles most via FK)
      await tx.delete(coachMemoryFactsTable).where(eq(coachMemoryFactsTable.userId, userId));
      await tx.delete(coachMemoryPatternsTable).where(eq(coachMemoryPatternsTable.userId, userId));
      await tx.delete(sessionSummariesTable).where(eq(sessionSummariesTable.userId, userId));
      await tx.delete(voiceSessionsTable).where(eq(voiceSessionsTable.userId, userId));
      await tx.delete(coachSessionsTable).where(eq(coachSessionsTable.userId, userId));
      await tx.delete(userObjectivesTable).where(eq(userObjectivesTable.userId, userId));
      await tx.delete(businessIdeasTable).where(eq(businessIdeasTable.userId, userId));
      await tx.delete(nftCertificatesTable).where(eq(nftCertificatesTable.userId, userId));

      // Delete conversations and their messages
      const convs = await tx
        .select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.userId, userId));
      for (const conv of convs) {
        await tx.delete(messages).where(eq(messages.conversationId, conv.id));
      }
      await tx.delete(conversations).where(eq(conversations.userId, userId));

      // Mark user as purged (keep minimal audit trail)
      await tx.update(usersTable)
        .set({ purgedAt: new Date() })
        .where(eq(usersTable.id, userId));
    });

    console.log(`  User ${userId} purged.`);
  }

  console.log(`[gdpr-purge] Purge complete. ${usersToPurge.length} users processed.`);
}

main().catch((err) => {
  console.error("[gdpr-purge] Fatal error:", err);
  process.exit(1);
});
