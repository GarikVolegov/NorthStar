import { sql } from "drizzle-orm";
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
import { usersTable } from "./users";

export type WendyNeuralItemKind =
  | "brain_note"
  | "wendy_brain_node"
  | "personal_memory"
  | "semantic_memory"
  | "tool"
  | "page_context"
  | "rag_chunk"
  | "code_graph";

export type WendyNeuralEdgeStatus = "candidate" | "active" | "archived";

export interface WendyNeuralComponents {
  semantic: number;
  userRelevance: number;
  graphProximity: number;
  recency: number;
  salience: number;
  trust: number;
}

export const wendyNeuralActivationsTable = pgTable(
  "wendy_neural_activations",
  {
    id: serial("id").primaryKey(),
    requestId: text("request_id").notNull(),
    userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
    messageHash: varchar("message_hash", { length: 64 }).notNull(),
    intent: varchar("intent", { length: 32 }).notNull(),
    domain: varchar("domain", { length: 32 }),
    itemKind: varchar("item_kind", { length: 32 }).$type<WendyNeuralItemKind>().notNull(),
    itemRef: text("item_ref").notNull(),
    label: varchar("label", { length: 240 }).notNull(),
    score: real("score").notNull(),
    components: jsonb("components").$type<WendyNeuralComponents>().notNull().default({
      semantic: 0,
      userRelevance: 0,
      graphProximity: 0,
      recency: 0,
      salience: 0,
      trust: 0,
    }),
    selected: boolean("selected").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    requestIdx: index("wendy_neural_activations_request_idx").on(t.requestId),
    userCreatedIdx: index("wendy_neural_activations_user_created_idx").on(t.userId, t.createdAt),
    itemIdx: index("wendy_neural_activations_item_idx").on(t.itemKind, t.itemRef),
  }),
);

export const wendyNeuralEdgesTable = pgTable(
  "wendy_neural_edges",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
    sourceItemKind: varchar("source_item_kind", { length: 32 }).$type<WendyNeuralItemKind>().notNull(),
    sourceItemRef: text("source_item_ref").notNull(),
    targetItemKind: varchar("target_item_kind", { length: 32 }).$type<WendyNeuralItemKind>().notNull(),
    targetItemRef: text("target_item_ref").notNull(),
    relationType: varchar("relation_type", { length: 64 }).notNull().default("co_activated"),
    weight: real("weight").notNull().default(0.1),
    decayScore: real("decay_score").notNull().default(1),
    evidenceCount: integer("evidence_count").notNull().default(1),
    status: varchar("status", { length: 24 }).$type<WendyNeuralEdgeStatus>().notNull().default("candidate"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    lastReinforcedAt: timestamp("last_reinforced_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("wendy_neural_edges_user_idx").on(t.userId, t.status),
    sourceIdx: index("wendy_neural_edges_source_idx").on(t.sourceItemKind, t.sourceItemRef),
    targetIdx: index("wendy_neural_edges_target_idx").on(t.targetItemKind, t.targetItemRef),
    userUniqueIdx: uniqueIndex("wendy_neural_edges_user_unique_idx")
      .on(t.userId, t.sourceItemKind, t.sourceItemRef, t.targetItemKind, t.targetItemRef, t.relationType)
      .where(sql`${t.userId} IS NOT NULL`),
    globalUniqueIdx: uniqueIndex("wendy_neural_edges_global_unique_idx")
      .on(t.sourceItemKind, t.sourceItemRef, t.targetItemKind, t.targetItemRef, t.relationType)
      .where(sql`${t.userId} IS NULL`),
  }),
);

export type WendyNeuralActivation = typeof wendyNeuralActivationsTable.$inferSelect;
export type NewWendyNeuralActivation = typeof wendyNeuralActivationsTable.$inferInsert;
export type WendyNeuralEdge = typeof wendyNeuralEdgesTable.$inferSelect;
export type NewWendyNeuralEdge = typeof wendyNeuralEdgesTable.$inferInsert;
