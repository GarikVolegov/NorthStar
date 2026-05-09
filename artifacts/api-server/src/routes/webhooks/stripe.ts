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
 *   - invoice.paid                      → primo pagamento: conferma referral
 *                                          rinnovo: commissione mensile affiliato
 *   - customer.subscription.updated     → aggiorna stripeSubscriptionId su users
 *   - customer.subscription.created     → aggiorna stripeSubscriptionId su users
 *   - customer.subscription.deleted     → cancella referral attivo
 *
 * Idempotency:
 *   Redis dedup: stripeEventId → processed (TTL 24h).
 *   Fallback graceful se REDIS_URL non configurato (log warning).
 *   Operazioni DB rimangono idempotenti (onConflictDoNothing) come seconda linea.
 *
 * Test locale:
 *   stripe listen --forward-to localhost:8080/api/webhooks/stripe
 *   stripe trigger invoice.paid
 *   stripe trigger customer.subscription.updated
 */

import type { Request, Response } from 'express';
import Stripe from 'stripe';
import Redis from 'ioredis';
import { db } from '@workspace/db';
import {
  affiliateReferralsTable,
  usersTable,
} from '@workspace/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from '../../stripeClient.js';
import { cancelReferral } from '../lib/affiliate/referralService.js';
import { applyMonthlyCommission } from '../lib/affiliate/commissionService.js';
import { processPostPaymentReferral } from '../lib/affiliate/referralCodeService.js';
import { captureError, addBreadcrumb } from '../../lib/sentry.js';

// ── Redis singleton per idempotency ────────────────────────────────────────
// Fallback graceful se REDIS_URL non configurato: log warning, skip dedup.
let redis: Redis | null = null;
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: false,
    lazyConnect: true,
  });
  redis.on('error', (err) => {
    // Non crashare il server se Redis è down — degraded mode
    console.warn('[stripe webhook] Redis error (idempotency degraded):', err.message);
  });
} else {
  console.warn('[stripe webhook] REDIS_URL non configurato — idempotency Redis disabilitata. Configura REDIS_URL su Railway per produzione.');
}

// ── Helper: idempotency check ──────────────────────────────────────────────
async function isAlreadyProcessed(eventId: string): Promise<boolean> {
  if (!redis) return false;
  try {
    const result = await redis.get(`stripe:event:${eventId}`);
    return result !== null;
  } catch {
    return false; // degraded: processa comunque
  }
}

async function markAsProcessed(eventId: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(`stripe:event:${eventId}`, '1', 'EX', 86400); // TTL 24h
  } catch {
    // degraded: non bloccare il flusso
  }
}

// ── Helper: trova utente NorthStar da Stripe customerId ───────────────────
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

// ── Helper: calcola mese corrente YYYY-MM ──────────────────────────────────
function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

// ── Main handler ───────────────────────────────────────────────────────────
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

  // ── Idempotency check Redis ────────────────────────────────────────────
  if (await isAlreadyProcessed(event.id)) {
    console.log(`[stripe webhook] Evento già processato, skip: ${event.id}`);
    res.json({ received: true, skipped: true, eventId: event.id });
    return;
  }

  addBreadcrumb('stripe', `event received: ${event.type}`, { eventId: event.id });

  try {
    switch (event.type) {

      // ── invoice.paid ────────────────────────────────────────────────────
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const amountCents = invoice.amount_paid;
        const ipAddress = req.ip ?? 'webhook';

        const user = await findUserByStripeCustomerId(customerId);
        if (!user) break;

        addBreadcrumb('affiliate', 'user found for invoice.paid', { userId: user.id });

        const [existingReferral] = await db
          .select({
            id: affiliateReferralsTable.id,
            status: affiliateReferralsTable.status,
            affiliateId: affiliateReferralsTable.affiliateId,
          })
          .from(affiliateReferralsTable)
          .where(eq(affiliateReferralsTable.referredUserId, user.id))
          .limit(1);

        if (!existingReferral) {
          // Primo pagamento: prova a confermare referral da codice signup
          await processPostPaymentReferral(user.id);

          const [newReferral] = await db
            .select({
              affiliateId: affiliateReferralsTable.affiliateId,
              status: affiliateReferralsTable.status,
            })
            .from(affiliateReferralsTable)
            .where(eq(affiliateReferralsTable.referredUserId, user.id))
            .limit(1);

          if (newReferral?.status === 'active') {
            const result = await applyMonthlyCommission({
              affiliateId:    newReferral.affiliateId,
              referredUserId: user.id,
              month:          currentMonth(),
              amountCents,
              actorId:        null,
              ipAddress,
            });
            if (result === 'duplicate') {
              console.log(`[stripe webhook] Prima commissione duplicata ignorata: affiliateId=${newReferral.affiliateId} month=${currentMonth()}`);
            }
          }
          break;
        }

        if (existingReferral.status !== 'active') break;

        // Rinnovo mensile: applica commissione
        const result = await applyMonthlyCommission({
          affiliateId:    existingReferral.affiliateId,
          referredUserId: user.id,
          month:          currentMonth(),
          amountCents,
          actorId:        null,
          ipAddress,
        });

        if (result === 'duplicate') {
          console.log(`[stripe webhook] Commissione duplicata ignorata: affiliateId=${existingReferral.affiliateId} month=${currentMonth()}`);
        }
        break;
      }

      // ── customer.subscription.updated / created ─────────────────────────
      // Aggiorna stripeSubscriptionId su users per mantenere sincronizzazione.
      // Prima gestito da webhookHandlers.ts (dead code) — ora consolidato qui.
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        addBreadcrumb('stripe', `subscription ${event.type}`, { subscriptionId: sub.id });

        await db
          .update(usersTable)
          .set({ stripeSubscriptionId: sub.id })
          .where(eq(usersTable.stripeCustomerId, customerId));

        console.log(`[stripe webhook] stripeSubscriptionId aggiornato: ${sub.id} per customer ${customerId}`);
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

    // Marca evento come processato su Redis
    await markAsProcessed(event.id);

    res.json({ received: true, eventId: event.id, type: event.type });
  } catch (err) {
    // Risponde 200 per evitare retry Stripe — l'errore è loggato su Sentry.
    // Se il processing fallisce ripetutamente, investigare da Sentry dashboard.
    captureError(err, {
      path:      '/api/webhooks/stripe',
      eventType: event.type,
      extra:     { eventId: event.id },
    });
    console.error('[stripe webhook] Errore processing event:', event.id, err);
    res.json({ received: true, error: 'Processing error — check Sentry' });
  }
}
