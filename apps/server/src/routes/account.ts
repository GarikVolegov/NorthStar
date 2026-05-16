import { Router, type Request, type Response } from "express";
import { eq, and, isNull, desc } from "drizzle-orm";
import { db, usersTable, userObjectivesTable, objectiveCommentsTable, coachSessionsTable, voiceSessionsTable, messages, conversations, businessIdeasTable, coachMemoryFactsTable, coachMemoryPatternsTable, sessionSummariesTable, affiliateAccountsTable, affiliateCommissionsTable, affiliateWithdrawalsTable, affiliateReferralsTable, chatMessagesTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { writeAuditLog } from "../middleware/audit";

const router = Router();

async function getUserRelatedData(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const objectives = await db.select().from(userObjectivesTable).where(eq(userObjectivesTable.userId, userId));
  const coachSessions = await db.select().from(coachSessionsTable).where(eq(coachSessionsTable.userId, userId));
  const voiceSessions = await db.select().from(voiceSessionsTable).where(eq(voiceSessionsTable.userId, userId));
  const convs = await db.select().from(conversations).where(eq(conversations.userId, userId));
  const convIds = convs.map((c) => c.id);
  const allMessages = convIds.length > 0
    ? await db.select().from(messages).where(eq(messages.conversationId, convIds[0]))
    : [];
  for (let i = 1; i < convIds.length; i++) {
    allMessages.push(...await db.select().from(messages).where(eq(messages.conversationId, convIds[i])));
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
    profile: user,
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
    res.status(500).json({ error: "Errore durante l'esportazione dei dati" });
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
      deleted: !!user.deletedAt,
      deletedAt: user.deletedAt,
      purged: !!user.purgedAt,
      purgedAt: user.purgedAt,
    });
  } catch (err) {
    req.log?.error?.({ err }, "account status error");
    res.status(500).json({ error: "Errore durante il recupero dello stato" });
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

    if (user.deletedAt) {
      res.status(400).json({ error: "Account già in fase di eliminazione" });
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
          bannerUrl: null,
          username: `deleted-${userId}${anonSuffix}`,
          cvText: null,
          cvJson: null,
          city: null,
          bio: null,
          cityPlaceId: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          referralConvertedAt: null,
          updatedAt: now,
        })
        .where(eq(usersTable.id, userId));

      const tables = [
        { table: coachSessionsTable, col: coachSessionsTable.userId },
        { table: voiceSessionsTable, col: voiceSessionsTable.userId },
        { table: userObjectivesTable, col: userObjectivesTable.userId },
        { table: businessIdeasTable, col: businessIdeasTable.userId },
        { table: coachMemoryFactsTable, col: coachMemoryFactsTable.userId },
        { table: coachMemoryPatternsTable, col: coachMemoryPatternsTable.userId },
        { table: sessionSummariesTable, col: sessionSummariesTable.userId },
      ] as const;

      for (const { table, col } of tables) {
        await tx.update(table as any)
          .set({ deletedAt: now } as any)
          .where(eq(col as any, userId) as any);
      }
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
    res.status(500).json({ error: "Errore durante l'eliminazione dell'account" });
  }
});

export default router;
