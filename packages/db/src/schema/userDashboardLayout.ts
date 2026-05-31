/**
 * user_dashboard_layout — layout personalizzato della dashboard per utente.
 *
 * Salva l'ordine, la visibilità e le dimensioni dei widget della homepage.
 * L'utente può riordinare i widget via drag & drop; il layout viene persistito qui.
 *
 * Struttura di `layout` (array di WidgetLayout):
 *   [
 *     { id: "progress",      position: 0, visible: true,  size: "lg" },
 *     { id: "job_feed",      position: 1, visible: true,  size: "md" },
 *     { id: "next_routine",  position: 2, visible: true,  size: "md" },
 *     { id: "mindset_streak",position: 3, visible: false, size: "sm" },
 *     { id: "insights",      position: 4, visible: true,  size: "md" },
 *   ]
 *
 * Widget IDs disponibili (v1):
 *   "progress"       → progress obiettivi attivi
 *   "job_feed"       → ultime offerte dalla routine job_monitor
 *   "next_routine"   → prossima routine schedulata
 *   "mindset_streak" → streak esercizi mindset
 *   "insights"       → ultimi proactive insights
 *
 * PRIVACY:
 *   - userId con CASCADE su delete (GDPR Art. 17)
 *   - layout contiene solo metadati UI, nessun dato personale
 */
import {
  pgTable, integer, jsonb, timestamp, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userDashboardLayoutTable = pgTable(
  "user_dashboard_layout",
  {
    // PK = userId: un solo layout per utente (upsert on conflict)
    userId:    integer("user_id")
                 .primaryKey()
                 .references(() => usersTable.id, { onDelete: "cascade" }),

    // Array serializzato di WidgetLayout (vedi commento sopra)
    layout:    jsonb("layout").notNull().default([]),

    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("user_dashboard_layout_user_idx").on(t.userId),
  }),
);

export type UserDashboardLayout    = typeof userDashboardLayoutTable.$inferSelect;
export type NewUserDashboardLayout = typeof userDashboardLayoutTable.$inferInsert;
