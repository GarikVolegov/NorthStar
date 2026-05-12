import {
  pgTable, serial, integer, text, varchar,
  timestamp, real, boolean, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const routeLogsTable = pgTable(
  "route_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    messageHash: varchar("message_hash", { length: 12 }).notNull(),
    domain: varchar("domain", { length: 20 }).notNull(),
    intent: varchar("intent", { length: 20 }).notNull(),
    confidence: real("confidence").notNull(),
    threshold: real("threshold").notNull(),
    reasoning: text("reasoning"),
    isFallback: boolean("is_fallback").notNull().default(false),
    fallbackReason: text("fallback_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("route_logs_user_idx").on(t.userId),
    createdAtIdx: index("route_logs_created_at_idx").on(t.createdAt),
  }),
);
