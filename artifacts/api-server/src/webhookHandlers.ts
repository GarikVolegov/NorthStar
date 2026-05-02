import Stripe from 'stripe';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    // Handle subscription events to update user records
    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
      const sub = event.data.object as Stripe.Subscription;
      const { db, usersTable } = await import('@workspace/db');
      const { eq, sql } = await import('drizzle-orm');
      await db
        .update(usersTable)
        .set({ stripeSubscriptionId: sub.id })
        .where(eq(usersTable.stripeCustomerId, sub.customer as string));
    }
  }
}
