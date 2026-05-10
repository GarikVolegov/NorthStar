import {
  pgTable, serial, integer, text, timestamp, uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { usersTable } from "./users";

export const friendshipsTable = pgTable(
  "friendships",
  {
    id: serial("id").primaryKey(),
    requesterId: integer("requester_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    receiverId: integer("receiver_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["pending", "accepted", "rejected", "blocked"] })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // One friendship request per pair — prevents duplicates
    uniquePair: uniqueIndex("friendships_unique_pair").on(
      t.requesterId,
      t.receiverId,
    ),
  }),
);

export type Friendship = typeof friendshipsTable.$inferSelect;

export const friendshipsRelations = relations(
  friendshipsTable,
  ({ one }) => ({
    requester: one(usersTable, {
      fields: [friendshipsTable.requesterId],
      references: [usersTable.id],
      relationName: "friendships_requester",
    }),
    receiver: one(usersTable, {
      fields: [friendshipsTable.receiverId],
      references: [usersTable.id],
      relationName: "friendships_receiver",
    }),
  }),
);
