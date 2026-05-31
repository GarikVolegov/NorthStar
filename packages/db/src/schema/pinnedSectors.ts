import {
  integer,
  pgTable,
  primaryKey,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sectorsTable } from "./sectors";
import { usersTable } from "./users";

export const pinnedSectorsTable = pgTable(
  "pinned_sectors",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    sectorId: integer("sector_id")
      .notNull()
      .references(() => sectorsTable.id, { onDelete: "cascade" }),
    pinnedAt: timestamp("pinned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.sectorId] }),
    sectorIdx: index("pinned_sectors_sector_idx").on(t.sectorId),
  }),
);

export type PinnedSector = typeof pinnedSectorsTable.$inferSelect;
export type NewPinnedSector = typeof pinnedSectorsTable.$inferInsert;
