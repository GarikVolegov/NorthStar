import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { professionsTable } from "./professions";
import { educationPathsTable } from "./educationPaths";

export const professionEducationPathsTable = pgTable("profession_education_paths", {
  id:              serial("id").primaryKey(),
  professionId:    integer("profession_id").notNull().references(() => professionsTable.id),
  educationPathId: integer("education_path_id").notNull().references(() => educationPathsTable.id),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProfessionEducationPath = typeof professionEducationPathsTable.$inferSelect;
export type NewProfessionEducationPath = typeof professionEducationPathsTable.$inferInsert;
