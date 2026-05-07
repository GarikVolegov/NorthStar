/**
 * FIXED: added userId FK with CASCADE DELETE.
 */
import { pgTable, serial, integer, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const linkedinImportsTable = pgTable(
  "linkedin_imports",
  {
    id: serial("id").primaryKey(),
    // FIXED: was bare integer
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    rawText: text("raw_text").notNull(),
    extractedData: jsonb("extracted_data").notNull(),
    certsImported: integer("certs_imported").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("linkedin_imports_user_idx").on(t.userId),
  }),
);

export type LinkedinImport = typeof linkedinImportsTable.$inferSelect;
