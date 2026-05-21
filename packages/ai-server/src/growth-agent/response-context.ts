import { startSpan } from "../tracing";
import { FF } from "../feature-flags";
import { runChainOfThought } from "./chain-of-thought";
import { retrieve, type RetrievedChunk } from "./retriever";
import { searchWeb, MIN_LOCAL_CHUNKS } from "./web-search";
import type { ChatMessage } from "./agent";
import type { CoTResult } from "./chain-of-thought";

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
): Promise<ResponseContext> {
  const conversationSummary = history
    .slice(-4)
    .map((m) => `${m.role === "user" ? "Utente" : "Coach"}: ${m.content.slice(0, 200)}`)
    .join("\n");
  const ragSpan = startSpan("rag_retrieval", { requestId });
  const [personaExamples, documentChunks, platformChunks, cot] = await Promise.all([
    retrieve(userMessage, userId, { topK: 3, minScore: 0.3, sourceTypes: ["persona_example"] }),
    retrieve(userMessage, userId, { topK: 5, minScore: 0.35, sourceTypes: ["document", "user_note"] }),
    retrieve(userMessage, userId, { topK: 3, minScore: 0.3, sourceTypes: ["platform_content"] }),
    FF.chainOfThought ? runChainOfThought(userId, userMessage, conversationSummary) : Promise.resolve(null),
  ]);
  ragSpan.end();
  const webResults = documentChunks.length < MIN_LOCAL_CHUNKS ? await searchWeb(`crescita personale ${userMessage}`, 4) : [];
  return { personaExamples, documentChunks, platformChunks, webResults, cot };
}
