/**
 * workspace_members — relazione utente ↔ workspace con ruolo.
 *
 * Ruoli:
 *   owner  → pieno controllo, non rimuovibile
 *   admin  → può invitare, rimuovere member/viewer, accesso mentor
 *   member → contribuisce ai piani condivisi, commenta
 *   viewer → solo lettura degli artefatti condivisi
 */
import {
  pgTable, serial, integer, text, timestamp, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { workspacesTable } from "./workspace";

export const workspaceMembersTable = pgTable(
  "workspace_members",
  {
    id:          serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
                   .notNull()
                   .references(() => workspacesTable.id, { onDelete: "cascade" }),
    userId:      integer("user_id")
                   .notNull()
                   .references(() => usersTable.id, { onDelete: "cascade" }),
    role:        text("role", {
                   enum: ["owner", "admin", "member", "viewer"],
                 }).notNull().default("member"),
    invitedBy:   integer("invited_by")
                   .references(() => usersTable.id, { onDelete: "set null" }),
    joinedAt:    timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueMember:  uniqueIndex("workspace_members_unique_idx").on(t.workspaceId, t.userId),
    workspaceIdx:  index("workspace_members_workspace_idx").on(t.workspaceId),
    userIdx:       index("workspace_members_user_idx").on(t.userId),
  }),
);

export type WorkspaceMember    = typeof workspaceMembersTable.$inferSelect;
export type NewWorkspaceMember = typeof workspaceMembersTable.$inferInsert;
