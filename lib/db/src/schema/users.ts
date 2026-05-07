/**
 * FIXED:
 * - friendshipsTable: added uniqueIndex on (requesterId, receiverId)
 *   to prevent duplicate friendship requests
 * - friendshipsTable: status uses enum constraint
 * - friendshipsTable moved here remains canonical (friendships.ts re-exports)
 * - Added usersRelations for Drizzle relational queries
 * - Added updatedAt to usersTable for last-profile-update tracking
 * - jobApplicationsTable: added index on userId
 */
import {
  pgTable, text, serial, timestamp, integer, boolean, jsonb,
  uniqueIndex, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { relations } from "drizzle-orm";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  googleId: text("google_id").unique(),
  avatarUrl: text("avatar_url"),
  // Soft link: points to the last completed test session
  testSessionId: integer("test_session_id"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  emailVerified: boolean("email_verified").notNull().default(false),
  verificationCode: text("verification_code"),
  verificationCodeExpires: timestamp("verification_code_expires", {
    withTimezone: true,
  }),
  resetToken: text("reset_token"),
  resetTokenExpires: timestamp("reset_token_expires", { withTimezone: true }),
  cvText: text("cv_text"),
  cvJson: jsonb("cv_json"),
  isPublic: boolean("is_public").notNull().default(false),
  timezone: text("timezone").default("Europe/Rome"),
  workPreference: text("work_preference").default("unknown"),
  autonomyPreference: integer("autonomy_preference").default(5),
  stabilityPreference: integer("stability_preference").default(5),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  streakDays: integer("streak_days").notNull().default(0),
  userMode: text("user_mode").notNull().default("explorer"),
  journeyType: text("journey_type").notNull().default("indeciso"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // ADDED: track last profile modification
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// FIXED: added uniqueIndex + enum status
export const friendshipsTable = pgTable(
  "friendships",
  {
    id: serial("id").primaryKey(),
    requesterId: integer("requester_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    receiverId: integer("receiver_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    // FIXED: enum constraint instead of free text
    status: text("status", {
      enum: ["pending", "accepted", "rejected", "blocked"],
    })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // FIXED: prevents duplicate friendship requests between same pair
    uniquePair: uniqueIndex("friendships_unique_pair").on(
      t.requesterId,
      t.receiverId,
    ),
  }),
);

export type Friendship = typeof friendshipsTable.$inferSelect;

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

export const jobApplicationsTable = pgTable(
  "job_applications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    company: text("company").notNull(),
    role: text("role").notNull(),
    url: text("url"),
    status: text("status", {
      enum: ["saved", "applied", "interviewing", "offer", "rejected", "withdrawn"],
    })
      .notNull()
      .default("saved"),
    notes: text("notes"),
    salary: text("salary"),
    location: text("location"),
    appliedAt: timestamp("applied_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    notesLog: jsonb("notes_log"),
  },
  (t) => ({
    // Fast lookup of all applications for a user
    userIdx: index("job_applications_user_idx").on(t.userId),
  }),
);

export type JobApplication = typeof jobApplicationsTable.$inferSelect;

// Drizzle relational query support
export const usersRelations = relations(usersTable, ({ many }) => ({
  friendshipsAsSender: many(friendshipsTable, {
    relationName: "friendships_requester",
  }),
  friendshipsAsReceiver: many(friendshipsTable, {
    relationName: "friendships_receiver",
  }),
  jobApplications: many(jobApplicationsTable),
}));

export const friendshipsRelations = relations(
  friendshipsTable,
  ({ one }) => ({
    requester: one(usersTable, {
      fields: [friendshipsTable.requesterId],
      references: [usersTable.id],
      relationName: "friendships_requester",
    }),
    receiver: one(usersTable, {
      fields: [friendshipsTable.receiverId],
      references: [usersTable.id],
      relationName: "friendships_receiver",
    }),
  }),
);
