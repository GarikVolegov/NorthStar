import {
  pgTable, text, timestamp, integer, boolean, jsonb,
  index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { relations } from "drizzle-orm";
import { sectorsTable } from "./sectors";

export const userProfileSettingsTable = pgTable("user_profile_settings", {
  userId: integer("user_id").notNull().primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),

  bannerUrl: text("banner_url"),

  username: text("username").unique(),

  sectorId: integer("sector_id").references(() => sectorsTable.id),
  cvText: text("cv_text"),
  cvJson: jsonb("cv_json"),
  isPublic: boolean("is_public").notNull().default(false),
  timezone: text("timezone").default("Europe/Rome"),
  workPreference: text("work_preference").default("unknown"),
  autonomyPreference: integer("autonomy_preference").default(5),
  stabilityPreference: integer("stability_preference").default(5),
  userMode: text("user_mode").notNull().default("explorer"),

  // Step 7: onboarding adattivo
  horizon:       text("horizon", {
                   enum: ["short", "medium", "open"],
                 }).default("open"),
  onboardingStep: integer("onboarding_step").notNull().default(0), // 0=non iniziato, 4=completato

  // Step 7: tono Wendy personalizzato
  wendyTonePreference: text("wendy_tone_preference", {
                          enum: ["auto", "concise", "detailed", "formal", "casual"],
                        }).default("auto"),

  city: text("city"),
  cityPlaceId: text("city_place_id"),
  bio: text("bio"),

  referredByCode: text("referred_by_code"),
  referredByAffiliateId: integer("referred_by_affiliate_id"),
  referralConvertedAt: timestamp("referral_converted_at", { withTimezone: true }),
  isAffiliate: boolean("is_affiliate").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  usernameIdx: uniqueIndex("user_profile_settings_username_idx").on(t.username),
  referredByIdx: index("user_profile_settings_referred_by_idx").on(t.referredByAffiliateId),
  referredByCodeIdx: index("user_profile_settings_referred_by_code_idx").on(t.referredByCode),
  isAffiliateIdx: index("user_profile_settings_is_affiliate_idx").on(t.isAffiliate),
  cityIdx: index("user_profile_settings_city_idx").on(t.city),
}));

export type UserProfileSettings = typeof userProfileSettingsTable.$inferSelect;

export const userProfileSettingsRelations = relations(userProfileSettingsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [userProfileSettingsTable.userId],
    references: [usersTable.id],
  }),
}));
