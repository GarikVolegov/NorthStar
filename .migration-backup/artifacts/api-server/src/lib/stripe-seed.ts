/**
 * stripe-seed.ts — Inizializzazione prodotti Stripe al boot
 *
 * Crea in Stripe (se non esistono) i prodotti e prezzi NorthStar Premium,
 * poi li sincronizza nello schema PostgreSQL `stripe.*` usato da storage.ts.
 *
 * Regole:
 *   - Idempotente: usa `metadata.northstar_plan` per trovare prodotti già esistenti
 *   - Safe: se STRIPE_SECRET_KEY non è configurata, salta silenziosamente
 *   - Non blocca il boot: gli errori vengono loggati senza crashare il server
 *
 * Prezzi creati (solo se Stripe è configurata e non esistono già):
 *   - NorthStar Premium Mensile  → €9,90/mese   (lookup_key: northstar_premium_monthly)
 *   - NorthStar Premium Annuale  → €79,00/anno   (lookup_key: northstar_premium_yearly)
 */

import Stripe from 'stripe';
import { db } from '@workspace/db';
import { sql } from 'drizzle-orm';
import { logger } from './logger.js';

// ─── Configurazione prodotti/prezzi da creare ─────────────────────────────────

const PRODUCT_CONFIG = {
  name: 'NorthStar Premium',
  description: 'Accesso completo alle funzionalità Premium di NorthStar: AI illimitata, test RIASEC avanzato, roadmap personalizzate, coaching Wendy, e molto altro.',
  metadata: {
    northstar_plan: 'premium',
    tier: '1',
  },
} as const;

const PRICE_CONFIGS = [
  {
    lookupKey: 'northstar_premium_monthly',
    nickname: 'NorthStar Premium Mensile',
    unitAmount: 990,        // €9,90 in centesimi
    currency: 'eur',
    interval: 'month' as const,
    intervalCount: 1,
    trialPeriodDays: 7,
    metadata: { period: 'monthly' },
  },
  {
    lookupKey: 'northstar_premium_yearly',
    nickname: 'NorthStar Premium Annuale',
    unitAmount: 7900,       // €79,00 in centesimi
    currency: 'eur',
    interval: 'year' as const,
    intervalCount: 1,
    trialPeriodDays: 7,
    metadata: { period: 'yearly' },
  },
] as const;

// ─── Sync locale: product + prices → stripe.* schema ─────────────────────────

async function syncProductToDb(product: Stripe.Product): Promise<void> {
  await db.execute(sql`
    INSERT INTO stripe.products (id, name, description, active, metadata, created, updated)
    VALUES (
      ${product.id},
      ${product.name},
      ${product.description ?? null},
      ${product.active},
      ${JSON.stringify(product.metadata)}::jsonb,
      to_timestamp(${product.created}),
      to_timestamp(${product.updated ?? product.created})
    )
    ON CONFLICT (id) DO UPDATE SET
      name        = EXCLUDED.name,
      description = EXCLUDED.description,
      active      = EXCLUDED.active,
      metadata    = EXCLUDED.metadata,
      updated     = EXCLUDED.updated
  `);
}

async function syncPriceToDb(price: Stripe.Price): Promise<void> {
  await db.execute(sql`
    INSERT INTO stripe.prices (id, product, unit_amount, currency, recurring, active, metadata, created, updated)
    VALUES (
      ${price.id},
      ${typeof price.product === 'string' ? price.product : price.product.id},
      ${price.unit_amount ?? null},
      ${price.currency},
      ${JSON.stringify(price.recurring ?? null)}::jsonb,
      ${price.active},
      ${JSON.stringify(price.metadata)}::jsonb,
      to_timestamp(${price.created}),
      to_timestamp(${price.created})
    )
    ON CONFLICT (id) DO UPDATE SET
      unit_amount = EXCLUDED.unit_amount,
      currency    = EXCLUDED.currency,
      recurring   = EXCLUDED.recurring,
      active      = EXCLUDED.active,
      metadata    = EXCLUDED.metadata,
      updated     = NOW()
  `);
}

// ─── Funzione principale ───────────────────────────────────────────────────────

export async function seedStripeProducts(): Promise<void> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    logger.warn('[stripe-seed] STRIPE_SECRET_KEY non configurata — seed Stripe saltato');
    return;
  }

  const stripe = new Stripe(secretKey);

  try {
    // 1. Cerca prodotti NorthStar già esistenti su Stripe (per metadata)
    const existing = await stripe.products.search({
      query: `metadata['northstar_plan']:'premium' AND active:'true'`,
      limit: 1,
    });

    let product: Stripe.Product;

    if (existing.data.length > 0) {
      product = existing.data[0];
      logger.info(
        { productId: product.id, productName: product.name },
        '[stripe-seed] Prodotto NorthStar Premium già esistente in Stripe',
      );
    } else {
      // 2. Crea il prodotto se non esiste
      product = await stripe.products.create({
        name: PRODUCT_CONFIG.name,
        description: PRODUCT_CONFIG.description,
        metadata: PRODUCT_CONFIG.metadata,
      });
      logger.info(
        { productId: product.id },
        '[stripe-seed] Prodotto NorthStar Premium creato in Stripe',
      );
    }

    // 3. Sincronizza il prodotto nel DB locale
    await syncProductToDb(product);

    // 4. Per ogni prezzo configurato: trova o crea, poi sincronizza
    for (const priceConfig of PRICE_CONFIGS) {
      // Cerca per lookup_key (stabile, non cambia tra deploy)
      let price: Stripe.Price | null = null;

      try {
        const byKey = await stripe.prices.list({
          lookup_keys: [priceConfig.lookupKey],
          active: true,
          limit: 1,
        });
        if (byKey.data.length > 0) {
          price = byKey.data[0];
          logger.info(
            { priceId: price.id, lookupKey: priceConfig.lookupKey },
            '[stripe-seed] Prezzo già esistente in Stripe',
          );
        }
      } catch {
        // lookup_keys non supportati in alcuni piani Stripe — fallback sotto
      }

      if (!price) {
        price = await stripe.prices.create({
          product: product.id,
          unit_amount: priceConfig.unitAmount,
          currency: priceConfig.currency,
          nickname: priceConfig.nickname,
          lookup_key: priceConfig.lookupKey,
          transfer_lookup_key: true,   // sostituisce eventuali lookup_key precedenti
          recurring: {
            interval: priceConfig.interval,
            interval_count: priceConfig.intervalCount,
            trial_period_days: priceConfig.trialPeriodDays,
          },
          metadata: { ...priceConfig.metadata },
        });
        logger.info(
          { priceId: price.id, lookupKey: priceConfig.lookupKey, amount: priceConfig.unitAmount },
          '[stripe-seed] Prezzo creato in Stripe',
        );
      }

      // 5. Sincronizza il prezzo nel DB locale
      await syncPriceToDb(price);
    }

    logger.info('[stripe-seed] Seed Stripe completato — prodotti e prezzi sincronizzati');
  } catch (err) {
    // Non blocca il boot — Stripe non è critica per il funzionamento base
    logger.error({ err }, '[stripe-seed] Errore durante il seed Stripe — server continua normalmente');
  }
}
