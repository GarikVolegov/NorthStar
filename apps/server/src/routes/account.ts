import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, userProfileSettingsTable, nftCertificatesTable, userObjectivesTable, coachSessionsTable, voiceSessionsTable, messages, conversations, businessIdeasTable, coachMemoryFactsTable, coachMemoryPatternsTable, sessionSummariesTable, affiliateAccountsTable, affiliateCommissionsTable, affiliateWithdrawalsTable, affiliateReferralsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { writeAuditLog } from "../middleware/audit";
import { isPersistenceSchemaError } from "../lib/persistence";

const router = Router();

function sendAccountPersistenceError(
  req: Request,
  res: Response,
  err: unknown,
  code: "ACCOUNT_EXPORT_UNAVAILABLE" | "ACCOUNT_DELETE_UNAVAILABLE",
) {
  if (!isPersistenceSchemaError(err)) return false;
  req.log?.warn?.(
    { err, route: code, userId: req.user?.id, persistenceUnavailable: true },
    "account persistence unavailable",
  );
  res.status(503).json({
    status: "error",
    code,
    error: "Persistenza account non disponibile. Riprova quando il database e' stato ripristinato.",
    action: "retry_after_persistence_restored",
    persistenceUnavailable: true,
    setupAction: "run_migrations",
  });
  return true;
}

async function getUserRelatedData(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    throw new Error("Utente non trovato");
  }
  const [profile] = await db.select().from(userProfileSettingsTable).where(eq(userProfileSettingsTable.userId, userId)).limit(1);
  const userWithProfile = { ...user, ...(profile ?? {}) };
  const objectives = await db.select().from(userObjectivesTable).where(eq(userObjectivesTable.userId, userId));
  const coachSessions = await db.select().from(coachSessionsTable).where(eq(coachSessionsTable.userId, userId));
  const voiceSessions = await db.select().from(voiceSessionsTable).where(eq(voiceSessionsTable.userId, userId));
  const convs = await db.select().from(conversations).where(eq(conversations.userId, userId));
  const convIds = convs.map((c) => c.id);
  const allMessages: Array<typeof messages.$inferSelect> = [];
  for (const conversationId of convIds) {
    allMessages.push(
      ...(await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))),
    );
  }
  const businessIdeas = await db.select().from(businessIdeasTable).where(eq(businessIdeasTable.userId, userId));
  const coachFacts = await db.select().from(coachMemoryFactsTable).where(eq(coachMemoryFactsTable.userId, userId));
  const coachPatterns = await db.select().from(coachMemoryPatternsTable).where(eq(coachMemoryPatternsTable.userId, userId));
  const summaries = await db.select().from(sessionSummariesTable).where(eq(sessionSummariesTable.userId, userId));
  const affiliate = await db.select().from(affiliateAccountsTable).where(eq(affiliateAccountsTable.userId, userId)).limit(1);
  const affiliateAccount = affiliate[0] ?? null;
  let affiliateCommissions: Array<unknown> = [];
  let affiliateWithdrawals: Array<unknown> = [];
  let affiliateReferrals: Array<unknown> = [];
  if (affiliateAccount) {
    affiliateCommissions = await db.select().from(affiliateCommissionsTable).where(eq(affiliateCommissionsTable.affiliateId, affiliateAccount.id));
    affiliateWithdrawals = await db.select().from(affiliateWithdrawalsTable).where(eq(affiliateWithdrawalsTable.affiliateId, affiliateAccount.id));
    affiliateReferrals = await db.select().from(affiliateReferralsTable).where(eq(affiliateReferralsTable.affiliateId, affiliateAccount.id));
  }

  return {
    profile: userWithProfile,
    objectives,
    coachSessions,
    voiceSessions,
    conversations: convs,
    messages: allMessages,
    businessIdeas,
    coachMemory: { facts: coachFacts, patterns: coachPatterns },
    sessionSummaries: summaries,
    affiliate: affiliateAccount ? {
      account: affiliateAccount,
      commissions: affiliateCommissions,
      withdrawals: affiliateWithdrawals,
      referrals: affiliateReferrals,
    } : null,
  };
}

