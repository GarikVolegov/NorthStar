/**
 * auditLog — log immutabile di tutte le azioni sensibili.
 *
 * ⚠️  REGOLA 0 — vedi DB_RULES.md prima di modificare.
 *
 * REGOLA CRITICA: questa tabella è INSERT ONLY — append-only by design.
 * Non eseguire mai UPDATE o DELETE su audit_log, nemmeno in migration.
 * Se serve correggere un record, aggiungi un nuovo record correttivo
 * con action = 'correction' e metadata che referenzia il record originale.
 *
 * Azioni standard (action field):
 *   affiliate_referral_confirmed
 *   commission_applied
 *   commission_void
 *   withdrawal_requested
 *   withdrawal_paid
 *   withdrawal_rejected
 *   premium_activated
 *   premium_cancelled
 *   admin_action
 *   user_deleted
 *   referral_cancelled
 *
 * Retention: 7 anni (requisito GDPR per dati finanziari).
 * Anonimizzazione: actorId/targetId impostati a null 90 giorni dopo
 * cancellazione account (gestito da cron job GDPR).
 *
 * ⚠️  GDPR: gli IP sono dati personali. Usa sempre hashIp() prima
 * di salvare in ipAddress. Mai IP in chiaro in produzione.
 */

import { createHash } from "node:crypto";

/**
 * Hash an IP address with SHA-256 + salt before storing in audit_log.
 * Use this at every call site instead of passing req.ip directly.
 *
 *   await db.insert(auditLogTable).values({
 *     ipAddress: hashIp(req.ip),
 *     ...
 *   });
 *
 * The salt comes from IP_HASH_SALT env var (generated with pnpm secrets).
 * Returns null for falsy input (system actions, webhooks).
 */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const salt = process.env.IP_HASH_SALT ?? "default-dev-salt-change-me";
  return createHash("sha256").update(ip + salt).digest("hex");
}
import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { usersTable } from './users';

export const auditLogTable = pgTable(
  'audit_log',
  {
    id: serial('id').primaryKey(),

    /**
     * Chi ha eseguito l'azione.
     * null = sistema (cron job, webhook automatico)
     */
    actorId: integer('actor_id').references(() => usersTable.id, {
      onDelete: 'set null',
    }),

    /**
     * Utente target dell'azione (es. l'affiliato che riceve la commissione).
     * Può coincidere con actorId (es. utente che richiede prelievo).
     */
    targetId: integer('target_id').references(() => usersTable.id, {
      onDelete: 'set null',
    }),

    /**
     * Tipo di azione — stringa libera ma usa le costanti in
     * artifacts/api-server/src/lib/audit/actions.ts
     */
    action: text('action').notNull(),

    /**
     * Categoria per distinguere i tipi di audit.
     *   financial    — commissioni, pagamenti, rimborsi
     *   agent_action — esecuzioni AI agent
     *   admin_action — azioni amministrative manuali
     *   auth         — login, logout, refresh token
     *   system       — cron job, webhook automatici
     */
    category: text('category'),

    /**
     * Payload JSON con tutti i dettagli rilevanti.
     * Esempi:
     *   commission_applied: { affiliateId, referredUserId, month, amountCents, appliedTo }
     *   withdrawal_requested: { withdrawalId, amountCents, method }
     *   admin_action: { adminId, targetUserId, reason, before, after }
     */
    metadata: jsonb('metadata'),

    /**
     * IP del richiedente — per correlazione con eventi di sicurezza.
     * null per azioni di sistema.
     * Usa sempre hashIp() prima di salvare.
     */
    ipAddress: text('ip_address'),

    /**
     * User-Agent del richiedente (opzionale, per debug).
     */
    userAgent: text('user_agent'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    actorIdx: index('audit_actor_idx').on(t.actorId),
    targetIdx: index('audit_target_idx').on(t.targetId),
    actionIdx: index('audit_action_idx').on(t.action),
    categoryIdx: index('audit_category_idx').on(t.category),
    /** Indice su createdAt per query di range (es. ultimi 30 giorni) */
    createdIdx: index('audit_created_idx').on(t.createdAt),
  }),
);

export type AuditLog = typeof auditLogTable.$inferSelect;
export type InsertAuditLog = typeof auditLogTable.$inferInsert;
