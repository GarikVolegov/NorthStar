import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const communitiesTable = pgTable(
  "communities",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon").notNull().default("#"),
    isPublic: boolean("is_public").notNull().default(true),
    creatorId: integer("creator_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    memberCount: integer("member_count").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    publicIdx: index("communities_public_idx").on(t.isPublic),
    creatorIdx: index("communities_creator_idx").on(t.creatorId),
  }),
);

export const communityMembersTable = pgTable(
  "community_members",
  {
    id: serial("id").primaryKey(),
    communityId: integer("community_id")
      .notNull()
      .references(() => communitiesTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "admin", "member"] }).notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    communityIdx: index("community_members_community_idx").on(t.communityId),
    userIdx: index("community_members_user_idx").on(t.userId),
    uniqueMember: uniqueIndex("community_members_unique").on(t.communityId, t.userId),
  }),
);

export const communityChannelsTable = pgTable(
  "community_channels",
  {
    id: serial("id").primaryKey(),
    communityId: integer("community_id")
      .notNull()
      .references(() => communitiesTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    type: text("type", { enum: ["text", "announcement"] }).notNull().default("text"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    communityIdx: index("community_channels_community_idx").on(t.communityId),
  }),
);

export const communityMessagesTable = pgTable(
  "community_messages",
  {
    id: serial("id").primaryKey(),
    channelId: integer("channel_id")
      .notNull()
      .references(() => communityChannelsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    mediaUrl: text("media_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    channelIdx: index("community_messages_channel_idx").on(t.channelId),
    userIdx: index("community_messages_user_idx").on(t.userId),
    createdAtIdx: index("community_messages_created_at_idx").on(t.createdAt),
  }),
);

export type Community = typeof communitiesTable.$inferSelect;
export type CommunityMember = typeof communityMembersTable.$inferSelect;
export type CommunityChannel = typeof communityChannelsTable.$inferSelect;
export type CommunityMessage = typeof communityMessagesTable.$inferSelect;
