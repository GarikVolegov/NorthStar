/**
 * GrowthAgent v6 — SSE status events + adaptive threshold routing.
 *
 * CHANGES v6
 * ──────────
 * - Routing now uses routeDecision.threshold (adaptive) instead of fixed 0.60.
 * - Yields 'status' SSE events at each pipeline stage so the frontend can
 *   show contextual loading messages instead of a generic spinner.
 *
 * STATUS EVENTS emitted in general fallback path:
 *   "🔍 Analizzando il tuo profilo..."
 *   "🧠 Ragionamento in corso..."
 *   "✍️ Generando risposta..."
 *
 * (Specialist path emits its own status events from specialist-agent.ts v4)
 *
 * FULL FLOW:
 *   1. [PARALLEL] RouterAgent.route() + loadMemory()
 *   2a. confidence >= threshold → SpecialistAgent (emits own status)
 *   2b. fallback → general pipeline with status events
 *   3. yield 'done'
 *   4. [FIRE & FORGET] memory save
 */
import OpenAI from "openai";
import { openai } from "../client";
import { retrieve } from "./retriever";
import { searchWeb, MIN_LOCAL_CHUNKS } from "./web-search";
import { buildSystemPrompt, type UserContext } from "./prompt-builder";
import { runChainOfThought } from "./chain-of-thought";
import { evaluateSelf, type EvalResult } from "./self-evaluator";
import { routerAgent } from "./router-agent";
import { getSpecialist } from "./specialist-agent";
import { supervisorAgent } from "./supervisor-agent";
import { loadMemory, buildMemorySection, extractMemory, mergeMemory } from "./memory-manager";
import type { RetrievedChunk } from "./retriever";
import type { CoTResult } from "./chain-of-thought";
import type { RouteDecision } from "./router-agent";
import type { SupervisorResult } from "./supervisor-agent";

import "./specialists/career-agent";
import "./specialists/mindset-agent";
import "./specialists/habits-agent";

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
  | { type: "token";  value: string }
  | { type: "status"; value: string }           // ← NEW v6
  | { type: "done";   sources: RetrievedChunk[]; cot?: CoTResult | null; evalResult?: EvalResult; routeDecision?: RouteDecision; supervisorResult?: SupervisorResult }
  | { type: "error";  message: string }
> {
  const { userId, userContext, history, userMessage, maxHistory = 12 } = opts;

  // ── 1. Route + Load memory IN PARALLEL ─────────────────────────────────────
  const [routeDecision, userMemory] = await Promise.all([
    routerAgent.route(userMessage, history),
    loadMemory(userId).catch((err) => {
      console.warn("[agent] memory load failed:", err instanceof Error ? err.message : err);
      return { facts: [], patterns: [] };
    }),
  ]);

  console.log(
    `[agent] domain=${routeDecision.domain} intent=${routeDecision.intent} ` +
    `conf=${routeDecision.confidence.toFixed(2)} threshold=${routeDecision.threshold.toFixed(2)} ` +
    `| memory: ${userMemory.facts.length} facts, ${userMemory.patterns.length} patterns`,
  );

  const memorySection   = buildMemorySection(userMemory);
  const memoryFactCount = userMemory.facts.length;

  const enrichedContext: UserContext & { memorySection?: string } = {
    ...userContext,
    memorySection: memorySection || userContext.memorySection,
  };

  function scheduleMemorySave(assistantResponse: string, sessionId: number): void {
    const turns = [
      ...history.slice(-8),
      { role: "user",      content: userMessage },
      { role: "assistant", content: assistantResponse },
    ];
    (async () => {
      try {
        const extracted = await extractMemory(turns);
        if (extracted && (extracted.facts.length > 0 || extracted.patterns.length > 0)) {
          await mergeMemory(userId, sessionId, extracted);
          console.log(`[memory] saved ${extracted.facts.length} facts + ${extracted.patterns.length} patterns`);
        }
      } catch (err) {
        console.warn("[memory] save failed:", err instanceof Error ? err.message : err);
      }
    })();
  }

  // ── 2a. Specialist path (uses adaptive threshold) ──────────────────────────
  if (routeDecision.confidence >= routeDecision.threshold && routeDecision.domain !== "general") {
    const specialist = getSpecialist(routeDecision.domain);
    if (specialist) {
      let fullResponse = "";
      for await (const event of specialist.run({
        userId, userContext: enrichedContext, history, userMessage,
        routeDecision, memoryFactCount, maxHistory,
      })) {
        if (event.type === "token") fullResponse += event.value;
        yield event;
        if (event.type === "done") scheduleMemorySave(fullResponse, Date.now());
      }
      return;
    }
  }

  // ── 2b. General fallback with status events ─────────────────────────────────
  yield { type: "status", value: "🔍 Analizzando il tuo profilo..." };

  const conversationSummary = buildConversationSummary(history);
  const [personaExamples, documentChunks, cot] = await Promise.all([
    retrieve(userMessage, userId, { topK: 3, minScore: 0.30, sourceTypes: ["persona_example"] }),
    retrieve(userMessage, userId, { topK: 5, minScore: 0.35, sourceTypes: ["document", "user_note"] }),
    runChainOfThought(userMessage, conversationSummary),
  ]);

  let webResults: RetrievedChunk[] = [];
  if (documentChunks.length < MIN_LOCAL_CHUNKS) {
    webResults = await searchWeb(`crescita personale ${userMessage}`, 4);
  }

  yield { type: "status", value: "🧠 Ragionamento in corso..." };

  const evalResult   = evaluateSelf({ userMessage, documentChunks, webResults, cot, memoryFactCount });
  const systemPrompt = buildSystemPrompt({
    userContext: enrichedContext, personaExamples, documentChunks,
    webResults, cot, userMessage, evalResult,
  });

  const recentHistory = history.slice(-maxHistory);
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...recentHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userMessage },
  ];

  const temperature = evalResult.level === "low" ? 0.45 : 0.72;

  try {
    yield { type: "status", value: "✍️ Generando risposta..." };

    const stream = await openai.chat.completions.create({
      model: GROWTH_AGENT_MODEL, messages, stream: true, temperature,
      max_tokens: evalResult.level === "low" ? 300 : 600,
    });

    const tokenBuffer: string[] = [];
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) tokenBuffer.push(delta);
    }

    const draft = tokenBuffer.join("");
    const supervisorInput = { userMessage, draft, domain: routeDecision.domain, intent: routeDecision.intent };
    let supervisorResult  = supervisorAgent.evaluate(supervisorInput);
    let finalText         = draft;

    if (!supervisorResult.pass) {
      console.log(`[supervisor] FAIL (score=${supervisorResult.score})`);
      finalText = await supervisorAgent.rewrite(supervisorInput, supervisorResult);
      supervisorResult = { ...supervisorResult, rewritten: true };
    } else {
      console.log(`[supervisor] PASS (score=${supervisorResult.score})`);
    }

    const CHUNK_SIZE = 4;
    for (let i = 0; i < finalText.length; i += CHUNK_SIZE) {
      yield { type: "token", value: finalText.slice(i, i + CHUNK_SIZE) };
    }

    yield { type: "done", sources: [...personaExamples, ...documentChunks, ...webResults],
      cot, evalResult, routeDecision, supervisorResult };

    scheduleMemorySave(finalText, Date.now());
  } catch (err) {
    yield { type: "error", message: err instanceof Error ? err.message : String(err) };
  }
}
