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
 * Mounting in app.ts (già configurato):
 *   app.post('/api/webhooks/stripe',
 *     express.raw({ type: 'application/json' }),
 *     stripeWebhookHandler
 *   );
 *
 * Events gestiti:
 *   - invoice.paid                    → primo pagamento: conferma referral
 *                                        rinnovo: commissione mensile affiliato
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
import { cancelReferral } from '../../lib/affiliate/referralService.js';
import { applyMonthlyCommission } from '../../lib/affiliate/commissionService.js';
import { processPostPaymentReferral } from '../../lib/affiliate/referralCodeService.js';
import { captureError, addBreadcrumb } from '../../lib/sentry.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// ── Helper: trova utente NorthStar da Stripe customerId ──────────────────
async function findUserByStripeCustomerId(
  customerId: string,
): Promise<{ id: number } | null> {
  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.stripeCustomerId, customerId))
    .limit(1);
  return user ?? null;
}

// ── Helper: calcola mese corrente YYYY-MM ──────────────────────────────
function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

// ── Main handler ───────────────────────────────────────────────────
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
    captureError(err, { path: '/api/webhooks/stripe', eventType: 'signature_verification_failed' });
    res.status(400).json({ error: `Webhook signature verification failed: ${message}` });
    return;
  }

  // Breadcrumb Sentry: tracceremo ogni step del processing
  addBreadcrumb('stripe', `event received: ${event.type}`, { eventId: event.id });

  // TODO: dedup via Redis
  // const alreadyProcessed = await redis.get(`stripe:event:${event.id}`);
  // if (alreadyProcessed) { res.json({ received: true, skipped: true }); return; }

  try {
    switch (event.type) {
      // ── invoice.paid ──────────────────────────────────────────────────
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const ipAddress = req.ip ?? 'webhook';

        const user = await findUserByStripeCustomerId(customerId);
        if (!user) break;

        addBreadcrumb('affiliate', 'user found for invoice.paid', { userId: user.id });

        const [existingReferral] = await db
          .select({ id: affiliateReferralsTable.id, status: affiliateReferralsTable.status, affiliateId: affiliateReferralsTable.affiliateId })
          .from(affiliateReferralsTable)
          .where(eq(affiliateReferralsTable.referredUserId, user.id))
          .limit(1);

        if (!existingReferral) {
          await processPostPaymentReferral(user.id, invoice.payment_intent as string | undefined);

          const [newReferral] = await db
            .select({ affiliateId: affiliateReferralsTable.affiliateId, status: affiliateReferralsTable.status })
            .from(affiliateReferralsTable)
            .where(eq(affiliateReferralsTable.referredUserId, user.id))
            .limit(1);

          if (newReferral?.status === 'active') {
            const result = await applyMonthlyCommission({
              affiliateId:    newReferral.affiliateId,
              referredUserId: user.id,
              month:          currentMonth(),
              actorId:        null,
              ipAddress,
            });
            if (result === 'duplicate') {
              console.log(`[Stripe webhook] Prima commissione duplicata ignorata: affiliateId=${newReferral.affiliateId} month=${currentMonth()}`);
            }
          }
          break;
        }

        if (existingReferral.status !== 'active') break;

        const result = await applyMonthlyCommission({
          affiliateId:    existingReferral.affiliateId,
          referredUserId: user.id,
          month:          currentMonth(),
          actorId:        null,
          ipAddress,
        });

        if (result === 'duplicate') {
          console.log(`[Stripe webhook] Commissione duplicata ignorata: affiliateId=${existingReferral.affiliateId} month=${currentMonth()}`);
        }
        break;
      }

      // ── customer.subscription.deleted ──────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const user = await findUserByStripeCustomerId(customerId);
        if (!user) break;

        addBreadcrumb('affiliate', 'cancelling referral on subscription deleted', { userId: user.id });

        await cancelReferral({
          referredUserId: user.id,
          reason:         'subscription_deleted',
          actorId:        null,
        });
        break;
      }

      default:
        break;
    }

    // TODO: await redis.set(`stripe:event:${event.id}`, '1', 'EX', 86400);
    res.json({ received: true, eventId: event.id, type: event.type });
  } catch (err) {
    // Invia a Sentry per alert immediato — rispondo 200 per evitare retry Stripe
    captureError(err, {
      path:      '/api/webhooks/stripe',
      eventType: event.type,
      extra:     { eventId: event.id },
    });
    console.error('[Stripe webhook] Errore processing event:', event.id, err);
    res.json({ received: true, error: 'Processing error — check logs' });
  }
}
