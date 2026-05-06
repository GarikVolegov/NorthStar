import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
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
  testSessionId: integer("test_session_id"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  emailVerified: boolean("email_verified").notNull().default(false),
  verificationCode: text("verification_code"),
  verificationCodeExpires: timestamp("verification_code_expires", { withTimezone: true }),
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const friendshipsTable = pgTable("friendships", {
  id: serial("id").primaryKey(),
  requesterId: integer("requester_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  receiverId: integer("receiver_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Friendship = typeof friendshipsTable.$inferSelect;

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

export const jobApplicationsTable = pgTable("job_applications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  company: text("company").notNull(),
  role: text("role").notNull(),
  url: text("url"),
  status: text("status").notNull().default("saved"),
  notes: text("notes"),
  salary: text("salary"),
  location: text("location"),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
  notesLog: jsonb("notes_log"),
});

export type JobApplication = typeof jobApplicationsTable.$inferSelect;
