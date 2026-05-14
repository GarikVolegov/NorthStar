import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { friendshipsTable } from "./friendships";
import { usersTable } from "./users";

export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  friendshipId: integer("friendship_id")
    .notNull()
    .references(() => friendshipsTable.id, { onDelete: "cascade" }),
  senderId: integer("sender_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  encryptedContent: text("encrypted_content").notNull(),
  iv: text("iv").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
});

export const insertChatMessageSchema = createInsertSchema(chatMessagesTable).omit({
  id: true,
  createdAt: true,
});

export type ChatMessage = typeof chatMessagesTable.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
