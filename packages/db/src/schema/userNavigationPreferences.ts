/**
 * user_navigation_preferences - preferenze UI per la barra di navigazione alta.
 *
 * topNavLayout contiene solo ID del catalogo controllato, ordine e visibilita.
 */
import { pgTable, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userNavigationPreferencesTable = pgTable(
  "user_navigation_preferences",
  {
    userId: integer("user_id")
      .primaryKey()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    topNavLayout: jsonb("top_nav_layout").notNull().default([]),

    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("user_navigation_preferences_user_idx").on(t.userId),
  }),
);

export type UserNavigationPreferences = typeof userNavigationPreferencesTable.$inferSelect;
export type NewUserNavigationPreferences = typeof userNavigationPreferencesTable.$inferInsert;
