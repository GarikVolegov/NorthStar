import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const wendyConfigOverridesTable = pgTable(
  "wendy_config_overrides",
  {
    id: serial("id").primaryKey(),
    key: varchar("key", { length: 128 }).notNull(),
    value: jsonb("value").$type<unknown>().notNull(),
    updatedBy: integer("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    keyUnique: uniqueIndex("wendy_config_overrides_key_unique").on(t.key),
    updatedByIdx: index("wendy_config_overrides_updated_by_idx").on(t.updatedBy),
  }),
);

export type WendyConfigOverrideRow = typeof wendyConfigOverridesTable.$inferSelect;
export type NewWendyConfigOverride = typeof wendyConfigOverridesTable.$inferInsert;
