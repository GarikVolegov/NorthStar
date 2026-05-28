/**
 * routine-delivery.ts — consegna il risultato di una routine all'utente.
 *
 * Dopo che un executor produce un RoutineResult, questa funzione:
 *   1. Salva SEMPRE in `routine_executions` (fonte verità per il feed in-app)
 *   2. Invia email via Resend (se outputChannel = "email" | "all")
 *   3. Crea un proactive_insight (se outputChannel = "in_app" | "all")
 *   4. Il canale "wendy_context" usa direttamente la tabella routine_executions:
 *      Wendy può leggerle tramite tool (implementato in Step 6)
 *
 * La funzione è fault-tolerant: un fallimento della delivery email
 * non impedisce il salvataggio in DB.
 *
 * Chiamata da: routine-executor.ts (Step 3)
 */
import {
  db,
  routineExecutionsTable,
  proactiveInsightsTable,
  usersTable,
  type UserRoutine,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { rootLogger } from "../middleware/logger";
import { sendRoutineEmail } from "../lib/email";
import type { RoutineResult } from "./routine-types";
import { ROUTINE_TYPE_EMOJI, ROUTINE_TYPE_LABEL } from "./routine-types";

const log = rootLogger.child({ module: "routine-delivery" });

// ── Tipi ─────────────────────────────────────────────────────────────────────

interface DeliveryUser {
  id:    number;
  name:  string;
  email: string;
}

export interface DeliveryReport {
  executionId: number;
  dbSaved:     boolean;
  emailSent:   boolean;
  insightCreated: boolean;
  errors:      string[];
}

// ── Funzione principale ───────────────────────────────────────────────────────

/**
 * Consegna il risultato di una routine all'utente.
 * Non lancia eccezioni — registra tutti gli errori nel DeliveryReport.
 */
export async function deliverRoutineResult(
  routine:  UserRoutine,
  userId:   number,
  result:   RoutineResult,
): Promise<DeliveryReport> {
  const report: DeliveryReport = {
    executionId:    0,
    dbSaved:        false,
    emailSent:      false,
    insightCreated: false,
    errors:         [],
  };

  // ── Step A: Salva in routine_executions (sempre) ──────────────────────────
  try {
    const [saved] = await db
      .insert(routineExecutionsTable)
      .values({
        routineId: routine.id,
        userId,
        title:     result.title,
        body:      result.body,
        ctaLabel:  result.ctaLabel,
        ctaTarget: result.ctaTarget,
        metadata:  result.metadata ?? {},
      })
      .returning({ id: routineExecutionsTable.id });

    if (!saved) throw new Error("INSERT non ha restituito ID");

    report.executionId = saved.id;
    report.dbSaved     = true;
    log.info({ routineId: routine.id, userId, executionId: saved.id }, "[delivery] saved to DB");
  } catch (err) {
    const msg = `DB save failed: ${String(err)}`;
    report.errors.push(msg);
    log.error({ err, routineId: routine.id, userId }, "[delivery] DB save error");
    // Blocca tutto: se non possiamo salvare in DB, non inviamo nulla
    return report;
  }

  const channel = routine.outputChannel;
  const wantsEmail   = channel === "email"   || channel === "all";
  const wantsInApp   = channel === "in_app"  || channel === "all";
  // wendy_context: le routine_executions sono già leggibili da Wendy via tool (Step 6)

  // ── Step B: Email ─────────────────────────────────────────────────────────
  if (wantsEmail) {
    try {
      // Carica email utente (necessaria per l'invio)
      const [user] = await db
        .select({ name: usersTable.name, email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);

      if (!user) throw new Error("Utente non trovato");

      const emailData = {
        userName:     user.name,
        routineName:  routine.name,
        routineType:  routine.type,
        routineEmoji: ROUTINE_TYPE_EMOJI[routine.type] ?? "✦",
        title:        result.title,
        body:         result.body,
      } as Parameters<typeof sendRoutineEmail>[1];
      if (result.ctaLabel)  emailData.ctaLabel  = result.ctaLabel;
      if (result.ctaTarget) emailData.ctaTarget = result.ctaTarget;

      await sendRoutineEmail(user.email, emailData);

      report.emailSent = true;
      log.info({ routineId: routine.id, userId }, "[delivery] email sent");
    } catch (err) {
      const msg = `Email failed: ${String(err)}`;
      report.errors.push(msg);
      log.warn({ err, routineId: routine.id, userId }, "[delivery] email error (non-fatal)");
    }
  }

  // ── Step C: Proactive Insight (in-app notification) ───────────────────────
  if (wantsInApp) {
    try {
      // Controlla limite anti-spam: max 3 insight non letti per utente
      const unreadCount = await db.$count(
        proactiveInsightsTable,
        eq(proactiveInsightsTable.userId, userId),
      );

      // Usa un check semplice sul conteggio totale non-letto
      // (il check granulare è in proactive-insight-generator.ts)
      if (unreadCount < 10) {
        await db.insert(proactiveInsightsTable).values({
          userId,
          insightType: "plan_update",
          title:       result.title,
          // Tronca il body: gli insight sono snippet, non report completi
          body:        result.body.slice(0, 400) + (result.body.length > 400 ? "…" : ""),
          ctaLabel:    result.ctaLabel ?? `Vedi ${ROUTINE_TYPE_LABEL[routine.type] ?? "risultati"}`,
          ctaTarget:   result.ctaTarget ?? "/routines",
        });

        report.insightCreated = true;
        log.info({ routineId: routine.id, userId }, "[delivery] insight created");
      } else {
        log.info({ routineId: routine.id, userId, unreadCount }, "[delivery] insight skipped (anti-spam)");
      }
    } catch (err) {
      const msg = `Insight failed: ${String(err)}`;
      report.errors.push(msg);
      log.warn({ err, routineId: routine.id, userId }, "[delivery] insight error (non-fatal)");
    }
  }

  return report;
}

// ── Helper: carica utente minimale per delivery ───────────────────────────────

export async function loadDeliveryUser(userId: number): Promise<DeliveryUser | null> {
  const [user] = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return user ?? null;
}
