/**
 * FIXED: added index on email for dedup queries.
 */
import {
  pgTable, serial, text, timestamp, boolean, index, integer,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

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
    read: boolean("read").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true }),
    internalNotes: text("internal_notes"),
    assignedTo: integer("assigned_to").references(() => usersTable.id, {
      onDelete: "set null",
    }),
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
    statusIdx: index("affiliation_leads_status_idx").on(t.status),
    readIdx: index("affiliation_leads_read_idx").on(t.read),
    assignedToIdx: index("affiliation_leads_assigned_to_idx").on(t.assignedTo),
    createdAtIdx: index("affiliation_leads_created_at_idx").on(t.createdAt),
  }),
);

export type AffiliationLead = typeof affiliationLeadsTable.$inferSelect;
export type InsertAffiliationLead = typeof affiliationLeadsTable.$inferInsert;
