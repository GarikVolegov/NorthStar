import {
  pgTable, serial, integer, text, timestamp, boolean, jsonb,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const calendarEventsTable = pgTable("calendar_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  allDay: boolean("all_day").notNull().default(false),
  category: text("category").notNull().default("task"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("todo"),
  color: text("color"),
  tags: jsonb("tags").$type<string[]>().default([]),
  linkedSectorId: integer("linked_sector_id"),
  linkedGoal: text("linked_goal"),
  linkedContentIds: jsonb("linked_content_ids").$type<number[]>().default([]),
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurrenceRule: text("recurrence_rule"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const eventRemindersTable = pgTable("event_reminders", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => calendarEventsTable.id, { onDelete: "cascade" }),
  minutesBefore: integer("minutes_before").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationsLogTable = pgTable("notifications_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  eventId: integer("event_id").references(() => calendarEventsTable.id, { onDelete: "cascade" }),
  channel: text("channel").notNull().default("inapp"),
  title: text("title").notNull(),
  body: text("body"),
  isRead: boolean("is_read").notNull().default(false),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  openedAt: timestamp("opened_at", { withTimezone: true }),
});

export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CalendarEvent = typeof calendarEventsTable.$inferSelect;
export type InsertCalendarEvent = typeof calendarEventsTable.$inferInsert;
export type EventReminder = typeof eventRemindersTable.$inferSelect;
export type NotificationLog = typeof notificationsLogTable.$inferSelect;
export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;
