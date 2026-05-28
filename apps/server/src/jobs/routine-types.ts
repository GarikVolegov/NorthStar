/**
 * routine-types.ts — tipi condivisi per il sistema di routine autonome.
 *
 * Usato da:
 *   - routine-delivery.ts       (consegna il risultato)
 *   - executors/*.ts             (producono il risultato)
 *   - routine-scheduler.ts      (Step 3: dispatcha gli executor)
 */
import type { UserRoutine } from "@workspace/db";

// Re-export per convenienza degli executor
export type { UserRoutine };

// Re-export RoutineType dal DB schema (fonte di verità)
export type { RoutineType } from "@workspace/db";

// ── RoutineResult ─────────────────────────────────────────────────────────────

/**
 * Il risultato prodotto da ogni executor di routine.
 * Viene passato a `deliverRoutineResult` che lo salva nel DB
 * e lo consegna via email / in-app secondo l'outputChannel configurato.
 */
export interface RoutineResult {
  /** Titolo breve — max ~80 char. Usato come subject email e titolo card. */
  title: string;

  /** Corpo principale in markdown.
   *  Viene salvato nel DB e convertito in HTML per le email.
   *  Max ~4000 char consigliati per email leggibili. */
  body: string;

  /** Label del bottone CTA opzionale. Es. "Vedi offerte" */
  ctaLabel?: string;

  /** Target del CTA — URL relativo (/routines) o assoluto. */
  ctaTarget?: string;

  /** Metadati specifici per tipo di routine.
   *  Utili per analytics e per future feature (es. drill-down offerte).
   *  Non vengono mostrati all'utente direttamente. */
  metadata?: Record<string, unknown>;
}

// ── RoutineExecutor ──────────────────────────────────────────────────────────

import type { User } from "@workspace/db";

export type RoutineExecutor = (
  routine: UserRoutine,
  user: User,
) => Promise<RoutineResult>;

// ── Emoji per tipo di routine (usata nelle email e notifiche) ─────────────────

export const ROUTINE_TYPE_EMOJI: Record<string, string> = {
  job_monitor:      "🔍",
  market_report:    "📊",
  mindset_exercise: "🧠",
  growth_briefing:  "🚀",
  interview_prep:   "🎯",
  discovery_nudge:  "🧭",
};

export const ROUTINE_TYPE_LABEL: Record<string, string> = {
  job_monitor:      "Monitoraggio Offerte",
  market_report:    "Report di Mercato",
  mindset_exercise: "Esercizio Mindset",
  growth_briefing:  "Briefing Crescita",
  interview_prep:   "Preparazione Colloquio",
  discovery_nudge:  "Nudge di Scoperta",
};
