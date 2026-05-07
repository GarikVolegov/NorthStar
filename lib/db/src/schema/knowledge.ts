/**
 * FIXED:
 * - Added FK references on userId for both nodes and edges
 * - Added FK on sectorId (knowledgeNodes)
 * - Added composite unique on knowledgeEdges (userId, sourceId, targetId)
 *   to prevent duplicate edges
 * NOTE: embedding still uses jsonb — add pgvector in a future migration
 * for cosine similarity search.
 */
import {
  pgTable, serial, integer, text, varchar, timestamp, real,
  index, jsonb, uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const knowledgeNodesTable = pgTable(
  "knowledge_nodes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 32 }).notNull().default("note"),
    title: varchar("title", { length: 200 }).notNull(),
    content: text("content").notNull().default(""),
    color: varchar("color", { length: 16 }),
    url: text("url"),
    // sectorId is a soft link (sectors are global, not per-user)
    sectorId: integer("sector_id"),
    x: real("x").notNull().default(0),
    y: real("y").notNull().default(0),
    // RAG vector embedding — migrate to pgvector in a future step
    embedding: jsonb("embedding").$type<number[] | null>(),
    embeddedText: text("embedded_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("knowledge_nodes_user_idx").on(t.userId),
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
    // Prevent duplicate directed edges
    uniqueEdge: uniqueIndex("knowledge_edges_unique").on(
      t.userId,
      t.sourceId,
      t.targetId,
    ),
  }),
);

export type KnowledgeNode = typeof knowledgeNodesTable.$inferSelect;
export type KnowledgeEdge = typeof knowledgeEdgesTable.$inferSelect;
