import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const monthlyRitualRunsTable = pgTable(
  "monthly_ritual_runs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    ritualMonth: text("ritual_month").notNull(),
    ritualDate: timestamp("ritual_date", { withTimezone: true }).notNull(),
    status: text("status", {
      enum: ["pending", "opened", "challenge_completed", "expired"],
    }).notNull().default("pending"),
    journeyType: text("journey_type").notNull(),
    routeTitle: text("route_title").notNull(),
    routeBody: text("route_body").notNull(),
    challengeKey: text("challenge_key").notNull(),
    challengeLabel: text("challenge_label").notNull(),
    challengeBody: text("challenge_body").notNull(),
    ctaLabel: text("cta_label").notNull(),
    ctaTarget: text("cta_target").notNull(),
    emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
    pushSentAt: timestamp("push_sent_at", { withTimezone: true }),
    proactiveInsightCreatedAt: timestamp("proactive_insight_created_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userMonthUnique: uniqueIndex("monthly_ritual_runs_user_month_unique").on(t.userId, t.ritualMonth),
    userIdx: index("monthly_ritual_runs_user_idx").on(t.userId),
    monthIdx: index("monthly_ritual_runs_month_idx").on(t.ritualMonth),
    statusIdx: index("monthly_ritual_runs_status_idx").on(t.status),
  }),
);

export const monthlyRitualPreferencesTable = pgTable(
  "monthly_ritual_preferences",
  {
    userId: integer("user_id")
      .primaryKey()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    ritualEnabled: boolean("ritual_enabled").notNull().default(true),
    emailReminderEnabled: boolean("email_reminder_enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    enabledIdx: index("monthly_ritual_preferences_enabled_idx").on(t.ritualEnabled),
  }),
);

export const userPushSubscriptionsTable = pgTable(
  "user_push_subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    endpointUnique: uniqueIndex("user_push_subscriptions_endpoint_unique").on(t.endpoint),
    userIdx: index("user_push_subscriptions_user_idx").on(t.userId),
    activeUserIdx: index("user_push_subscriptions_active_user_idx").on(t.userId, t.revokedAt),
  }),
);

export type MonthlyRitualRun = typeof monthlyRitualRunsTable.$inferSelect;
export type NewMonthlyRitualRun = typeof monthlyRitualRunsTable.$inferInsert;
export type MonthlyRitualPreference = typeof monthlyRitualPreferencesTable.$inferSelect;
export type NewMonthlyRitualPreference = typeof monthlyRitualPreferencesTable.$inferInsert;
export type UserPushSubscription = typeof userPushSubscriptionsTable.$inferSelect;
export type NewUserPushSubscription = typeof userPushSubscriptionsTable.$inferInsert;
