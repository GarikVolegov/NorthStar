import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const newsSubscriptionsTable = pgTable(
  "news_subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userCategoryIdx: uniqueIndex("news_subs_user_cat_idx").on(t.userId, t.category),
  }),
);

export type NewsSubscription = typeof newsSubscriptionsTable.$inferSelect;
export type NewNewsSubscription = typeof newsSubscriptionsTable.$inferInsert;
