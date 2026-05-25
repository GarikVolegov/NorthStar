/**
 * shared_plans — piani di studio condivisi in un workspace.
 *
 * Contiene uno snapshot serializzato degli obiettivi del piano (planData).
 * Non è una FK diretta su user_objectives per permettere fork indipendenti.
 *
 * permissions:
 *   view    → solo lettura
 *   comment → lettura + commenti
 *   fork    → lettura + commenti + clonazione in workspace personale
 */
import {
  pgTable, serial, integer, text, timestamp, jsonb, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { workspacesTable } from "./workspace";

export const sharedPlansTable = pgTable(
  "shared_plans",
  {
    id:          serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
                   .notNull()
                   .references(() => workspacesTable.id, { onDelete: "cascade" }),
    ownerId:     integer("owner_id")
                   .notNull()
                   .references(() => usersTable.id, { onDelete: "cascade" }),

    title:       text("title").notNull(),
    description: text("description"),

    // Snapshot degli obiettivi — aggiornato quando il proprietario sincronizza
    planData:    jsonb("plan_data").$type<{
                   objectives: Array<{
                     id:       number;
                     text:     string;
                     category: string;
                     progress: number;
                     dueDate:  string | null;
                   }>;
                   horizon:    string;
                   journeyType: string;
                 }>(),

    permissions: text("permissions", {
                   enum: ["view", "comment", "fork"],
                 }).notNull().default("comment"),

    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workspaceIdx: index("shared_plans_workspace_idx").on(t.workspaceId),
    ownerIdx:     index("shared_plans_owner_idx").on(t.ownerId),
  }),
);

export type SharedPlan    = typeof sharedPlansTable.$inferSelect;
export type NewSharedPlan = typeof sharedPlansTable.$inferInsert;
