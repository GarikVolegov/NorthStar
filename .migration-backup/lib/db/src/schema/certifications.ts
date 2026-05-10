/**
 * FIXED:
 * - Added userId FK with CASCADE DELETE
 * - Added index on userId for per-user queries
 * - Added index on (userId, status) for filtered queries ("active certs")
 */
import {
  pgTable, serial, integer, text, timestamp, boolean, date, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const certificationsTable = pgTable(
  "certifications",
  {
    id: serial("id").primaryKey(),
    // FIXED: was bare integer, now FK
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    issuer: text("issuer").notNull(),
    issuedDate: date("issued_date"),
    expiryDate: date("expiry_date"),
    credentialUrl: text("credential_url"),
    credentialId: text("credential_id"),
    status: text("status", { enum: ["active", "expired", "revoked"] })
      .notNull()
      .default("active"),
    sector: text("sector"),
    skills: text("skills").array().notNull().default([]),
    verified: boolean("verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("certifications_user_idx").on(t.userId),
    // Common query: "show me my active certifications"
    userStatusIdx: index("certifications_user_status_idx").on(
      t.userId,
      t.status,
    ),
  }),
);

export type Certification = typeof certificationsTable.$inferSelect;
