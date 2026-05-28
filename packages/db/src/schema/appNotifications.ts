import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const appNotificationsTable = pgTable(
  "app_notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    source: text("source", {
      enum: ["system", "wendy", "monthly_ritual", "calendar", "agent", "pipeline", "social", "proactive_insight"],
    }).notNull(),
    type: text("type").notNull(),
    severity: text("severity", {
      enum: ["info", "success", "warning", "urgent"],
    }).notNull().default("info"),
    title: text("title").notNull(),
    body: text("body"),
    ctaLabel: text("cta_label"),
    ctaUrl: text("cta_url"),
    iconKey: text("icon_key").notNull().default("bell"),
    dedupeKey: text("dedupe_key"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    readAt: timestamp("read_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userCreatedIdx: index("app_notifications_user_created_idx").on(t.userId, t.createdAt),
    userUnreadIdx: index("app_notifications_user_unread_idx").on(t.userId, t.readAt),
    sourceIdx: index("app_notifications_source_idx").on(t.source),
    dedupeUnique: uniqueIndex("app_notifications_user_dedupe_unique").on(t.userId, t.dedupeKey),
  }),
);

export const notificationDeliveriesTable = pgTable(
  "notification_deliveries",
  {
    id: serial("id").primaryKey(),
    notificationId: integer("notification_id")
      .notNull()
      .references(() => appNotificationsTable.id, { onDelete: "cascade" }),
    channel: text("channel", {
      enum: ["in_app", "push", "email"],
    }).notNull(),
    status: text("status", {
      enum: ["pending", "sent", "failed", "skipped"],
    }).notNull().default("pending"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    notificationChannelIdx: index("notification_deliveries_notification_channel_idx").on(
      t.notificationId,
      t.channel,
    ),
  }),
);

export const notificationPreferencesTable = pgTable(
  "notification_preferences",
  {
    userId: integer("user_id")
      .primaryKey()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    inAppEnabled: boolean("in_app_enabled").notNull().default(true),
    pushEnabled: boolean("push_enabled").notNull().default(true),
    emailEnabled: boolean("email_enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pushEnabledIdx: index("notification_preferences_push_enabled_idx").on(t.pushEnabled),
    emailEnabledIdx: index("notification_preferences_email_enabled_idx").on(t.emailEnabled),
  }),
);

export type AppNotification = typeof appNotificationsTable.$inferSelect;
export type NewAppNotification = typeof appNotificationsTable.$inferInsert;
export type NotificationDelivery = typeof notificationDeliveriesTable.$inferSelect;
export type NewNotificationDelivery = typeof notificationDeliveriesTable.$inferInsert;
export type NotificationPreference = typeof notificationPreferencesTable.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferencesTable.$inferInsert;