router.get("/export", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const data = await getUserRelatedData(userId);

    writeAuditLog(req, {
      action: "data_export",
      category: "data",
      metadata: { exportedAt: new Date().toISOString() },
    });

    res.json({
      exportedAt: new Date().toISOString(),
      userId,
      data,
    });
  } catch (err) {
    req.log?.error?.({ err }, "account export error");
    if (sendAccountPersistenceError(req, res, err, "ACCOUNT_EXPORT_UNAVAILABLE")) return;
    res.status(500).json({
      status: "error",
      code: "ACCOUNT_EXPORT_FAILED",
      error: "Errore durante l'esportazione dei dati",
      action: "retry_account_export",
    });
  }
});

router.get("/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const [user] = await db
      .select({ deletedAt: usersTable.deletedAt, purgedAt: usersTable.purgedAt })
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.id))
      .limit(1);

    res.json({
      deleted: !!user?.deletedAt,
      deletedAt: user?.deletedAt ?? null,
      purged: !!user?.purgedAt,
      purgedAt: user?.purgedAt ?? null,
    });
  } catch (err) {
    req.log?.error?.({ err }, "account status error");
    res.status(500).json({
      status: "error",
      code: "ACCOUNT_STATUS_FAILED",
      error: "Errore durante il recupero dello stato",
      action: "retry_account_status",
    });
  }
});

router.delete("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const now = new Date();

    const [user] = await db
      .select({ id: usersTable.id, deletedAt: usersTable.deletedAt })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({
        code: "ACCOUNT_NOT_FOUND",
        error: "Utente non trovato",
        action: "refresh_session",
      });
      return;
    }

    if (user.deletedAt) {
      res.status(409).json({
        code: "ACCOUNT_DELETE_ALREADY_REQUESTED",
        error: "Account gia' in fase di eliminazione",
        action: "check_account_status",
        deletedAt: user.deletedAt,
      });
      return;
    }

    const anonSuffix = `-deleted-${Date.now()}`;

    await db.transaction(async (tx) => {
      await tx.update(usersTable)
        .set({
          deletedAt: now,
          name: `Utente Eliminato`,
          email: `deleted-${userId}${anonSuffix}@anon.northstar.app`,
          passwordHash: null,
          googleId: null,
          avatarUrl: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          updatedAt: now,
        })
        .where(eq(usersTable.id, userId));

      await tx.update(userProfileSettingsTable)
        .set({
          bannerUrl: null,
          username: `deleted-${userId}${anonSuffix}`,
          cvText: null,
          cvJson: null,
          city: null,
          bio: null,
          cityPlaceId: null,
          referralConvertedAt: null,
          updatedAt: now,
        })
        .where(eq(userProfileSettingsTable.userId, userId));

      await tx.update(nftCertificatesTable)
        .set({
          userName: "Utente Eliminato",
          objectiveText: "Eliminato",
          isPublic: false,
        })
        .where(eq(nftCertificatesTable.userId, userId));

      await tx.update(coachSessionsTable).set({ deletedAt: now }).where(eq(coachSessionsTable.userId, userId));
      await tx.update(voiceSessionsTable).set({ deletedAt: now }).where(eq(voiceSessionsTable.userId, userId));
      await tx.update(userObjectivesTable).set({ deletedAt: now }).where(eq(userObjectivesTable.userId, userId));
      await tx.update(businessIdeasTable).set({ deletedAt: now }).where(eq(businessIdeasTable.userId, userId));
      await tx.update(coachMemoryFactsTable).set({ deletedAt: now }).where(eq(coachMemoryFactsTable.userId, userId));
      await tx.update(coachMemoryPatternsTable).set({ deletedAt: now }).where(eq(coachMemoryPatternsTable.userId, userId));
      await tx.update(sessionSummariesTable).set({ deletedAt: now }).where(eq(sessionSummariesTable.userId, userId));
    });

    writeAuditLog(req, {
      action: "user_deleted",
      category: "data",
      metadata: { deletedAt: now.toISOString() },
    });

    res.json({
      success: true,
      message: "Account segnato per eliminazione. I dati verranno rimossi definitivamente entro 90 giorni.",
      deletedAt: now,
    });
  } catch (err) {
    req.log?.error?.({ err }, "account delete error");
    if (sendAccountPersistenceError(req, res, err, "ACCOUNT_DELETE_UNAVAILABLE")) return;
    res.status(500).json({
      status: "error",
      code: "ACCOUNT_DELETE_FAILED",
      error: "Errore durante l'eliminazione dell'account",
      action: "retry_account_delete",
    });
  }
});

export default router;
