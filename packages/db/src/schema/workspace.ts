/**
 * workspaces — workspace condivisi (team, mentor-mentee).
 *
 * Ogni utente ha un workspace personale implicito (workspaceId = null su
 * tutte le sue entità personali). Questo schema rappresenta workspace espliciti
 * con più membri e permessi differenziati.
 *
 * PRIVACY: workspace_members nasconde i dati personali tra i membri —
 * solo artefatti esplicitamente condivisi sono visibili.
 */
import {
  pgTable, serial, integer, text, timestamp, boolean, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const workspacesTable = pgTable(
  "workspaces",
  {
    id:          serial("id").primaryKey(),
    name:        text("name").notNull(),
    type:        text("type", {
                   enum: ["team", "mentor_mentee"],
                 }).notNull().default("team"),
    ownerId:     integer("owner_id")
                   .notNull()
                   .references(() => usersTable.id, { onDelete: "cascade" }),
    description: text("description"),
    avatarUrl:   text("avatar_url"),
    isActive:    boolean("is_active").notNull().default(true),
    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ownerIdx: index("workspaces_owner_idx").on(t.ownerId),
    typeIdx:  index("workspaces_type_idx").on(t.type, t.isActive),
  }),
);

export type Workspace    = typeof workspacesTable.$inferSelect;
export type NewWorkspace = typeof workspacesTable.$inferInsert;
