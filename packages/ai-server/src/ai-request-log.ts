/**
 * ai-request-log.ts — registra ogni chiamata AI di Wendy in ai_request_log.
 *
 * Pattern fire-and-forget: non blocca mai la risposta al client.
 * Non salva mai contenuto integrale di prompt o messaggi (PRIVACY_DESIGN.md).
 */
import { db, aiRequestLogTable } from "@workspace/db";
import { logger } from "./logger";

export type AiRequestStatus =
  | "success"
  | "error_model"
  | "error_timeout"
  | "error_ratelimit"
  | "error_internal";

export interface RecordAiCallInput {
  requestId:    string;
  userId?:      number | null;    // nullable: guest o utente cancellato
  threadId?:    string;
  intent:       string;           // WendyIntent
  tier:         string;           // nano | micro | standard | reasoning
  model:        string;
  inputTokens:  number;
  outputTokens: number;
  costUsdEst:   number;
  latencyMs:    number;
  totalTurns:   number;
  status:       AiRequestStatus;
  errorCode?:   string;
  locale?:      string;
}

/**
 * Registra una chiamata AI in modo fire-and-forget.
 * Cattura e logga eventuali errori senza propagarli al chiamante.
 */
export function recordAiCall(input: RecordAiCallInput): void {
  // Fire-and-forget: non usiamo await, non blocchiamo la risposta
  db.insert(aiRequestLogTable).values({
    requestId:    input.requestId,
    userId:       input.userId ?? null,
    threadId:     input.threadId,
    intent:       input.intent,
    tier:         input.tier,
    model:        input.model,
    inputTokens:  input.inputTokens,
    outputTokens: input.outputTokens,
    costUsdEst:   input.costUsdEst,
    latencyMs:    input.latencyMs,
    totalTurns:   input.totalTurns,
    status:       input.status,
    errorCode:    input.errorCode,
    locale:       input.locale ?? "it",
  }).catch((err) => {
    // Mai far fallire la richiesta principale per un errore di logging
    logger.warn({ err, requestId: input.requestId }, "[ai-request-log] insert failed");
  });
}
