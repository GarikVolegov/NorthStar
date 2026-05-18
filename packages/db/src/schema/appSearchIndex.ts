import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { vector } from "../custom-types";

export const appSearchIndexTable = pgTable(
  "app_search_index",
  {
    id: serial("id").primaryKey(),
    entityType: text("entity_type", {
      enum: [
        "sector",
        "role",
        "article",
        "news",
        "idea",
        "objective",
        "calendar",
        "certification",
        "memory",
        "workspace",
        "profile",
      ],
    }).notNull(),
    entityId: text("entity_id").notNull(),
    userId: integer("user_id").references(() => usersTable.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    url: text("url").notNull(),
    visibility: text("visibility", {
      enum: ["public", "private"],
    }).notNull().default("public"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    embedding: vector("embedding", { dimensions: 1536 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    visibilityIdx: index("app_search_index_visibility_idx").on(t.visibility),
    userIdx: index("app_search_index_user_idx").on(t.userId),
    typeIdx: index("app_search_index_type_idx").on(t.entityType),
    updatedAtIdx: index("app_search_index_updated_at_idx").on(t.updatedAt),
  }),
);

export type AppSearchIndex = typeof appSearchIndexTable.$inferSelect;
export type NewAppSearchIndex = typeof appSearchIndexTable.$inferInsert;
