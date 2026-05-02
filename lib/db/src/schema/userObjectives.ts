import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const userObjectivesTable = pgTable("user_objectives", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  text: text("text").notNull(),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserObjective = typeof userObjectivesTable.$inferSelect;
