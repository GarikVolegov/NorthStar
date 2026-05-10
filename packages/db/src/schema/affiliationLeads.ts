/**
 * FIXED: added index on email for dedup queries.
 */
import {
  pgTable, serial, text, timestamp, boolean, index,
} from "drizzle-orm/pg-core";

export const affiliationLeadsTable = pgTable(
  "affiliation_leads",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name"),
    source: text("source").notNull().default("direct"),
    status: text("status", { enum: ["pending", "contacted", "converted", "rejected"] })
      .notNull()
      .default("pending"),
    notes: text("notes"),
    converted: boolean("converted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // ADDED: look up leads by email efficiently
    emailIdx: index("affiliation_leads_email_idx").on(t.email),
  }),
);

export type AffiliationLead = typeof affiliationLeadsTable.$inferSelect;
export type InsertAffiliationLead = typeof affiliationLeadsTable.$inferInsert;
