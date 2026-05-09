import Stripe from 'stripe';

/**
 * Singleton Stripe client — usa questo ovunque nel server.
 * Istanziato una sola volta al boot del modulo.
 * Se STRIPE_SECRET_KEY manca, lancia al primo import (fail-fast).
 */
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('[stripeClient] STRIPE_SECRET_KEY environment variable is required');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * @deprecated Usa `stripe` singleton direttamente.
 * Mantenuto per backwards compat con codice legacy.
 */
export async function getUncachableStripeClient(): Promise<InstanceType<typeof Stripe>> {
  return stripe;
}
