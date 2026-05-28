/**
 * mood_checkins — check-in emozionale leggero (tool B10 "Mood-to-Action").
 *
 * 5 slider 0-100, Wendy mappa lo stato in una singola azione consigliata.
 * Anti-overwhelm by design: niente classifica, niente trend complessi,
 * solo "qual è la cosa giusta da fare adesso?".
 *
 * PRIVACY: cascade su user delete.
 */
import { pgTable, serial, integer, real, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const moodCheckinsTable = pgTable(
  "mood_checkins",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    /** Slider 0-100. */
    energy:     real("energy").notNull(),     // quanto sei carico
    anxiety:    real("anxiety").notNull(),    // quanto sei ansioso
    curiosity:  real("curiosity").notNull(),  // quanto sei curioso
    clarity:    real("clarity").notNull(),    // quanto vedi chiaro
    motivation: real("motivation").notNull(), // quanto sei motivato

    /** Tool/azione suggerita (es. "/diario?mode=indizi"). */
    suggestedToolHref: text("suggested_tool_href").notNull(),
    /** Etichetta umana del suggerimento mostrata all'utente. */
    suggestedToolLabel: text("suggested_tool_label").notNull(),
    /** Razionale breve del suggerimento (visibile all'utente). */
    rationale: text("rationale").notNull(),

    /** Cliccato sul CTA suggerito? */
    actedUpon: text("acted_upon"), // null = non ancora, ISO timestamp = quando cliccato

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userCreatedIdx: index("mood_checkins_user_created_idx").on(t.userId, t.createdAt),
  }),
);

export type MoodCheckin = typeof moodCheckinsTable.$inferSelect;
export type NewMoodCheckin = typeof moodCheckinsTable.$inferInsert;
