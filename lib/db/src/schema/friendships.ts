/**
 * Extracted friendships table from users.ts into its own file.
 * FIXED: added unique constraint on (requesterId, receiverId)
 * to prevent duplicate friendship requests.
 */
import {
  pgTable, serial, integer, text, timestamp, uniqueIndex,
} from "drizzle-orm/pg-core";
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
