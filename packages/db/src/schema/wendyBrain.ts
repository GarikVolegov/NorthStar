import {
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
import { vector } from "../custom-types";

export type WendyBrainNodeType =
  | "domain_knowledge"
  | "world_model"
  | "personality_rule"
  | "style_rule"
  | "skill"
  | "playbook"
  | "tool_affordance"
  | "policy"
  | "open_question";

export type WendyBrainStatus = "candidate" | "active" | "archived";

export const wendyBrainNodesTable = pgTable(
  "wendy_brain_nodes",
  {
    id: serial("id").primaryKey(),
    type: varchar("type", { length: 32 }).$type<WendyBrainNodeType>().notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    normalizedTitle: varchar("normalized_title", { length: 240 }).notNull(),
    content: text("content").notNull(),
    status: varchar("status", { length: 24 }).$type<WendyBrainStatus>().notNull().default("candidate"),
    confidence: real("confidence").notNull().default(0.7),
    importance: real("importance").notNull().default(0.5),
    decayScore: real("decay_score").notNull().default(1),
    sourceType: varchar("source_type", { length: 64 }).notNull().default("manual"),
    sourceRef: varchar("source_ref", { length: 160 }).notNull().default("manual"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    embedding: vector("embedding", { dimensions: 1536 }),
    lastReinforcedAt: timestamp("last_reinforced_at", { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: integer("approved_by").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueSourceNode: uniqueIndex("wendy_brain_nodes_unique_source_idx").on(t.type, t.normalizedTitle, t.sourceRef),
    statusIdx: index("wendy_brain_nodes_status_idx").on(t.status, t.type),
    sourceIdx: index("wendy_brain_nodes_source_idx").on(t.sourceType, t.sourceRef),
  }),
);

export const wendyBrainEdgesTable = pgTable(
  "wendy_brain_edges",
  {
    id: serial("id").primaryKey(),
    sourceNodeId: integer("source_node_id").notNull().references(() => wendyBrainNodesTable.id, { onDelete: "cascade" }),
    targetNodeId: integer("target_node_id").notNull().references(() => wendyBrainNodesTable.id, { onDelete: "cascade" }),
    relationType: varchar("relation_type", { length: 64 }).notNull().default("related"),
    status: varchar("status", { length: 24 }).$type<WendyBrainStatus>().notNull().default("candidate"),
    confidence: real("confidence").notNull().default(0.7),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueEdge: uniqueIndex("wendy_brain_edges_unique_idx").on(t.sourceNodeId, t.targetNodeId, t.relationType),
    sourceIdx: index("wendy_brain_edges_source_idx").on(t.sourceNodeId),
    targetIdx: index("wendy_brain_edges_target_idx").on(t.targetNodeId),
  }),
);

export const wendyBrainEventsTable = pgTable(
  "wendy_brain_events",
  {
    id: serial("id").primaryKey(),
    nodeId: integer("node_id").references(() => wendyBrainNodesTable.id, { onDelete: "set null" }),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    sourceType: varchar("source_type", { length: 64 }).notNull(),
    sourceRef: varchar("source_ref", { length: 160 }),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    nodeIdx: index("wendy_brain_events_node_idx").on(t.nodeId),
    eventIdx: index("wendy_brain_events_type_idx").on(t.eventType, t.createdAt),
  }),
);

export type WendyBrainNode = typeof wendyBrainNodesTable.$inferSelect;
export type NewWendyBrainNode = typeof wendyBrainNodesTable.$inferInsert;
export type WendyBrainEdge = typeof wendyBrainEdgesTable.$inferSelect;
export type WendyBrainEvent = typeof wendyBrainEventsTable.$inferSelect;
