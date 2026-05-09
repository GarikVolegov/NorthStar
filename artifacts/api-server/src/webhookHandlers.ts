/**
 * @deprecated Questo file è dead code — tutta la logica webhook
 * è stata consolidata in routes/webhooks/stripe.ts.
 *
 * TODO: eliminare in un cleanup sprint successivo.
 * Non montato da app.ts — nessun effetto in produzione.
 */

// File mantenuto vuoto intenzionalmente per evitare import errors
// da eventuali riferimenti residui. Eliminare quando confermato safe.
export class WebhookHandlers {
  /** @deprecated Non usare — usa stripeWebhookHandler da routes/webhooks/stripe.ts */
  static async processWebhook(_payload: Buffer, _signature: string): Promise<void> {
    throw new Error('WebhookHandlers.processWebhook is deprecated. Use stripeWebhookHandler instead.');
  }
}
