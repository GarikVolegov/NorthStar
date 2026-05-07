import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const linkedinImportsTable = pgTable("linkedin_imports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  rawText: text("raw_text").notNull(),
  extractedData: jsonb("extracted_data").notNull(),
  certsImported: integer("certs_imported").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LinkedinImport = typeof linkedinImportsTable.$inferSelect;
