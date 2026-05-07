import { pgTable, serial, integer, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

export const nftCertificatesTable = pgTable("nft_certificates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  objectiveId: integer("objective_id").notNull(),
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
