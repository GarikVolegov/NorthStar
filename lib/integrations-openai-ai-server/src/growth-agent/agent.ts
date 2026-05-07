/**
 * GrowthAgent v3 — adds self-evaluation layer.
 *
 * Flow per messaggio:
 *   1. Retrieve persona examples     (chi è il coach)
 *   2. Retrieve document chunks      (cosa sa il coach)
 *   3. Web search fallback           (se kb locale è scarsa)
 *   4. [PARALLEL] Hidden CoT         (cosa sta davvero succedendo)
 *   5. [PARALLEL] Self-evaluation    (ho abbastanza contesto per rispondere bene?)
 *   6. Build system prompt           (con tono + memoria + incertezza + Socratica)
 *   7. Stream GPT-4o response
 *
 * Steps 4 and 5 run in parallel AFTER retrieval — zero extra latency.
 * evalResult is returned in the 'done' SSE event for the frontend badge.
 */
import OpenAI from "openai";
import { openai } from "../client";
import { retrieve } from "./retriever";
import { searchWeb, MIN_LOCAL_CHUNKS } from "./web-search";
import { buildSystemPrompt, type UserContext } from "./prompt-builder";
import { runChainOfThought } from "./chain-of-thought";
import { evaluateSelf, type EvalResult } from "./self-evaluator";
import type { RetrievedChunk } from "./retriever";
import type { CoTResult } from "./chain-of-thought";

export const GROWTH_AGENT_MODEL = "gpt-4o";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface GrowthAgentOptions {
  userId: number;
  userContext: UserContext & { memorySection?: string };
  history: ChatMessage[];
  userMessage: string;
  maxHistory?: number;
  /** Number of memory facts loaded — used by self-evaluator */
  memoryFactCount?: number;
}

function buildConversationSummary(history: ChatMessage[]): string {
  return history
    .slice(-4)
    .map((m) => `${m.role === "user" ? "Utente" : "Coach"}: ${m.content.slice(0, 200)}`)
    .join("\n");
}

export async function* runGrowthAgent(
  opts: GrowthAgentOptions,
): AsyncGenerator<
  | { type: "token"; value: string }
  | { type: "done"; sources: RetrievedChunk[]; cot?: CoTResult | null; evalResult?: EvalResult }
  | { type: "error"; message: string }
> {
  const {
    userId,
    userContext,
    history,
    userMessage,
    maxHistory = 12,
    memoryFactCount = 0,
  } = opts;

  const conversationSummary = buildConversationSummary(history);

  // ── Steps 1-2: RAG retrieval ────────────────────────────────────────────────
  const [personaExamples, documentChunks, cot] = await Promise.all([
    retrieve(userMessage, userId, { topK: 3, minScore: 0.30, sourceTypes: ["persona_example"] }),
    retrieve(userMessage, userId, { topK: 5, minScore: 0.35, sourceTypes: ["document", "user_note"] }),
    runChainOfThought(userMessage, conversationSummary),
  ]);

  // ── Step 3: Web fallback ────────────────────────────────────────────────────
  let webResults: RetrievedChunk[] = [];
  if (documentChunks.length < MIN_LOCAL_CHUNKS) {
    webResults = await searchWeb(`crescita personale ${userMessage}`, 4);
  }

  // ── Step 5: Self-evaluation (pure local — no extra API call) ────────────────
  const evalResult = evaluateSelf({
    userMessage,
    documentChunks,
    webResults,
    cot,
    memoryFactCount,
  });

  // ── Step 6: Build system prompt ────────────────────────────────────────────
  const systemPrompt = buildSystemPrompt({
    userContext,
    personaExamples,
    documentChunks,
    webResults,
    cot,
    userMessage,
    evalResult,
  });

  // ── Step 7: Stream ───────────────────────────────────────────────────────────
  const recentHistory = history.slice(-maxHistory);
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...recentHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  // Temperature slightly lower when uncertain — less hallucination risk
  const temperature = evalResult.level === "low" ? 0.45 : 0.72;

  try {
    const stream = await openai.chat.completions.create({
      model: GROWTH_AGENT_MODEL,
      messages,
      stream: true,
      temperature,
      max_tokens: evalResult.level === "low" ? 300 : 600, // shorter when uncertain
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield { type: "token", value: delta };
    }

    yield {
      type: "done",
      sources: [...personaExamples, ...documentChunks, ...webResults],
      cot,
      evalResult,   // returned to frontend for badge
    };
  } catch (err) {
    yield { type: "error", message: err instanceof Error ? err.message : String(err) };
  }
}
