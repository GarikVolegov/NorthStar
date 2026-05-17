/**
 * subscriptions — piano attivo per utente/workspace.
 *
 * Sostituisce lo stripeSubscriptionId diretto su usersTable con
 * una tabella dedicata che supporta:
 *   - piani team multi-utente (workspaceId)
 *   - storico piani (un utente può avere più righe, una attiva alla volta)
 *   - cancelledAt per downgrade graceful (dati non cancellati)
 *
 * SECURITY: stripeCustomerId/stripeSubscriptionId mai esposti al client.
 * PRIVACY: nessun dato di pagamento — solo metadati piano.
 */
import {
  pgTable, serial, integer, text, timestamp, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const subscriptionsTable = pgTable(
  "subscriptions",
  {
    id:          serial("id").primaryKey(),
    userId:      integer("user_id")
                   .notNull()
                   .references(() => usersTable.id, { onDelete: "cascade" }),

    // workspaceId presente solo per piani Team (billing aggregato)
    workspaceId: integer("workspace_id"),

    plan:        text("plan", {
                   enum: ["free", "pro", "team"],
                 }).notNull().default("free"),

    // Stripe metadata — mai restituiti al client
    stripeCustomerId:     text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePriceId:        text("stripe_price_id"),

    validUntil:  timestamp("valid_until", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),

    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx:   index("subscriptions_user_idx").on(t.userId),
    stripeIdx: index("subscriptions_stripe_sub_idx").on(t.stripeSubscriptionId),
    planIdx:   index("subscriptions_plan_idx").on(t.plan, t.cancelledAt),
  }),
);

export type Subscription    = typeof subscriptionsTable.$inferSelect;
export type NewSubscription = typeof subscriptionsTable.$inferInsert;
