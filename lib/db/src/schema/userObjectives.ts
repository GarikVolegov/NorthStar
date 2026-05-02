import { pgTable, serial, integer, text, boolean, timestamp, date } from "drizzle-orm/pg-core";

export const userObjectivesTable = pgTable("user_objectives", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  text: text("text").notNull(),
  category: text("category").notNull().default("altro"),
  progress: integer("progress").notNull().default(0),
  dueDate: date("due_date"),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserObjective = typeof userObjectivesTable.$inferSelect;
