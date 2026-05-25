import { pgTable, serial, text, timestamp, boolean, integer, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const contactMessagesTable = pgTable(
  "contact_messages",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    read: boolean("read").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true }),
    status: text("status", { enum: ["new", "in_progress", "resolved", "archived"] })
      .notNull()
      .default("new"),
    internalNotes: text("internal_notes"),
    assignedTo: integer("assigned_to").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    readIdx: index("contact_messages_read_idx").on(t.read),
    statusIdx: index("contact_messages_status_idx").on(t.status),
    assignedToIdx: index("contact_messages_assigned_to_idx").on(t.assignedTo),
    createdAtIdx: index("contact_messages_created_at_idx").on(t.createdAt),
  }),
);

export type ContactMessage = typeof contactMessagesTable.$inferSelect;
