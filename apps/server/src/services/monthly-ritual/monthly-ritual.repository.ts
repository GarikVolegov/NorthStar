import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import {
  db,
  monthlyRitualPreferencesTable,
  monthlyRitualRunsTable,
  proactiveInsightsTable,
  userPushSubscriptionsTable,
  usersTable,
} from "@workspace/db";
import type {
  MonthlyRitualChallengeKey,
  MonthlyRitualPreferencesRecord,
  MonthlyRitualNotificationStore,
  MonthlyRitualRunRecord,
  MonthlyRitualStatus,
} from "./monthly-ritual.service";

function mapRun(row: typeof monthlyRitualRunsTable.$inferSelect): MonthlyRitualRunRecord {
  return {
    id: row.id,
    userId: row.userId,
    ritualMonth: row.ritualMonth,
    ritualDate: row.ritualDate,
    status: row.status as MonthlyRitualStatus,
    journeyType: row.journeyType,
    routeTitle: row.routeTitle,
    routeBody: row.routeBody,
    challengeKey: row.challengeKey as MonthlyRitualChallengeKey,
    challengeLabel: row.challengeLabel,
    challengeBody: row.challengeBody,
    ctaLabel: row.ctaLabel,
    ctaTarget: row.ctaTarget,
    emailSentAt: row.emailSentAt,
    pushSentAt: row.pushSentAt,
    proactiveInsightCreatedAt: row.proactiveInsightCreatedAt,
    openedAt: row.openedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const dbMonthlyRitualStore: MonthlyRitualNotificationStore = {
  async getRunByUserAndMonth(userId, ritualMonth) {
    const [row] = await db
      .select()
      .from(monthlyRitualRunsTable)
      .where(and(eq(monthlyRitualRunsTable.userId, userId), eq(monthlyRitualRunsTable.ritualMonth, ritualMonth)))
      .limit(1);
    return row ? mapRun(row) : null;
  },

  async createRun(input) {
    const [row] = await db
      .insert(monthlyRitualRunsTable)
      .values({
        userId: input.userId,
        ritualMonth: input.ritualMonth,
        ritualDate: input.ritualDate,
        status: input.status,
        journeyType: input.journeyType,
        routeTitle: input.routeTitle,
        routeBody: input.routeBody,
        challengeKey: input.challengeKey,
        challengeLabel: input.challengeLabel,
        challengeBody: input.challengeBody,
        ctaLabel: input.ctaLabel,
        ctaTarget: input.ctaTarget,
        emailSentAt: input.emailSentAt,
        pushSentAt: input.pushSentAt,
        proactiveInsightCreatedAt: input.proactiveInsightCreatedAt,
        openedAt: input.openedAt,
        completedAt: input.completedAt,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
      })
      .onConflictDoNothing({
        target: [monthlyRitualRunsTable.userId, monthlyRitualRunsTable.ritualMonth],
      })
      .returning();
    if (row) return mapRun(row);
    const existing = await this.getRunByUserAndMonth(input.userId, input.ritualMonth);
    if (!existing) throw new Error("Monthly ritual run was not created");
    return existing;
  },

  async listEligibleUsers(activeSince) {
    const rows = await db
      .select({
        id: usersTable.id,
        journeyType: usersTable.journeyType,
        lastActiveAt: usersTable.lastActiveAt,
      })
      .from(usersTable)
      .leftJoin(monthlyRitualPreferencesTable, eq(monthlyRitualPreferencesTable.userId, usersTable.id))
      .where(
        and(
          sql`${usersTable.lastActiveAt} >= ${activeSince.toISOString()}::timestamptz`,
          isNull(usersTable.deletedAt),
          isNull(usersTable.purgedAt),
          or(
            isNull(monthlyRitualPreferencesTable.userId),
            eq(monthlyRitualPreferencesTable.ritualEnabled, true),
          ),
        ),
      );

    return rows;
  },

  async getPreferences(userId) {
    const [row] = await db
      .select({
        ritualEnabled: monthlyRitualPreferencesTable.ritualEnabled,
        emailReminderEnabled: monthlyRitualPreferencesTable.emailReminderEnabled,
      })
      .from(monthlyRitualPreferencesTable)
      .where(eq(monthlyRitualPreferencesTable.userId, userId))
      .limit(1);
    return row ?? { ritualEnabled: true, emailReminderEnabled: false };
  },

  async updatePreferences(userId, patch) {
    const current = await this.getPreferences(userId);
    const next: MonthlyRitualPreferencesRecord = {
      ritualEnabled: patch.ritualEnabled ?? current.ritualEnabled,
      emailReminderEnabled: patch.emailReminderEnabled ?? current.emailReminderEnabled,
    };
    const [row] = await db
      .insert(monthlyRitualPreferencesTable)
      .values({
        userId,
        ritualEnabled: next.ritualEnabled,
        emailReminderEnabled: next.emailReminderEnabled,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: monthlyRitualPreferencesTable.userId,
        set: {
          ritualEnabled: next.ritualEnabled,
          emailReminderEnabled: next.emailReminderEnabled,
          updatedAt: new Date(),
        },
      })
      .returning({
        ritualEnabled: monthlyRitualPreferencesTable.ritualEnabled,
        emailReminderEnabled: monthlyRitualPreferencesTable.emailReminderEnabled,
      });
    return row ?? next;
  },

  async updateRun(id, patch) {
    const [row] = await db
      .update(monthlyRitualRunsTable)
      .set({
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.openedAt !== undefined ? { openedAt: patch.openedAt } : {}),
        ...(patch.completedAt !== undefined ? { completedAt: patch.completedAt } : {}),
        ...(patch.emailSentAt !== undefined ? { emailSentAt: patch.emailSentAt } : {}),
        ...(patch.pushSentAt !== undefined ? { pushSentAt: patch.pushSentAt } : {}),
        ...(patch.proactiveInsightCreatedAt !== undefined
          ? { proactiveInsightCreatedAt: patch.proactiveInsightCreatedAt }
          : {}),
        updatedAt: patch.updatedAt ?? new Date(),
      })
      .where(eq(monthlyRitualRunsTable.id, id))
      .returning();
    if (!row) throw new Error("Monthly ritual run not found");
    return mapRun(row);
  },

  async getRecentRuns(userId, limit) {
    const rows = await db
      .select()
      .from(monthlyRitualRunsTable)
      .where(eq(monthlyRitualRunsTable.userId, userId))
      .orderBy(desc(monthlyRitualRunsTable.ritualMonth))
      .limit(limit);
    return rows.map(mapRun);
  },

  async listEmailReminderCandidates(activeSince) {
    return db
      .select({
        userId: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        journeyType: usersTable.journeyType,
        lastActiveAt: usersTable.lastActiveAt,
      })
      .from(usersTable)
      .innerJoin(monthlyRitualPreferencesTable, eq(monthlyRitualPreferencesTable.userId, usersTable.id))
      .where(
        and(
          sql`${usersTable.lastActiveAt} >= ${activeSince.toISOString()}::timestamptz`,
          isNull(usersTable.deletedAt),
          isNull(usersTable.purgedAt),
          eq(monthlyRitualPreferencesTable.ritualEnabled, true),
          eq(monthlyRitualPreferencesTable.emailReminderEnabled, true),
        ),
      );
  },

  async savePushSubscription(input) {
    await db
      .insert(userPushSubscriptionsTable)
      .values({
        userId: input.userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
        revokedAt: null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userPushSubscriptionsTable.endpoint,
        set: {
          userId: input.userId,
          p256dh: input.p256dh,
          auth: input.auth,
          userAgent: input.userAgent ?? null,
          revokedAt: null,
          updatedAt: new Date(),
        },
      });
  },

  async revokePushSubscription(userId, endpoint) {
    await db
      .update(userPushSubscriptionsTable)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(
        endpoint
          ? and(eq(userPushSubscriptionsTable.userId, userId), eq(userPushSubscriptionsTable.endpoint, endpoint))
          : eq(userPushSubscriptionsTable.userId, userId),
      );
  },

  async listPushReminderCandidates(activeSince) {
    const rows = await db
      .select({
        userId: usersTable.id,
        name: usersTable.name,
        journeyType: usersTable.journeyType,
        lastActiveAt: usersTable.lastActiveAt,
        subscriptionId: userPushSubscriptionsTable.id,
        endpoint: userPushSubscriptionsTable.endpoint,
        p256dh: userPushSubscriptionsTable.p256dh,
        auth: userPushSubscriptionsTable.auth,
      })
      .from(usersTable)
      .innerJoin(monthlyRitualPreferencesTable, eq(monthlyRitualPreferencesTable.userId, usersTable.id))
      .innerJoin(userPushSubscriptionsTable, eq(userPushSubscriptionsTable.userId, usersTable.id))
      .where(
        and(
          sql`${usersTable.lastActiveAt} >= ${activeSince.toISOString()}::timestamptz`,
          isNull(usersTable.deletedAt),
          isNull(usersTable.purgedAt),
          isNull(userPushSubscriptionsTable.revokedAt),
          eq(monthlyRitualPreferencesTable.ritualEnabled, true),
        ),
      );

    return rows.map((row) => ({
      userId: row.userId,
      name: row.name,
      journeyType: row.journeyType,
      lastActiveAt: row.lastActiveAt,
      subscription: {
        id: row.subscriptionId,
        userId: row.userId,
        endpoint: row.endpoint,
        p256dh: row.p256dh,
        auth: row.auth,
      },
    }));
  },

  async createRitualFallbackInsight(userId, run) {
    await db.insert(proactiveInsightsTable).values({
      userId,
      insightType: "plan_update",
      title: "Notte della Fondazione",
      body: `${run.routeTitle}: la tua Rotta del Mese e' pronta. Apri la Scintilla 24h prima di mezzanotte.`,
      ctaLabel: "Apri il rito",
      ctaTarget: run.ctaTarget,
    });
  },
};
