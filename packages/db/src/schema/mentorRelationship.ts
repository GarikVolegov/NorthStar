/**
 * mentor_relationships — relazione 1:1 mentor/mentee.
 *
 * Il mentore ha accesso read-only agli artefatti esplicitamente condivisi
 * dal mentee. MAI accesso a conversazioni Wendy, coach_memory_facts,
 * dati finanziari o dati sensibili del profilo.
 *
 * status:
 *   pending → invito inviato, attende accettazione del mentee
 *   active  → relazione attiva
 *   ended   → terminata (da entrambe le parti)
 */
import {
  pgTable, serial, integer, text, timestamp, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { workspacesTable } from "./workspace";

export const mentorRelationshipsTable = pgTable(
  "mentor_relationships",
  {
    id:          serial("id").primaryKey(),
    mentorId:    integer("mentor_id")
                   .notNull()
                   .references(() => usersTable.id, { onDelete: "cascade" }),
    menteeId:    integer("mentee_id")
                   .notNull()
                   .references(() => usersTable.id, { onDelete: "cascade" }),
    workspaceId: integer("workspace_id")
                   .references(() => workspacesTable.id, { onDelete: "set null" }),
    status:      text("status", {
                   enum: ["pending", "active", "ended"],
                 }).notNull().default("pending"),
    startedAt:   timestamp("started_at", { withTimezone: true }),
    endedAt:     timestamp("ended_at", { withTimezone: true }),
    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniquePair:  uniqueIndex("mentor_rel_unique_idx").on(t.mentorId, t.menteeId),
    mentorIdx:   index("mentor_rel_mentor_idx").on(t.mentorId, t.status),
    menteeIdx:   index("mentor_rel_mentee_idx").on(t.menteeId, t.status),
  }),
);

export type MentorRelationship    = typeof mentorRelationshipsTable.$inferSelect;
export type NewMentorRelationship = typeof mentorRelationshipsTable.$inferInsert;
