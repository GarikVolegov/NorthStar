/**
 * scene_cards — contenuto del deck "Lo Specchio" (preferenze rivelate).
 *
 * Ogni card è un MOMENTO reale di lavoro (non una domanda astratta) che l'utente
 * swipe ↑accende / ↓spegne / →salva. Contenuto pubblico, NESSUNA PII.
 */
import {
  pgTable, serial, text, jsonb, boolean, timestamp, index,
} from "drizzle-orm/pg-core";

export const sceneCardsTable = pgTable(
  "scene_cards",
  {
    id: serial("id").primaryKey(),

    // "È venerdì sera, un sistema è andato giù e hai 4 ore per capirlo."
    prompt:   text("prompt").notNull(),
    imageUrl: text("image_url"),

    // dimensioni RIASEC caricate da una reazione positiva alla scena
    riasecWeights: jsonb("riasec_weights").$type<Record<string, number>>().notNull().default({}),

    linkedSectorIds: text("linked_sector_ids").array().notNull().default([]),
    linkedRoleIds:   text("linked_role_ids").array().notNull().default([]),
    tags:            text("tags").array().notNull().default([]),

    active: boolean("active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    activeIdx: index("scene_cards_active_idx").on(t.active),
  }),
);

export type SceneCard    = typeof sceneCardsTable.$inferSelect;
export type NewSceneCard = typeof sceneCardsTable.$inferInsert;
