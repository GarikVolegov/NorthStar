/**
 * FIXED: added FK references on userId and objectiveId.
 * Previously these were bare integers with no referential integrity.
 */
import {
  pgTable, serial, integer, text, timestamp, jsonb, boolean,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { userObjectivesTable } from "./userObjectives";

export const nftCertificatesTable = pgTable("nft_certificates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  objectiveId: integer("objective_id")
    .notNull()
    .references(() => userObjectivesTable.id, { onDelete: "cascade" }),
  objectiveText: text("objective_text").notNull(),
  userName: text("user_name").notNull(),
  category: text("category").notNull().default("altro"),
  certificateHash: text("certificate_hash").notNull().unique(),
  metadata: jsonb("metadata").notNull().default({}),
  imageUrl: text("image_url"),
  txHash: text("tx_hash"),
  chain: text("chain").notNull().default("northstar-chain"),
  status: text("status").notNull().default("minted"),
  mintedAt: timestamp("minted_at", { withTimezone: true }).notNull().defaultNow(),
  isPublic: boolean("is_public").notNull().default(true),
});

export type NftCertificate = typeof nftCertificatesTable.$inferSelect;
