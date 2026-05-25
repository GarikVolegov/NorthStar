import { pgTable, integer, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";
import { friendshipsTable } from "./friendships";
import { relations } from "drizzle-orm";

export const userKeysTable = pgTable("user_keys", {
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  publicKey: text("public_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId] }),
}));

export const friendshipKeysTable = pgTable("friendship_keys", {
  friendshipId: integer("friendship_id")
    .notNull()
    .references(() => friendshipsTable.id, { onDelete: "cascade" }),
  keyForRequester: text("key_for_requester").notNull(),
  keyForReceiver: text("key_for_receiver").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.friendshipId] }),
}));

export const userKeysRelations = relations(userKeysTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [userKeysTable.userId],
    references: [usersTable.id],
  }),
}));

export const friendshipKeysRelations = relations(friendshipKeysTable, ({ one }) => ({
  friendship: one(friendshipsTable, {
    fields: [friendshipKeysTable.friendshipId],
    references: [friendshipsTable.id],
  }),
}));

export const insertUserKeySchema = createInsertSchema(userKeysTable);
export const insertFriendshipKeySchema = createInsertSchema(friendshipKeysTable).omit({
  createdAt: true,
});

export type UserKey = typeof userKeysTable.$inferSelect;
export type FriendshipKey = typeof friendshipKeysTable.$inferSelect;
