import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const affiliationLeadsTable = pgTable("affiliation_leads", {
  id: serial("id").primaryKey(),
  institutionName: text("institution_name").notNull(),
  partnerType: text("partner_type").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  message: text("message"),
  estimatedUsers: text("estimated_users"),
  status: text("status").notNull().default("nuovo"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AffiliationLead = typeof affiliationLeadsTable.$inferSelect;
