/**
 * commissionService.ts — Logica commissioni affiliate.
 *
 * ⚠️  REGOLA 0: vedi API_RULES.md + DB_RULES.md prima di modificare.
 *
 * Regole di business:
 *   - Commissione: 5.80€ (580 cents) = 20% di 29€ al mese
 *   - Holdback: i primi 29€ (2900 cents) vanno in lockedBalance
 *     per coprire il prossimo rinnovo dell'affiliato
 *   - Quando lockedBalance raggiunge 2900 cents → tutto va in
 *     withdrawableBalance e locked si azzera
 *   - Ogni (affiliateId, referredUserId, month) è UNICO → idempotente
 *
 * Chiamata da:
 *   - Webhook Stripe invoice.paid (mensile)
 *   - Script di recupero manuale (admin)
 */

import { db } from '@workspace/db';
import {
  affiliateAccountsTable,
  affiliateCommissionsTable,
  auditLogTable,
} from '@workspace/db/schema';
import { eq, and } from 'drizzle-orm';

// ── Costanti di business ──────────────────────────────────────────────
const COMMISSION_CENTS = 580;    // 5.80€ = 20% di 29€
const HOLDBACK_CENTS   = 2900;   // 29€ soglia sblocco locked→withdrawable

export type CommissionResult = 'applied' | 'duplicate' | 'affiliate_not_found';

export interface ApplyCommissionParams {
  affiliateId:    number;
  referredUserId: number;
  /** Mese di competenza: 'YYYY-MM' (es. '2026-05') */
  month:          string;
  /** null = sistema/cron, numero = admin che ha triggerato manualmente */
  actorId?:       number | null;
  /** IP per audit trail */
  ipAddress?:     string;
}

/**
 * Registra una commissione mensile per un affiliato.
 *
 * Transazionale: o tutto riesce o niente viene salvato.
 * Idempotente: chiamate duplicate sullo stesso (affiliateId, referredUserId, month)
 * vengono ignorate silenziosamente.
 *
 * @returns 'applied' — commissione processata
 * @returns 'duplicate' — già processata questo mese, skip
 * @returns 'affiliate_not_found' — account affiliato non trovato
 */
export async function applyMonthlyCommission(
  params: ApplyCommissionParams,
): Promise<CommissionResult> {
  const { affiliateId, referredUserId, month, actorId = null, ipAddress } = params;

  return await db.transaction(async (tx) => {
    // ── Step 1: Insert idempotente ────────────────────────────────────
    // onConflictDoNothing rispetta il UNIQUE (affiliateId, referredUserId, month)
    const inserted = await tx
      .insert(affiliateCommissionsTable)
      .values({
        affiliateId,
        referredUserId,
        amountCents: COMMISSION_CENTS,
        month,
        status: 'pending',
      })
      .onConflictDoNothing()
      .returning({ id: affiliateCommissionsTable.id });

    if (inserted.length === 0) {
      return 'duplicate';
    }

    // ── Step 2: Leggi il conto affiliato ─────────────────────────────
    const [account] = await tx
      .select()
      .from(affiliateAccountsTable)
      .where(eq(affiliateAccountsTable.id, affiliateId))
      .limit(1);

    if (!account) {
      // Non fare throw qui: il caller può decidere come gestirlo
      return 'affiliate_not_found';
    }

    // ── Step 3: Calcola dove va la commissione ────────────────────────
    const newLocked = account.lockedBalance + COMMISSION_CENTS;
    let appliedTo: 'locked' | 'withdrawable';

    if (newLocked >= HOLDBACK_CENTS) {
      /**
       * Holdback raggiunto:
       *   - Sposta tutto (locked + nuova commissione) in withdrawable
       *   - Azzera locked
       *
       * Esempio:
       *   lockedBalance = 2320 (4 commissioni da 580)
       *   + 580 (nuova) = 2900 → soglia raggiunta
       *   → withdrawable += 2900, locked = 0
       */
      await tx
        .update(affiliateAccountsTable)
        .set({
          lockedBalance:       0,
          withdrawableBalance: account.withdrawableBalance + newLocked,
          totalEarned:         account.totalEarned + COMMISSION_CENTS,
          updatedAt:           new Date(),
        })
        .where(eq(affiliateAccountsTable.id, affiliateId));
      appliedTo = 'withdrawable';
    } else {
      /**
       * Ancora in accumulo holdback:
       *   locked cresce di 580 cents
       */
      await tx
        .update(affiliateAccountsTable)
        .set({
          lockedBalance: newLocked,
          totalEarned:   account.totalEarned + COMMISSION_CENTS,
          updatedAt:     new Date(),
        })
        .where(eq(affiliateAccountsTable.id, affiliateId));
      appliedTo = 'locked';
    }

    // ── Step 4: Marca commissione come applied ────────────────────────
    await tx
      .update(affiliateCommissionsTable)
      .set({
        status:    'applied',
        appliedTo,
        appliedAt: new Date(),
      })
      .where(
        and(
          eq(affiliateCommissionsTable.affiliateId, affiliateId),
          eq(affiliateCommissionsTable.referredUserId, referredUserId),
          eq(affiliateCommissionsTable.month, month),
        ),
      );

    // ── Step 5: Audit log (sempre — anche in caso di duplicate skip è già uscito) ──
    await tx.insert(auditLogTable).values({
      actorId,
      targetId:  account.userId,
      action:    'commission_applied',
      metadata:  {
        affiliateId,
        referredUserId,
        month,
        amountCents: COMMISSION_CENTS,
        appliedTo,
        newLockedBalance:       appliedTo === 'locked' ? newLocked : 0,
        newWithdrawableBalance: appliedTo === 'withdrawable'
          ? account.withdrawableBalance + newLocked
          : account.withdrawableBalance,
      },
      ipAddress: ipAddress ?? null,
    });

    return 'applied';
  });
}

/**
 * Annulla una commissione pending (es. refund entro 30 giorni).
 * Imposta status = 'void' e logga in audit.
 */
export async function voidCommission(params: {
  affiliateId:    number;
  referredUserId: number;
  month:          string;
  reason:         string;
  actorId?:       number | null;
}): Promise<void> {
  const { affiliateId, referredUserId, month, reason, actorId = null } = params;

  await db.transaction(async (tx) => {
    await tx
      .update(affiliateCommissionsTable)
      .set({ status: 'void' })
      .where(
        and(
          eq(affiliateCommissionsTable.affiliateId, affiliateId),
          eq(affiliateCommissionsTable.referredUserId, referredUserId),
          eq(affiliateCommissionsTable.month, month),
          eq(affiliateCommissionsTable.status, 'pending'),
        ),
      );

    await tx.insert(auditLogTable).values({
      actorId,
      action:   'commission_void',
      metadata: { affiliateId, referredUserId, month, reason },
    });
  });
}
