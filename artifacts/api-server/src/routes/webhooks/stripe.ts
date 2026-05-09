/**
 * stripe.ts — Webhook handler Stripe.
 *
 * ⚠️  REGOLA 0: vedi API_RULES.md prima di modificare.
 *
 * IMPORTANTE: questa route deve essere montata PRIMA del middleware
 * express.json() globale, con express.raw({ type: 'application/json' }).
 * Stripe verifica la firma sul body grezzo — se il body è già stato
 * parsato da JSON middleware, la firma non corrisponde.
 *
 * Mounting in index.ts:
 *   app.post('/api/webhooks/stripe',
 *     express.raw({ type: 'application/json' }),
 *     stripeWebhookHandler
 *   );
 *
 * Events gestiti:
 *   - invoice.paid                    → commissione mensile affiliato
 *   - customer.subscription.deleted   → cancella referral attivo
 *
 * Idempotency:
 *   Stripe può inviare lo stesso evento più volte.
 *   TODO: implementare dedup via Redis (stripeEventId → processed)
 *   Per ora: le operazioni DB sono idempotenti (onConflictDoNothing).
 *
 * Test locale:
 *   stripe listen --forward-to localhost:8080/api/webhooks/stripe
 *   stripe trigger invoice.paid
 */

import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { db } from '@workspace/db';
import {
  affiliateReferralsTable,
  usersTable,
} from '@workspace/db/schema';
import { eq } from 'drizzle-orm';
import { confirmReferral, cancelReferral } from '../lib/affiliate/referralService.js';
import { applyMonthlyCommission } from '../lib/affiliate/commissionService.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// ── Helper: trova utente NorthStar da Stripe customerId ──────────────────────
async function findUserByStripeCustomerId(
  customerId: string,
): Promise<{ id: number; referralCode?: string | null } | null> {
  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq((usersTable as any).stripeCustomerId, customerId))
    .limit(1);
  return user ?? null;
}

// ── Helper: calcola mese corrente YYYY-MM ────────────────────────────────────
function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function stripeWebhookHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const sig = req.headers['stripe-signature'] as string | undefined;

  if (!sig) {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(400).json({ error: `Webhook signature verification failed: ${message}` });
    return;
  }

  // TODO: dedup via Redis
  // const alreadyProcessed = await redis.get(`stripe:event:${event.id}`);
  // if (alreadyProcessed) { res.json({ received: true, skipped: true }); return; }

  try {
    switch (event.type) {
      // ── invoice.paid ───────────────────────────────────────────────────────
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const paymentIntentId = invoice.payment_intent as string | null;
        const ipAddress = req.ip;

        const user = await findUserByStripeCustomerId(customerId);
        if (!user) break;

        // 1. Controlla se è il primo pagamento (nessun referral esistente)
        const [existingReferral] = await db
          .select({ id: affiliateReferralsTable.id })
          .from(affiliateReferralsTable)
          .where(eq(affiliateReferralsTable.referredUserId, user.id))
          .limit(1);

        if (!existingReferral) {
          // Primo pagamento — controlla se aveva un referral code in registrazione
          // TODO: leggere referralCode da users.referredBy (colonna da aggiungere in Fase 2)
          // Per ora: skip confirmReferral se referredBy non è presente
          // referralService.confirmReferral(...);
          break;
        }

        // 2. Referral già confermato — applica commissione mensile
        if (existingReferral) {
          const [referral] = await db
            .select()
            .from(affiliateReferralsTable)
            .where(eq(affiliateReferralsTable.referredUserId, user.id))
            .limit(1);

          if (referral?.status !== 'active') break;

          const result = await applyMonthlyCommission({
            affiliateId:    referral.affiliateId,
            referredUserId: user.id,
            month:          currentMonth(),
            actorId:        null,
            ipAddress,
          });

          // Log silenzioso per duplicate — è normale in caso di retry Stripe
          if (result === 'duplicate') {
            console.log(`[Stripe webhook] Commissione duplicata ignorata: affiliateId=${referral.affiliateId} month=${currentMonth()}`);
          }
        }
        break;
      }

      // ── customer.subscription.deleted ─────────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const user = await findUserByStripeCustomerId(customerId);
        if (!user) break;

        await cancelReferral({
          referredUserId: user.id,
          reason:         'subscription_deleted',
          actorId:        null,
        });
        break;
      }

      default:
        // Event non gestito — rispondi 200 per evitare retry Stripe
        break;
    }

    // TODO: await redis.set(`stripe:event:${event.id}`, '1', 'EX', 86400);
    res.json({ received: true, eventId: event.id, type: event.type });
  } catch (err) {
    console.error('[Stripe webhook] Errore processing event:', event.id, err);
    // Rispondi 200 comunque — Stripe fa retry su 5xx, non su 2xx
    // Loggare l'errore in Sentry per indagine manuale
    res.json({ received: true, error: 'Processing error — check logs' });
  }
}
