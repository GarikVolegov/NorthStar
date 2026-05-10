/**
 * affiliateWithdrawals — storico prelievi dell'affiliato.
 *
 * Quando un affiliato preleva, si crea una riga 'pending'.
 * Il cron job di pagamento la aggiorna a 'paid' e registra paidAt.
 * In caso di errore pagamento: status → 'failed', il balance viene restituito.
 */
import {
  pgTable, serial, integer, text, timestamp, index,
} from "drizzle-orm/pg-core";
import { affiliateAccountsTable } from "./affiliateAccounts";

export const affiliateWithdrawalsTable = pgTable(
  "affiliate_withdrawals",
  {
    id:          serial("id").primaryKey(),
    affiliateId: integer("affiliate_id").notNull().references(() => affiliateAccountsTable.id, { onDelete: "cascade" }),

    /** centesimi */
    amountCents: integer("amount_cents").notNull(),

    /**
     * Metodo di pagamento scelto dall'utente.
     * Estensibile in futuro (stripe_payout, crypto, ecc.).
     */
    method: text("method", { enum: ["paypal", "bank_transfer"] }).notNull(),

    /** Dettagli destinazione (email PayPal o IBAN) — opzionale, raccolto al momento */
    destination: text("destination"),

    status: text("status", { enum: ["pending", "paid", "failed"] })
      .notNull()
      .default("pending"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt:    timestamp("paid_at",    { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    affiliateIdx: index("aff_withdrawals_affiliate_idx").on(t.affiliateId),
    statusIdx:    index("aff_withdrawals_status_idx").on(t.status),
  }),
);

export type AffiliateWithdrawal    = typeof affiliateWithdrawalsTable.$inferSelect;
export type InsertAffiliateWithdrawal = typeof affiliateWithdrawalsTable.$inferInsert;
