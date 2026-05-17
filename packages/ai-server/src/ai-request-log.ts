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
  // Step 6: RAG telemetria
  ragChunksRetrieved?: number;
  ragTopSimilarity?:   number | null;
  ragSourcesUsed?:     string[];
}

export function recordAiCall(input: RecordAiCallInput): void {
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
  }).catch((err) => {
    logger.warn({ err, requestId: input.requestId }, "[ai-request-log] insert failed");
  });
}
