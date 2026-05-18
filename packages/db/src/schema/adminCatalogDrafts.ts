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

export const adminCatalogDraftsTable = pgTable(
  "admin_catalog_drafts",
  {
    id: serial("id").primaryKey(),
    catalogType: text("catalog_type", {
      enum: ["sectors", "professions", "education_paths", "growth_articles"],
    }).notNull(),
    entityId: integer("entity_id"),
    status: text("status", {
      enum: ["draft", "published", "archived"],
    })
      .notNull()
      .default("draft"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    validation: jsonb("validation").$type<Record<string, unknown>>(),
    notes: text("notes"),
    createdBy: integer("created_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    typeStatusIdx: index("admin_catalog_drafts_type_status_idx").on(
      t.catalogType,
      t.status,
    ),
    entityIdx: index("admin_catalog_drafts_entity_idx").on(t.catalogType, t.entityId),
    createdByIdx: index("admin_catalog_drafts_created_by_idx").on(t.createdBy),
  }),
);

export type AdminCatalogDraft = typeof adminCatalogDraftsTable.$inferSelect;
export type InsertAdminCatalogDraft = typeof adminCatalogDraftsTable.$inferInsert;
