/**
 * agent_employees — definizioni statiche degli agenti AI "dipendenti".
 *
 * Ogni agente ha una persona, un ruolo e una lista di capability.
 * Le definizioni sono seed-data — non cambiano a runtime.
 *
 * agent_tasks — task assegnati dagli utenti (o da Wendy) agli agenti.
 * I task vengono eseguiti in background e i risultati salvati qui.
 *
 * PRIVACY: output_markdown può contenere testo generato dall'AI ma non PII raw.
 *          userId con SET NULL per GDPR.
 */
import {
  pgTable, serial, integer, text, timestamp, jsonb, boolean, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// ── Definizioni agenti (seed-data) ────────────────────────────────────────────

export const agentEmployeesTable = pgTable(
  "agent_employees",
  {
    id:           serial("id").primaryKey(),
    slug:         text("slug").notNull().unique(),   // es. "marco-career"
    name:         text("name").notNull(),             // es. "Marco"
    role:         text("role").notNull(),             // es. "Career Coach"
    domain:       text("domain").notNull(),           // career|mindset|habits|trading|health|market|business|learning
    avatar:       text("avatar").notNull(),           // emoji avatar es. "💼"
    color:        text("color").notNull(),            // classe tailwind es. "text-blue-500"
    description:  text("description").notNull(),      // breve bio per l'UI
    capabilities: jsonb("capabilities").$type<string[]>().notNull().default([]),
    systemPrompt: text("system_prompt").notNull(),    // persona + istruzioni
    isActive:     boolean("is_active").notNull().default(true),
    sortOrder:    integer("sort_order").notNull().default(0),
    createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugIdx:   uniqueIndex("agent_employees_slug_idx").on(t.slug),
    activeIdx: index("agent_employees_active_idx").on(t.isActive, t.sortOrder),
  }),
);

// ── Task assegnati agli agenti ────────────────────────────────────────────────

export const agentTasksTable = pgTable(
  "agent_tasks",
  {
    id:           serial("id").primaryKey(),
    userId:       integer("user_id")
                    .references(() => usersTable.id, { onDelete: "set null" }),
    agentSlug:    text("agent_slug").notNull(),       // FK logica su agent_employees.slug
    title:        text("title").notNull(),            // breve descrizione del task
    prompt:       text("prompt").notNull(),           // istruzione completa all'agente

    // Stato esecuzione
    status:       text("status", {
                    enum: ["queued", "running", "completed", "failed", "cancelled"],
                  }).notNull().default("queued"),

    // Output
    outputMarkdown: text("output_markdown"),          // risposta finale dell'agente (markdown)
    outputMeta:     jsonb("output_meta").$type<{     // metadati sull'output
      tokensUsed?:  number;
      modelUsed?:   string;
      toolsCalled?: string[];
      sources?:     Array<{ title: string; url?: string }>;
    }>(),

    // Contesto opzionale (es. sectorId, planId, ideaId)
    contextType:  text("context_type"),              // "sector" | "plan" | "idea" | "custom"
    contextId:    integer("context_id"),
    contextData:  jsonb("context_data"),             // dati extra passati all'agente

    errorMessage: text("error_message"),
    queuedAt:     timestamp("queued_at",   { withTimezone: true }).notNull().defaultNow(),
    startedAt:    timestamp("started_at",  { withTimezone: true }),
    completedAt:  timestamp("completed_at",{ withTimezone: true }),
    durationMs:   integer("duration_ms"),

    createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx:    index("agent_tasks_user_idx").on(t.userId),
    statusIdx:  index("agent_tasks_status_idx").on(t.status, t.queuedAt),
    agentIdx:   index("agent_tasks_agent_idx").on(t.agentSlug, t.status),
  }),
);

export type AgentEmployee = typeof agentEmployeesTable.$inferSelect;
export type AgentTask     = typeof agentTasksTable.$inferSelect;
export type NewAgentTask  = typeof agentTasksTable.$inferInsert;
