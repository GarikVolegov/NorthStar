import { pgTable, serial, integer, text, timestamp, boolean, date } from "drizzle-orm/pg-core";

export const certificationsTable = pgTable("certifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  issuer: text("issuer").notNull(),
  issuedDate: date("issued_date"),
  expiryDate: date("expiry_date"),
  credentialUrl: text("credential_url"),
  credentialId: text("credential_id"),
  status: text("status").notNull().default("active"),
  sector: text("sector"),
  skills: text("skills").array().notNull().default([]),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Certification = typeof certificationsTable.$inferSelect;
