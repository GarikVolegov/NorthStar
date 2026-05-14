import { pgTable, serial, integer, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { usersTable } from "./users";

export const userBadgesTable = pgTable(
  "user_badges",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    badgeKey: text("badge_key").notNull(),
    badgeLabel: text("badge_label").notNull(),
    badgeIcon: text("badge_icon").notNull(),
    badgeDescription: text("badge_description"),
    xpAwarded: integer("xp_awarded").notNull().default(0),
    earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
    seen: boolean("seen").notNull().default(false),
  },
  (t) => ({
    userIdx: index("user_badges_user_idx").on(t.userId),
    uniqueBadge: index("user_badges_unique").on(t.userId, t.badgeKey),
  }),
);

export type UserBadge = typeof userBadgesTable.$inferSelect;
export type InsertUserBadge = typeof userBadgesTable.$inferInsert;

export const userBadgesRelations = relations(userBadgesTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [userBadgesTable.userId],
    references: [usersTable.id],
  }),
}));

export const BADGE_DEFINITIONS = {
  first_session: {
    key: "first_session",
    label: "Prima Sessione",
    icon: "🎙️",
    description: "Hai completato la tua prima sessione vocale",
    xp: 50,
  },
  marathon: {
    key: "marathon",
    label: "Maratoneta",
    icon: "🏃",
    description: "10 sessioni completate",
    xp: 100,
  },
  dedication: {
    key: "dedication",
    label: "Dedizione",
    icon: "🔥",
    description: "Streak di 7 giorni",
    xp: 150,
  },
  explorer: {
    key: "explorer",
    label: "Esploratore",
    icon: "🧭",
    description: "Provati tutti gli agenti (carriera, mindset, abitudini, trading, salute)",
    xp: 200,
  },
  seeker: {
    key: "seeker",
    label: "Cercatore",
    icon: "💡",
    description: "100 domande a Wendy",
    xp: 200,
  },
  centurion: {
    key: "centurion",
    label: "Centurione",
    icon: "🏛️",
    description: "100 sessioni vocali completate",
    xp: 500,
  },
  level5: {
    key: "level5",
    label: "In Ascesa",
    icon: "⭐",
    description: "Raggiunto il livello 5",
    xp: 100,
  },
  level10: {
    key: "level10",
    label: "Veterano",
    icon: "🌟",
    description: "Raggiunto il livello 10",
    xp: 300,
  },
  early_bird: {
    key: "early_bird",
    label: "Early Bird",
    icon: "🌅",
    description: "Primo accesso della giornata per 7 giorni consecutivi",
    xp: 100,
  },
} as const;

export type BadgeKey = keyof typeof BADGE_DEFINITIONS;
