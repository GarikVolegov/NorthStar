import {
  pgTable, text, serial, timestamp, integer, boolean, jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { relations } from "drizzle-orm";
import { voiceSessionsTable } from "./voiceSessions";
import { userProfileSettingsTable } from "./userProfiles";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  googleId: text("google_id").unique(),
  avatarUrl: text("avatar_url"),

  role: text("role").notNull().default("user"),

  testSessionId: integer("test_session_id"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  emailVerified: boolean("email_verified").notNull().default(false),
  isPremium: boolean("is_premium").notNull().default(false),
  isAdmin: boolean("is_admin").notNull().default(false),
  verificationCode: text("verification_code"),
  verificationCodeExpires: timestamp("verification_code_expires", { withTimezone: true }),
  resetToken: text("reset_token"),
  resetTokenExpires: timestamp("reset_token_expires", { withTimezone: true }),

  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  streakDays: integer("streak_days").notNull().default(0),

  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  journeyType: text("journey_type").notNull().default("indeciso"),

  voiceStreak: integer("voice_streak").default(0),
  totalXp: integer("total_xp").default(0),
  lastVoiceSessionAt: timestamp("last_voice_session_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  purgedAt: timestamp("purged_at", { withTimezone: true }),
}, (t) => ({
  testSessionIdIdx: index("users_test_session_id_idx").on(t.testSessionId),
}));

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

export const jobApplicationsTable = pgTable(
  "job_applications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    company: text("company").notNull(),
    role: text("role").notNull(),
    url: text("url"),
    status: text("status", {
      enum: ["saved", "applied", "interviewing", "offer", "rejected", "withdrawn"],
    }).notNull().default("saved"),
    notes: text("notes"),
    salary: text("salary"),
    location: text("location"),
    appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    notesLog: jsonb("notes_log"),
  },
  (t) => ({ userIdx: index("job_applications_user_idx").on(t.userId) }),
);

export type JobApplication = typeof jobApplicationsTable.$inferSelect;

export const usersRelations = relations(usersTable, ({ many, one }) => ({
  jobApplications: many(jobApplicationsTable),
  voiceSessions: many(voiceSessionsTable),
  profile: one(userProfileSettingsTable, {
    fields: [usersTable.id],
    references: [userProfileSettingsTable.userId],
  }),
}));

export function generateUsername(name: string, id: number): string {
  const slug = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 30)
    || "utente";
  return `${slug}-${id}`;
}
