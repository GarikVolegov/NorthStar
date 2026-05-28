import { index, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { professionsTable } from "./professions";
import { usersTable } from "./users";

export const simulatedDaysTable = pgTable(
  "simulated_days",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    professionId: integer("profession_id")
      .notNull()
      .references(() => professionsTable.id, { onDelete: "cascade" }),
    roleTitle: text("role_title").notNull(),
    sector: text("sector").notNull(),
    scenesJson: jsonb("scenes_json").notNull(),
    responsesJson: jsonb("responses_json"),
    debriefJson: jsonb("debrief_json"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userProfessionCreatedIdx: index("simulated_days_user_profession_created_idx").on(
      t.userId,
      t.professionId,
      t.createdAt,
    ),
    userCompletedIdx: index("simulated_days_user_completed_idx").on(t.userId, t.completedAt),
  }),
);

export type SimulatedDay = typeof simulatedDaysTable.$inferSelect;
export type NewSimulatedDay = typeof simulatedDaysTable.$inferInsert;
