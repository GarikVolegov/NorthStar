/**
 * affiliateAccounts — wallet principale di ogni affiliato.
 *
 * Una riga per utente affiliato.
 * Balance in centesimi di euro (integer) per evitare floating-point.
 *
 * Regola dei 29€:
 *   lockedBalance     <= 2900 (cents)  →  copre il prossimo rinnovo
 *   withdrawableBalance = tutto ciò che supera 2900 cumulativamente
 */
import {
  pgTable, serial, integer, text, boolean,
  timestamp, index, unique,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const affiliateAccountsTable = pgTable(
  "affiliate_accounts",
  {
    id:                   serial("id").primaryKey(),
    userId:               integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),

    referralCode:         text("referral_code").notNull(),

    /** centesimi (es. 2900 = 29.00€) */
    lockedBalance:        integer("locked_balance").notNull().default(0),
    withdrawableBalance:  integer("withdrawable_balance").notNull().default(0),
    totalEarned:          integer("total_earned").notNull().default(0),
    totalReferrals:       integer("total_referrals").notNull().default(0),

    isPremiumActive:      boolean("is_premium_active").notNull().default(false),
    nextRenewalAt:        timestamp("next_renewal_at", { withTimezone: true }),

    /**
     * Stato del conto:
     *   active   = affiliato con Premium attivo
     *   paused   = Premium scaduto (commissioni accumulate ma non distribuite)
     *   suspended = violazione T&C
     */
    status: text("status", { enum: ["active", "paused", "suspended"] })
      .notNull()
      .default("active"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    userIdIdx:       index("affiliate_accounts_user_id_idx").on(t.userId),
    referralCodeUnq: unique("affiliate_accounts_referral_code_unq").on(t.referralCode),
  }),
);

export type AffiliateAccount    = typeof affiliateAccountsTable.$inferSelect;
export type InsertAffiliateAccount = typeof affiliateAccountsTable.$inferInsert;
