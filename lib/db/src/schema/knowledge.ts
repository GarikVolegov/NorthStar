import { pgTable, serial, integer, text, varchar, timestamp, real, index, jsonb } from "drizzle-orm/pg-core";

// Personal "Obsidian-like" knowledge graph: per-user nodes (notes, skills,
// documents, sectors, roles, tools, certifications, links, concepts) and
// directional/labelled edges between them.
export const knowledgeNodesTable = pgTable(
  "knowledge_nodes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    type: varchar("type", { length: 32 }).notNull().default("note"),
    title: varchar("title", { length: 200 }).notNull(),
    content: text("content").notNull().default(""),
    color: varchar("color", { length: 16 }),
    url: text("url"),
    sectorId: integer("sector_id"),
    x: real("x").notNull().default(0),
    y: real("y").notNull().default(0),
    // RAG: vector embedding of (title + content). number[] of 1536 dims (text-embedding-3-small).
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
    userId: integer("user_id").notNull(),
    sourceId: integer("source_id").notNull(),
    targetId: integer("target_id").notNull(),
    label: varchar("label", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("knowledge_edges_user_idx").on(t.userId),
    sourceIdx: index("knowledge_edges_source_idx").on(t.sourceId),
    targetIdx: index("knowledge_edges_target_idx").on(t.targetId),
  }),
);

export type KnowledgeNode = typeof knowledgeNodesTable.$inferSelect;
export type KnowledgeEdge = typeof knowledgeEdgesTable.$inferSelect;
