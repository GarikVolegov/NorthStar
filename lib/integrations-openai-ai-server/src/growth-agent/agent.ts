/**
 * GrowthAgent — orchestrates the full RAG pipeline for the personal growth coach.
 *
 * Per ogni messaggio dell'utente:
 *   1. Retrieve persona examples (come ragiona il coach)
 *   2. Retrieve document chunks (cosa sa il coach)
 *   3. Se i chunk locali sono < MIN_LOCAL_CHUNKS, cerca online con Tavily
 *   4. Costruisce il system prompt con tutto il contesto
 *   5. Chiama GPT-4o in streaming e yielda i token
 *
 * Supporta SSE streaming via AsyncGenerator.
 */
import OpenAI from "openai";
import { openai } from "../client";
import { retrieve } from "./retriever";
import { searchWeb, MIN_LOCAL_CHUNKS } from "./web-search";
import { buildSystemPrompt, type UserContext } from "./prompt-builder";
import type { RetrievedChunk } from "./retriever";

export const GROWTH_AGENT_MODEL = "gpt-4o";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface GrowthAgentOptions {
  userId: number;
  userContext: UserContext;
  /** Full conversation history (last N messages for context window) */
  history: ChatMessage[];
  /** Latest user message */
  userMessage: string;
  /** Max history messages to include (default 12) */
  maxHistory?: number;
}

/**
 * Streams the growth agent response token by token.
 * Yields: { type: 'token', value: string } | { type: 'done', sources: RetrievedChunk[] }
 */
export async function* runGrowthAgent(
  opts: GrowthAgentOptions,
): AsyncGenerator<
  | { type: "token"; value: string }
  | { type: "done"; sources: RetrievedChunk[] }
  | { type: "error"; message: string }
> {
  const { userId, userContext, history, userMessage, maxHistory = 12 } = opts;

  // ── 1. Retrieve persona examples (how the coach reasons) ──────────────────
  const personaExamples = await retrieve(userMessage, userId, {
    topK: 3,
    minScore: 0.30,
    sourceTypes: ["persona_example"],
  });

  // ── 2. Retrieve document knowledge ────────────────────────────────────────
  const documentChunks = await retrieve(userMessage, userId, {
    topK: 5,
    minScore: 0.35,
    sourceTypes: ["document", "user_note"],
  });

  // ── 3. Web search fallback ─────────────────────────────────────────────────
  let webResults: RetrievedChunk[] = [];
  if (documentChunks.length < MIN_LOCAL_CHUNKS) {
    webResults = await searchWeb(
      `crescita personale ${userMessage}`,
      4,
    );
  }

  // ── 4. Build system prompt ─────────────────────────────────────────────────
  const systemPrompt = buildSystemPrompt({
    userContext,
    personaExamples,
    documentChunks,
    webResults,
  });

  // ── 5. Build messages array ────────────────────────────────────────────────
  const recentHistory = history.slice(-maxHistory);
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...recentHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  // ── 6. Stream response ────────────────────────────────────────────────────
  try {
    const stream = await openai.chat.completions.create({
      model: GROWTH_AGENT_MODEL,
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 1500,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield { type: "token", value: delta };
    }

    const allSources = [...personaExamples, ...documentChunks, ...webResults];
    yield { type: "done", sources: allSources };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    yield { type: "error", message: msg };
  }
}
