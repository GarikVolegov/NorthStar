import {
  estimateCost,
  estimateTokens,
  recordAiCall,
} from "@workspace/ai-server";
import type { WikiStreamEvent } from "@workspace/ai-server";

export interface WikiTelemetryChunk {
  content?: string;
  source: string;
  score: number;
}

export interface WikiTelemetryBase {
  requestId: string;
  userId: number;
  message: string;
  historyLength: number;
  startedAt: number;
}

export interface WikiDoneTelemetry {
  model: string;
  reason: string;
  contextSources: NonNullable<WikiStreamEvent["contextSources"]>;
  usage: NonNullable<WikiStreamEvent["usage"]>;
}

function totalTurns(historyLength: number): number {
  return historyLength + 1;
}

function latencyMs(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt);
}

function tierFromReason(reason: string): string {
  return reason.split(":")[1] ?? "unknown";
}

function sourcesFromChunks(chunks: WikiTelemetryChunk[]): string[] {
  return [...new Set(chunks.map((chunk) => chunk.source))];
}

function topSimilarity(chunks: WikiTelemetryChunk[]): number | null {
  return chunks.length > 0 ? Math.max(...chunks.map((chunk) => chunk.score)) : null;
}

function usageFallback(message: string, fullResponse: string, model: string): NonNullable<WikiStreamEvent["usage"]> {
  const inputTokens = estimateTokens(message);
  const outputTokens = estimateTokens(fullResponse);
  return {
    inputTokens,
    outputTokens,
    costUsdEst: estimateCost(model, inputTokens, outputTokens),
  };
}

export function recordWikiStreamError(input: WikiTelemetryBase & {
  event: WikiStreamEvent;
  sourceChunks: WikiTelemetryChunk[];
}): void {
  recordAiCall({
    requestId: input.requestId,
    userId: input.userId,
    intent: "wiki_chat",
    tier: "unknown",
    role: "wiki",
    phase: "chat",
    model: input.event.model ?? "unknown",
    inputTokens: estimateTokens(input.message),
    outputTokens: 0,
    costUsdEst: 0,
    latencyMs: latencyMs(input.startedAt),
    totalTurns: totalTurns(input.historyLength),
    status: "error_model",
    errorCode: "wiki_stream_error",
    ragChunksRetrieved: input.sourceChunks.length,
    ragTopSimilarity: topSimilarity(input.sourceChunks),
    ragSourcesUsed: sourcesFromChunks(input.sourceChunks),
  });
}

export function recordWikiSuccess(input: WikiTelemetryBase & {
  doneEvent: WikiStreamEvent | null;
  fullResponse: string;
  sourceChunks: WikiTelemetryChunk[];
}): WikiDoneTelemetry {
  const model = input.doneEvent?.model ?? "unknown";
  const reason = input.doneEvent?.reason ?? "unknown";
  const contextSources = input.doneEvent?.contextSources ?? [];
  const usage = input.doneEvent?.usage ?? usageFallback(input.message, input.fullResponse, model);
  const ragChunksRetrieved = input.doneEvent?.rag?.chunksRetrieved ?? input.sourceChunks.length;
  const ragTopSimilarity = input.doneEvent?.rag?.topSimilarity ?? topSimilarity(input.sourceChunks);
  const ragSourcesUsed = input.doneEvent?.rag?.sourcesUsed ?? sourcesFromChunks(input.sourceChunks);

  recordAiCall({
    requestId: input.requestId,
    userId: input.userId,
    intent: "wiki_chat",
    tier: tierFromReason(reason),
    role: "wiki",
    phase: "chat",
    model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    costUsdEst: usage.costUsdEst,
    latencyMs: latencyMs(input.startedAt),
    totalTurns: totalTurns(input.historyLength),
    status: "success",
    responseCategory: "success",
    searchMode: contextSources.includes("rag") ? "semantic" : "none",
    ragChunksRetrieved,
    ragTopSimilarity,
    ragSourcesUsed,
  });

  return {
    model,
    reason,
    contextSources,
    usage,
  };
}

export function recordWikiInternalError(input: WikiTelemetryBase): void {
  recordAiCall({
    requestId: input.requestId,
    userId: input.userId,
    intent: "wiki_chat",
    tier: "unknown",
    role: "wiki",
    phase: "chat",
    model: "unknown",
    inputTokens: estimateTokens(input.message),
    outputTokens: 0,
    costUsdEst: 0,
    latencyMs: latencyMs(input.startedAt),
    totalTurns: totalTurns(input.historyLength),
    status: "error_internal",
    errorCode: "wiki_internal_error",
  });
}
