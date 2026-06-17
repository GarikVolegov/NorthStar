import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const wendyNeuralActivationsTable = pgTable(
  "wendy_neural_activations",
  {
    id: serial("id").primaryKey(),
    requestId: varchar("request_id", { length: 120 }).notNull(),
    itemKind: varchar("item_kind", { length: 64 }),
    itemRef: text("item_ref"),
    label: varchar("label", { length: 240 }),
    score: real("score").notNull().default(0),
    selected: boolean("selected").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    requestIdx: index("wendy_neural_activations_request_idx").on(t.requestId, t.createdAt),
    uniqueActivation: uniqueIndex("wendy_neural_activations_unique_idx").on(t.requestId, t.itemRef),
  }),
);

export const wendyNeuralEdgesTable = pgTable(
  "wendy_neural_edges",
  {
    id: serial("id").primaryKey(),
    sourceItemKind: varchar("source_item_kind", { length: 64 }),
    sourceItemRef: text("source_item_ref"),
    targetItemKind: varchar("target_item_kind", { length: 64 }),
    targetItemRef: text("target_item_ref"),
    weight: real("weight").notNull().default(0),
    status: varchar("status", { length: 24 }).notNull().default("candidate"),
    evidenceCount: integer("evidence_count").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    lastReinforcedAt: timestamp("last_reinforced_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index("wendy_neural_edges_status_idx").on(t.status, t.weight),
    sourceIdx: index("wendy_neural_edges_source_idx").on(t.sourceItemKind, t.sourceItemRef),
  }),
);

export type WendyNeuralActivation = typeof wendyNeuralActivationsTable.$inferSelect;
export type NewWendyNeuralActivation = typeof wendyNeuralActivationsTable.$inferInsert;
export type WendyNeuralEdge = typeof wendyNeuralEdgesTable.$inferSelect;
export type NewWendyNeuralEdge = typeof wendyNeuralEdgesTable.$inferInsert;
