import {
  estimateCost,
  evaluateWendyResponse,
  recordAiCall,
  recordQualityScore,
  recordTtft,
  recordWendyCost,
  reinforceCoActivations,
} from "@workspace/ai-server";
import type {
  CompressedHistory,
  WendyActivationContext,
  WendyIntent,
  WendyRouterDecision,
} from "@workspace/ai-server";
import type { Logger } from "pino";
import { storeSemanticTurnInBackground } from "../lib/semantic-memory";

export type WendyRouteStatus =
  | "success"
  | "error_model"
  | "error_timeout"
  | "error_ratelimit"
  | "error_internal";

export type WendyResponseCategory =
  | "success"
  | "insufficient_data"
  | "refused"
  | "error_tool"
  | "error_model";

export function finalizeWendyRequest(input: {
  assistantResponseForMemory: string;
  compressedHistory?: CompressedHistory | undefined;
  decision: WendyRouterDecision;
  domainForLog: string | null;
  errorCode?: string | undefined;
  inputTokens: number;
  intent: WendyIntent;
  locale: string;
  logger: Logger;
  message: string;
  neuralContext: WendyActivationContext | null;
  outputTokens: number;
  ragChunksRetrieved: number;
  ragSourcesUsed: string[];
  ragTopSimilarity: number | null;
  requestId: string;
  responseCategory: WendyResponseCategory;
  searchModeUsed: "semantic" | "keyword" | "none";
  startedAt: number;
  status: WendyRouteStatus;
  supervisorScoreForLog: number | null;
  threadId?: string | undefined;
  toolsUsedInRequest: string[];
  ttftMs: number | null;
  userId: number;
  wasRewrittenForLog: boolean;
  wendyDecisionPlan: Parameters<typeof evaluateWendyResponse>[0]["decision"];
}) {
  const {
    assistantResponseForMemory,
    compressedHistory,
    decision,
    domainForLog,
    errorCode,
    inputTokens,
    intent,
    locale,
    logger,
    message,
    neuralContext,
    outputTokens,
    ragChunksRetrieved,
    ragSourcesUsed,
    ragTopSimilarity,
    requestId,
    searchModeUsed,
    startedAt,
    status,
    supervisorScoreForLog,
    threadId,
    toolsUsedInRequest,
    ttftMs,
    userId,
    wasRewrittenForLog,
    wendyDecisionPlan,
  } = input;
  let responseCategory = input.responseCategory;

  if (responseCategory === "success" && status !== "success") {
    responseCategory = status.includes("tool") ? "error_tool" : "error_model";
  }
  if (
    toolsUsedInRequest.length > 0 &&
    responseCategory === "success" &&
    toolsUsedInRequest.some((tool) => tool === "__failed")
  ) {
    responseCategory = "error_tool";
  }

  const latencyMs = Date.now() - startedAt;
  if (status === "success" || assistantResponseForMemory.trim()) {
    storeSemanticTurnInBackground({
      userId,
      userMessage: message,
      assistantResponse: assistantResponseForMemory,
    });
    if (neuralContext) {
      void reinforceCoActivations({
        userId,
        requestId,
        items: neuralContext.activeItems,
      });
    }
  }

  const wendySelfCheck = evaluateWendyResponse({
    userMessage: message,
    responseText: assistantResponseForMemory,
    decision: wendyDecisionPlan,
    contextSources: [
      ...new Set([
        ...toolsUsedInRequest.filter((tool) => tool !== "__failed"),
        ...ragSourcesUsed,
        ...(ragChunksRetrieved > 0 ? ["search_rag"] : []),
      ]),
    ],
  });
  if (!wendySelfCheck.ok) {
    logger.warn(
      {
        userId,
        requestId,
        score: wendySelfCheck.score,
        issues: wendySelfCheck.issues.map((issue) => issue.code),
      },
      "[ai/wendy] self-check issues detected",
    );
  }

  const costUsdEst = estimateCost(decision.model, inputTokens, outputTokens);
  recordAiCall({
    requestId,
    userId,
    ...(threadId ? { threadId } : {}),
    intent,
    tier: decision.tier,
    model: decision.model,
    inputTokens,
    outputTokens,
    costUsdEst,
    latencyMs,
    totalTurns: compressedHistory?.totalTurns ?? 0,
    status,
    ...(errorCode ? { errorCode } : {}),
    locale,
    toolCallsCount: toolsUsedInRequest.length,
    toolsUsed: [...new Set(toolsUsedInRequest)],
    responseCategory,
    searchMode: searchModeUsed,
    ragChunksRetrieved,
    ragTopSimilarity,
    ragSourcesUsed: [...new Set(ragSourcesUsed)],
    domain: domainForLog,
    supervisorScore: supervisorScoreForLog,
    wasRewritten: wasRewrittenForLog,
    ttftMs,
  });
  recordWendyCost(decision.model, costUsdEst);
  if (supervisorScoreForLog !== null && domainForLog) {
    recordQualityScore(domainForLog, intent, supervisorScoreForLog);
  }
  if (ttftMs !== null) recordTtft(ttftMs / 1000);
}
