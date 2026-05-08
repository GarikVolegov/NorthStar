import {
  pgTable, text, serial, timestamp, integer, boolean, jsonb,
  index, uniqueIndex,
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

  // ── Passo 4: username univoco per profilo pubblico ─────────────────
  /**
   * Slug URL-safe, univoco. Generato automaticamente al signup come
   * slugify(name) + '-' + id. L'utente può personalizzarlo.
   * Usato per la rotta pubblica /u/:username
   */
  username: text("username").unique(),

  // Soft link: points to the last completed test session
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
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

  // ── Phase 3: Gamification Base ─────────────────────────────────
  voiceStreak:       integer("voice_streak").default(0),
  totalXp:           integer("total_xp").default(0),
  lastVoiceSessionAt: timestamp("last_voice_session_at", { withTimezone: true }),
}, (t) => ({
  usernameIdx: uniqueIndex("users_username_idx").on(t.username),
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

export const usersRelations = relations(usersTable, ({ many }) => ({
  jobApplications: many(jobApplicationsTable),
  voiceSessions: many("voiceSessionsTable" as any),
}));

// ── Utility: genera username da name + id (usato al signup) ─────────────
/** Produce "mario-rossi-42" da name="Mario Rossi", id=42 */
export function generateUsername(name: string, id: number): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 30)  // cap length
    || "utente";
  return `${slug}-${id}`;
}
