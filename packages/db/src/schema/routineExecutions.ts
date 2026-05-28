/**
 * routine_executions — storico delle esecuzioni delle routine utente.
 *
 * Ogni volta che il worker esegue una `user_routine`, il risultato viene
 * salvato qui. Questa tabella alimenta:
 *   - il feed in-app "Risultati routine" nella pagina /routines
 *   - il widget "job_feed" nella dashboard personalizzabile
 *   - il contesto di Wendy (outputChannel = "wendy_context")
 *
 * Le righe non vengono mai modificate dopo la creazione (append-only).
 * `read_at` viene impostato quando l'utente visualizza il risultato.
 *
 * RETENTION: consigliato TTL 90 giorni (da implementare con cron job di cleanup).
 *
 * PRIVACY:
 *   - userId + routineId con CASCADE su delete (GDPR Art. 17)
 *   - body contiene contenuto generato da AI — nessun PII diretto
 */
import {
  pgTable, serial, integer, text, timestamp, jsonb, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { userRoutinesTable } from "./userRoutines";

export const routineExecutionsTable = pgTable(
  "routine_executions",
  {
    id:        serial("id").primaryKey(),

    routineId: integer("routine_id")
                 .notNull()
                 .references(() => userRoutinesTable.id, { onDelete: "cascade" }),

    userId:    integer("user_id")
                 .notNull()
                 .references(() => usersTable.id, { onDelete: "cascade" }),

    title:     text("title").notNull(),       // titolo breve del risultato
    body:      text("body").notNull(),         // contenuto markdown generato

    ctaLabel:  text("cta_label"),             // es. "Vedi offerte"
    ctaTarget: text("cta_target"),            // URL relativo o azione app

    // Metadati opzionali specifici per tipo di routine:
    // job_monitor:   { jobCount, roles, cities }
    // market_report: { sector, signalCount }
    // mindset_exercise: { exerciseType, duration }
    metadata:  jsonb("metadata"),

    readAt:    timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx:      index("routine_executions_user_idx").on(t.userId),
    routineIdx:   index("routine_executions_routine_idx").on(t.routineId),
    // Indice per il feed in-app (per utente, ordine cronologico inverso)
    feedIdx:      index("routine_executions_feed_idx").on(t.userId, t.createdAt),
    unreadIdx:    index("routine_executions_unread_idx").on(t.userId, t.readAt),
  }),
);

export type RoutineExecution    = typeof routineExecutionsTable.$inferSelect;
export type NewRoutineExecution = typeof routineExecutionsTable.$inferInsert;
