/**
 * DB_RULES.md: modifiche additive only. Ogni nuova colonna ha DEFAULT
 * per garantire compatibilità con righe esistenti senza migration
 * distruttiva.
 */
import {
  pgTable, text, serial, timestamp, integer, boolean, jsonb,
  index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { relations } from "drizzle-orm";
import { voiceSessionsTable } from "./voiceSessions";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  googleId: text("google_id").unique(),
  avatarUrl: text("avatar_url"),
  bannerUrl: text("banner_url"),

  // ── Passo 4: username univoco per profilo pubblico ────────────────────
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

  // ── Phase 3: Gamification Base ────────────────────────────────────
  voiceStreak:        integer("voice_streak").default(0),
  totalXp:            integer("total_xp").default(0),
  lastVoiceSessionAt: timestamp("last_voice_session_at", { withTimezone: true }),

  // ── Fase 1.2: Referral tracking completo ───────────────────────────
  /**
   * Codice raw inserito al signup (es. "NS-A-1234").
   * Viene scritto subito alla registrazione, prima che affiliate_accounts
   * venga cercato/creato. NULL se nessun referral è stato usato.
   * Dopo il primo pagamento Stripe, referredByAffiliateId viene popolato
   * da processPostPaymentReferral() e questo campo rimane come audit trail.
   */
  referredByCode: text("referred_by_code"),

  /**
   * FK verso affiliate_accounts.id — chi ha portato questo utente.
   * Viene impostato da processPostPaymentReferral() dopo invoice.paid.
   * NULL se l'utente non è ancora convertito o non ha usato un referral.
   */
  /**
   * FK verso affiliate_accounts.id. Aggiungi il constraint SQL separatamente
   * in una migration per evitare circular import con affiliateAccounts.ts:
   *   ALTER TABLE users ADD CONSTRAINT fk_referred_by_affiliate
   *     FOREIGN KEY (referred_by_affiliate_id) REFERENCES affiliate_accounts(id)
   *     ON DELETE SET NULL;
   */
  referredByAffiliateId: integer("referred_by_affiliate_id"),

  /** Timestamp del primo pagamento: marca la conversione del referral. */
  referralConvertedAt: timestamp("referral_converted_at", { withTimezone: true }),

  // ── Fase 4: Accesso dashboard affiliazione ──────────────────────────
  /**
   * true = questo utente ha accesso alla dashboard affiliazione
   * (/affiliazione/dashboard) e al menu navbar corrispondente.
   */
  isAffiliate: boolean("is_affiliate").notNull().default(false),

  // ── Onboarding completato ──────────────────────────────────────
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),

  // ── Network Step 2: Posizione + Bio ────────────────────────────────
  /**
   * Città dell'utente — label human-readable (es. "Roma, Lazio, Italia").
   * Impostata tramite CityAutocomplete su Nominatim (OpenStreetMap).
   * DEFAULT null: tutti gli utenti esistenti non hanno città.
   */
  city:        text("city"),

  cityPlaceId: text("city_place_id"),

  bio: text("bio"),
}, (t) => ({
  usernameIdx:        uniqueIndex("users_username_idx").on(t.username),
  referredByIdx:      index("users_referred_by_idx").on(t.referredByAffiliateId),
  referredByCodeIdx:  index("users_referred_by_code_idx").on(t.referredByCode),
  isAffiliateIdx:     index("users_is_affiliate_idx").on(t.isAffiliate),
  cityIdx:            index("users_city_idx").on(t.city),
  testSessionIdIdx:   index("users_test_session_id_idx").on(t.testSessionId),
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
  voiceSessions: many(voiceSessionsTable),
}));

/** Produce "mario-rossi-42" da name="Mario Rossi", id=42 */
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
