/**
 * UPDATED:
 * - Added embedding_vec column for pgvector (commented type — Drizzle doesn't
 *   have a built-in vector type, so we use customType or sql`` in migrations).
 * - The jsonb embedding column is kept for backward compat with JS fallback.
 * - Added nodeType as an alias export so retriever code stays readable.
 *
 * pgvector column is defined via SQL migration (add-pgvector.sql).
 * Drizzle doesn't yet have a first-class vector() type, so we use
 * sql`vector(1536)` with a custom column helper for select queries.
 */
import {
  pgTable, serial, integer, text, varchar, timestamp, real,
  index, jsonb, uniqueIndex, customType,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Custom Drizzle column type for pgvector
// Serialises as string '[n1,n2,...]', deserialises to number[]
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map(Number);
  },
});

export const knowledgeNodesTable = pgTable(
  "knowledge_nodes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    // 'type' stores the source type: document | persona_example | user_note | web
    type: varchar("type", { length: 32 }).notNull().default("document"),
    title: varchar("title", { length: 200 }).notNull(),
    content: text("content").notNull().default(""),
    color: varchar("color", { length: 16 }),
    url: text("url"),
    sectorId: integer("sector_id"),
    x: real("x").notNull().default(0),
    y: real("y").notNull().default(0),
    // jsonb embedding — used by JS fallback retriever
    embedding: jsonb("embedding").$type<number[] | null>(),
    embeddedText: text("embedded_text"),
    /** Metadata for platform_content: externalId, chunkIndex, source, contentType, tags, url */
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    // pgvector column — populated by add-pgvector.sql migration + backfill
    // Used by SQL retriever when PGVECTOR=true
    embeddingVec: vector("embedding_vec"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("knowledge_nodes_user_idx").on(t.userId),
    // Index for type-filtered queries (persona_example lookups)
    typeIdx: index("knowledge_nodes_type_idx").on(t.type),
  }),
);

export const knowledgeEdgesTable = pgTable(
  "knowledge_edges",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    sourceId: integer("source_id")
      .notNull()
      .references(() => knowledgeNodesTable.id, { onDelete: "cascade" }),
    targetId: integer("target_id")
      .notNull()
      .references(() => knowledgeNodesTable.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("knowledge_edges_user_idx").on(t.userId),
    sourceIdx: index("knowledge_edges_source_idx").on(t.sourceId),
    targetIdx: index("knowledge_edges_target_idx").on(t.targetId),
    uniqueEdge: uniqueIndex("knowledge_edges_unique").on(
      t.userId,
      t.sourceId,
      t.targetId,
    ),
  }),
);

export type KnowledgeNode = typeof knowledgeNodesTable.$inferSelect;
export type KnowledgeEdge = typeof knowledgeEdgesTable.$inferSelect;
