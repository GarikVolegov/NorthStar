/**
 * GrowthAgent v2 — orchestrates the full RAG + CoT + tone pipeline.
 *
 * Flow per ogni messaggio:
 *   1. Retrieve persona examples  (chi è il coach)
 *   2. Retrieve document chunks   (cosa sa il coach)
 *   3. Web search fallback        (se kb locale è scarsa)
 *   4. [NEW] Hidden CoT pass      (cosa sta DAVVERO succedendo)
 *   5. Build system prompt        (tutto assemblato con tono + Socratica)
 *   6. Stream GPT-4o response     (la risposta finale all'utente)
 *
 * The CoT pass (step 4) runs in PARALLEL with steps 1-3 to save latency.
 * Total added latency: ~0ms (parallel) + 300ms CoT if not cached.
 */
import OpenAI from "openai";
import { openai } from "../client";
import { retrieve } from "./retriever";
import { searchWeb, MIN_LOCAL_CHUNKS } from "./web-search";
import { buildSystemPrompt, type UserContext } from "./prompt-builder";
import { runChainOfThought } from "./chain-of-thought";
import type { RetrievedChunk } from "./retriever";
import type { CoTResult } from "./chain-of-thought";

export const GROWTH_AGENT_MODEL = "gpt-4o";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface GrowthAgentOptions {
  userId: number;
  userContext: UserContext;
  history: ChatMessage[];
  userMessage: string;
  maxHistory?: number;
}

/** Builds a short conversation summary for CoT context (last 2 exchanges) */
function buildConversationSummary(history: ChatMessage[]): string {
  const last4 = history.slice(-4);
  if (last4.length === 0) return "";
  return last4
    .map((m) => `${m.role === "user" ? "Utente" : "Coach"}: ${m.content.slice(0, 200)}`)
    .join("\n");
}

export async function* runGrowthAgent(
  opts: GrowthAgentOptions,
): AsyncGenerator<
  | { type: "token"; value: string }
  | { type: "done"; sources: RetrievedChunk[]; cot?: CoTResult | null }
  | { type: "error"; message: string }
> {
  const { userId, userContext, history, userMessage, maxHistory = 12 } = opts;

  // ── Steps 1-4: Run RAG retrieval + CoT in parallel ─────────────────────────
  const conversationSummary = buildConversationSummary(history);

  const [
    personaExamples,
    documentChunks,
    cot,
  ] = await Promise.all([
    // 1. Persona examples
    retrieve(userMessage, userId, {
      topK: 3,
      minScore: 0.30,
      sourceTypes: ["persona_example"],
    }),
    // 2. Document knowledge
    retrieve(userMessage, userId, {
      topK: 5,
      minScore: 0.35,
      sourceTypes: ["document", "user_note"],
    }),
    // 4. Hidden CoT (parallel with retrieval — adds ~0ms to latency)
    runChainOfThought(userMessage, conversationSummary),
  ]);

  // ── Step 3: Web fallback (sequential, only if needed) ─────────────────────
  let webResults: RetrievedChunk[] = [];
  if (documentChunks.length < MIN_LOCAL_CHUNKS) {
    webResults = await searchWeb(`crescita personale ${userMessage}`, 4);
  }

  // ── Step 5: Build full system prompt ──────────────────────────────────────
  const systemPrompt = buildSystemPrompt({
    userContext,
    personaExamples,
    documentChunks,
    webResults,
    cot,                  // NEW: hidden CoT injected
    userMessage,          // NEW: needed for Socratic directive
  });

  // ── Step 6: Build messages + stream ───────────────────────────────────────
  const recentHistory = history.slice(-maxHistory);
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...recentHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  try {
    const stream = await openai.chat.completions.create({
      model: GROWTH_AGENT_MODEL,
      messages,
      stream: true,
      temperature: 0.72,  // slightly raised for more natural tone variation
      max_tokens: 600,    // tighter limit — responses should be dense not long
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield { type: "token", value: delta };
    }

    yield {
      type: "done",
      sources: [...personaExamples, ...documentChunks, ...webResults],
      cot,  // returned to caller (can be logged/displayed in debug mode)
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    yield { type: "error", message: msg };
  }
}
