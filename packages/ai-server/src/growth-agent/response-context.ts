import { startSpan } from "../tracing";
import { FF } from "../feature-flags";
import { runChainOfThought } from "./chain-of-thought";
import { retrieve, type RetrievedChunk } from "./retriever";
import { searchWeb, MIN_LOCAL_CHUNKS } from "./web-search";
import type { ChatMessage } from "./agent";
import type { CoTResult } from "./chain-of-thought";
import { logger } from "../logger";

export interface ResponseContext {
  personaExamples: RetrievedChunk[];
  documentChunks: RetrievedChunk[];
  platformChunks: RetrievedChunk[];
  webResults: RetrievedChunk[];
  cot: CoTResult | null;
}

export async function loadResponseContext(
  userId: number,
  userMessage: string,
  history: ChatMessage[],
  requestId?: string,
  conversationId?: string | number,
): Promise<ResponseContext> {
  const conversationSummary = history
    .slice(-4)
    .map((m) => `${m.role === "user" ? "Utente" : "Coach"}: ${m.content.slice(0, 200)}`)
    .join("\n");
  const ragSpan = startSpan("rag_retrieval", { requestId });
  const [personaExamples, documentChunks, platformChunks, cot] = await Promise.all([
    retrieve(userMessage, userId, { topK: 3, minScore: 0.3, sourceTypes: ["persona_example"] }).catch((err) => {
      logger.warn({ err, requestId }, "persona context retrieval failed");
      return [];
    }),
    retrieve(userMessage, userId, { topK: 5, minScore: 0.35, sourceTypes: ["document", "user_note"] }).catch((err) => {
      logger.warn({ err, requestId }, "document context retrieval failed");
      return [];
    }),
    retrieve(userMessage, userId, { topK: 3, minScore: 0.3, sourceTypes: ["platform_content"] }).catch((err) => {
      logger.warn({ err, requestId }, "platform context retrieval failed");
      return [];
    }),
    FF.chainOfThought ? runChainOfThought(userId, userMessage, conversationSummary, conversationId).catch((err) => {
      logger.warn({ err, requestId }, "chain-of-thought context failed");
      return null;
    }) : Promise.resolve(null),
  ]);
  ragSpan.end();
  const webResults = documentChunks.length < MIN_LOCAL_CHUNKS
    ? await searchWeb(`crescita personale ${userMessage}`, 4).catch((err) => {
      logger.warn({ err, requestId }, "web context search failed");
      return [];
    })
    : [];
  return { personaExamples, documentChunks, platformChunks, webResults, cot };
}
