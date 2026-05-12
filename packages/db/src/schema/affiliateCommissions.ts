/**
 * affiliateCommissions — log immutabile di ogni commissione ricorrente.
 *
 * Una riga per ogni (affiliato, refermato, mese).
 * UNIQUE (affiliate_id, referred_user_id, month) → idempotente.
 *
 * Status flow:  pending → applied (→ locked o withdrawable)
 *               pending → void  (se refermato disdice prima del cut)
 */
import {
  pgTable, serial, integer, text, timestamp, index, unique,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { affiliateAccountsTable } from "./affiliateAccounts";

export const affiliateCommissionsTable = pgTable(
  "affiliate_commissions",
  {
    id:             serial("id").primaryKey(),
    affiliateId:    integer("affiliate_id").notNull().references(() => affiliateAccountsTable.id, { onDelete: "cascade" }),
    referredUserId: integer("referred_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),

    /** centesimi (580 = 5.80€) */
    amountCents:    integer("amount_cents").notNull().default(580),

    /**
     * Mese di competenza: YYYY-MM (es. '2026-05').
     * Usato per il vincolo UNIQUE e per raggruppare i report.
     */
    month:          text("month").notNull(),

    /**
     * applied_to: dove è finita la commissione una volta processata
     *   locked       → ha riempito lockedBalance (verso i 29€)
     *   withdrawable → lockedBalance già pieno, va in withdrawableBalance
     */
    appliedTo: text("applied_to", { enum: ["locked", "withdrawable"] }),

    status: text("status", { enum: ["pending", "applied", "void"] })
      .notNull()
      .default("pending"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
  },
  (t) => ({
    affiliateIdx: index("aff_comm_affiliate_idx").on(t.affiliateId),
    monthIdx:     index("aff_comm_month_idx").on(t.month),
    uniqMonth:    unique("aff_comm_unique_month").on(t.affiliateId, t.referredUserId, t.month),
  }),
);

export type AffiliateCommission    = typeof affiliateCommissionsTable.$inferSelect;
export type InsertAffiliateCommission = typeof affiliateCommissionsTable.$inferInsert;
