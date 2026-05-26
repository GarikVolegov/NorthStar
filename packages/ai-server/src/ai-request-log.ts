/**
 * ai-request-log.ts — registra ogni chiamata AI di Wendy in ai_request_log.
 *
 * Pattern fire-and-forget: non blocca mai la risposta al client.
 * Non salva mai contenuto integrale di prompt o messaggi (PRIVACY_DESIGN.md).
 *
 * Phase 2 additions: domain, supervisorScore, wasRewritten, ttftMs.
 */
import { db, aiCostLogTable, aiRequestLogTable } from "@workspace/db";
import { logger } from "./logger";

export type AiRequestStatus =
  | "success"
  | "error_model"
  | "error_timeout"
  | "error_ratelimit"
  | "error_internal";

export type AiResponseCategory =
  | "success"
  | "insufficient_data"
  | "refused"
  | "error_tool"
  | "error_model";

export interface RecordAiCallInput {
  requestId:        string;
  userId?:          number | null;
  threadId?:        string;
  intent:           string;
  tier:             string;
  role?:            string;
  phase?:           string;
  model:            string;
  inputTokens:      number;
  outputTokens:     number;
  costUsdEst:       number;
  latencyMs:        number;
  totalTurns:       number;
  status:           AiRequestStatus;
  errorCode?:       string;
  locale?:          string;
  // Step 5
  toolCallsCount?:    number;
  toolsUsed?:         string[];
  responseCategory?:  AiResponseCategory;
  searchMode?:        "semantic" | "keyword" | "none";
  // Step 6: RAG
  ragChunksRetrieved?: number;
  ragTopSimilarity?:   number | null;
  ragSourcesUsed?:     string[];
  // Phase 2: quality + domain
  domain?:          string | null;
  supervisorScore?: number | null;
  wasRewritten?:    boolean;
  ttftMs?:          number | null;
}

function numeric(value: number | null | undefined, scale: number): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value.toFixed(scale);
}

export function recordAiCall(input: RecordAiCallInput): void {
  db.insert(aiCostLogTable).values({
    requestId:        input.requestId,
    userId:           input.userId ?? null,
    sessionId:        input.threadId,
    intent:           input.intent,
    domain:           input.domain ?? null,
    tier:             input.tier,
    role:             input.role ?? "wendy",
    phase:            input.phase ?? "specialist",
    model:            input.model,
    provider:         input.model.startsWith("gpt-") ? "openai" : null,
    inputTokens:      input.inputTokens,
    outputTokens:     input.outputTokens,
    costUsdEstimate:  numeric(input.costUsdEst, 6),
    latencyMs:        input.latencyMs,
    ttftMs:           input.ttftMs ?? null,
    supervisorScore:  numeric(input.supervisorScore, 3),
    wasRewritten:     input.wasRewritten ?? false,
    status:           input.status,
    errorCode:        input.errorCode,
  }).catch((err) => {
    logger.warn({ err, requestId: input.requestId }, "[ai-cost-log] insert failed");
  });

  db.insert(aiRequestLogTable).values({
    requestId:        input.requestId,
    userId:           input.userId ?? null,
    threadId:         input.threadId,
    intent:           input.intent,
    tier:             input.tier,
    model:            input.model,
    inputTokens:      input.inputTokens,
    outputTokens:     input.outputTokens,
    costUsdEst:       input.costUsdEst,
    latencyMs:        input.latencyMs,
    totalTurns:       input.totalTurns,
    status:           input.status,
    errorCode:        input.errorCode,
    locale:           input.locale ?? "it",
    toolCallsCount:      input.toolCallsCount ?? 0,
    toolsUsed:           input.toolsUsed ?? [],
    responseCategory:    input.responseCategory,
    searchMode:          input.searchMode,
    ragChunksRetrieved:  input.ragChunksRetrieved ?? 0,
    ragTopSimilarity:    input.ragTopSimilarity ?? null,
    ragSourcesUsed:      input.ragSourcesUsed ?? [],
    domain:              input.domain ?? null,
    supervisorScore:     input.supervisorScore ?? null,
    wasRewritten:        input.wasRewritten ?? false,
    ttftMs:              input.ttftMs ?? null,
  }).catch((err) => {
    logger.warn({ err, requestId: input.requestId }, "[ai-request-log] insert failed");
  });
}
