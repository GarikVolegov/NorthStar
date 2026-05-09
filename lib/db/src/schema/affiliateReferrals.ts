/**
 * affiliateReferrals — relazione CONFERMATA referrer → referred.
 *
 * ⚠️  REGOLA 0 — vedi DB_RULES.md prima di modificare.
 *
 * Una riga per utente referito (UNIQUE su referred_user_id).
 * Un utente può essere referito da un solo affiliato — integrità garantita
 * dal vincolo unique.
 *
 * Creazione:
 *   → Webhook Stripe `invoice.paid` (primo pagamento del referred)
 *   → chiamata a referralService.confirmReferral()
 *
 * Status flow:
 *   active → cancelled  (refund / chargeback / subscription deleted)
 *
 * NON modificare le FK con onDelete: 'cascade' su referred_user_id:
 * se un utente si cancella vogliamo mantenere lo storico per audit.
 * Usa onDelete: 'set null' e gestisci in applicazione.
 */
import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { usersTable } from './users';
import { affiliateAccountsTable } from './affiliateAccounts';

export const affiliateReferralsTable = pgTable(
  'affiliate_referrals',
  {
    id: serial('id').primaryKey(),

    /**
     * Utente che ha condiviso il codice referral.
     * Riceve le commissioni su ogni rinnovo del referred.
     */
    referrerUserId: integer('referrer_user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),

    /**
     * Utente che si è registrato tramite il codice referral.
     * UNIQUE → un utente può essere referito da un solo affiliato.
     */
    referredUserId: integer('referred_user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),

    /**
     * Account affiliato del referrer (FK su affiliate_accounts).
     * Denormalizzazione intenzionale per query efficienti.
     */
    affiliateId: integer('affiliate_id')
      .notNull()
      .references(() => affiliateAccountsTable.id, { onDelete: 'cascade' }),

    /**
     * Status del referral:
     *   active    = referred ha un abbonamento attivo
     *   cancelled = abbonamento cancellato / refund / chargeback
     */
    status: text('status', { enum: ['active', 'cancelled'] })
      .notNull()
      .default('active'),

    /**
     * Payment intent del PRIMO pagamento che ha confermato il referral.
     * Usato per idempotency nel webhook Stripe.
     */
    firstPaymentIntentId: text('first_payment_intent_id'),

    /** Timestamp di quando il referred ha fatto il primo pagamento. */
    activatedAt: timestamp('activated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    /** Popolato quando il referred cancella. */
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  },
  (t) => ({
    referrerIdx: index('aff_ref_referrer_idx').on(t.referrerUserId),
    referredIdx: index('aff_ref_referred_idx').on(t.referredUserId),
    affiliateIdx: index('aff_ref_affiliate_idx').on(t.affiliateId),
    /**
     * Un utente può essere referito UNA sola volta.
     * Previene doppi referral se il webhook arriva due volte.
     */
    uniqReferred: unique('aff_ref_unique_referred').on(t.referredUserId),
  }),
);

export type AffiliateReferral = typeof affiliateReferralsTable.$inferSelect;
export type InsertAffiliateReferral = typeof affiliateReferralsTable.$inferInsert;
