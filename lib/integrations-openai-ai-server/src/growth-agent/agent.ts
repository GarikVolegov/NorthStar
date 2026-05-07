/**
 * GrowthAgent v7 — parallel multi-agent handoff.
 *
 * CHANGES v7
 * ──────────
 * Adds a third routing path: ParallelHandoff.
 * When the RouterAgent detects a multi-domain message (secondaryRoute present),
 * instead of sending to one specialist we fork to BOTH concurrently.
 *
 * ROUTING DECISION (in order):
 * ┌─────────────────────────────────────────────────────────────┐
 * | Multi-domain: primaryConf >= threshold AND secondaryRoute present          |
 * |   → runParallelHandoff(primary, secondary)                                 |
 * ├─────────────────────────────────────────────────────────────┤
 * | Single-domain: primaryConf >= threshold AND domain != 'general'            |
 * |   → specialist.run(primary)                                                |
 * ├─────────────────────────────────────────────────────────────┤
 * | Fallback: confidence < threshold OR domain = 'general'                     |
 * |   → general pipeline (RAG + CoT + supervisor)                              |
 * └─────────────────────────────────────────────────────────────┘
 *
 * CHANGES v7.1
 * ────────────
 * SupervisorEvalInput now includes userId + sessionId so that rewrite()
 * can fire-and-forget the log to supervisor_logs for the self-improvement job.
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
import { runParallelHandoff } from "./parallel-handoff";
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
  domain?: RouteDecision["domain"];
}

export interface GrowthAgentOptions {
  userId:           number;
  sessionId?:       number;   // ← v7.1: forwarded to supervisor for DB logging
  userContext:      UserContext & { memorySection?: string };
  history:          ChatMessage[];
  userMessage:      string;
  maxHistory?:      number;
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
  | { type: "status"; value: string; domain?: RouteDecision["domain"] }
  | { type: "done";   sources: RetrievedChunk[]; cot?: CoTResult | null; evalResult?: EvalResult; routeDecision?: RouteDecision; supervisorResult?: SupervisorResult }
  | { type: "error";  message: string }
> {
  const { userId, sessionId, userContext, history, userMessage, maxHistory = 12 } = opts;

  // ── 1. Route + Load memory IN PARALLEL ─────────────────────────────────────
  const [routeDecision, userMemory] = await Promise.all([
    routerAgent.route(userMessage, history),
    loadMemory(userId).catch((err) => {
      console.warn("[agent] memory load failed:", err instanceof Error ? err.message : err);
      return { facts: [], patterns: [] };
    }),
  ]);

  const memorySection   = buildMemorySection(userMemory);
  const memoryFactCount = userMemory.facts.length;

  const enrichedContext: UserContext & { memorySection?: string } = {
    ...userContext,
    memorySection: memorySection || userContext.memorySection,
  };

  console.log(
    `[agent] domain=${routeDecision.domain}(${routeDecision.confidence.toFixed(2)}) threshold=${routeDecision.threshold.toFixed(2)}` +
    (routeDecision.secondaryRoute
      ? ` + secondary=${routeDecision.secondaryRoute.domain}(${routeDecision.secondaryRoute.confidence.toFixed(2)})`
      : "") +
    ` | memory: ${userMemory.facts.length} facts` +
    (sessionId ? ` | session: ${sessionId}` : ""),
  );

  function scheduleMemorySave(assistantResponse: string, sid: number): void {
    const turns = [
      ...history.slice(-8),
      { role: "user",      content: userMessage },
      { role: "assistant", content: assistantResponse },
    ];
    (async () => {
      try {
        const extracted = await extractMemory(turns);
        if (extracted && (extracted.facts.length > 0 || extracted.patterns.length > 0)) {
          await mergeMemory(userId, sid, extracted);
          console.log(`[memory] saved ${extracted.facts.length} facts + ${extracted.patterns.length} patterns`);
        }
      } catch (err) {
        console.warn("[memory] save failed:", err instanceof Error ? err.message : err);
      }
    })();
  }

  const primaryConfident =
    routeDecision.confidence >= routeDecision.threshold &&
    routeDecision.domain !== "general";

  // ── 2a. PARALLEL HANDOFF ──────────────────────────────────────────────────────
  if (primaryConfident && routeDecision.secondaryRoute) {
    let fullResponse = "";
    for await (const event of runParallelHandoff({
      userId,
      userContext:     enrichedContext,
      history,
      userMessage,
      primaryRoute:   routeDecision,
      secondaryRoute: routeDecision.secondaryRoute,
      memoryFactCount,
      maxHistory,
    })) {
      if (event.type === "token") fullResponse += event.value;
      yield event;
      if (event.type === "done") scheduleMemorySave(fullResponse, sessionId ?? Date.now());
    }
    return;
  }

  // ── 2b. SINGLE SPECIALIST ───────────────────────────────────────────────────────
  if (primaryConfident) {
    const specialist = getSpecialist(routeDecision.domain);
    if (specialist) {
      let fullResponse = "";
      for await (const event of specialist.run({
        userId, userContext: enrichedContext, history, userMessage,
        routeDecision, memoryFactCount, maxHistory,
      })) {
        if (event.type === "token") fullResponse += event.value;
        yield event;
        if (event.type === "done") scheduleMemorySave(fullResponse, sessionId ?? Date.now());
      }
      return;
    }
  }

  // ── 2c. GENERAL FALLBACK ───────────────────────────────────────────────────────
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

    // v7.1: include userId + sessionId so supervisor.rewrite() can log to DB
    const supervisorInput = {
      userMessage,
      draft,
      domain:    routeDecision.domain,
      intent:    routeDecision.intent,
      userId:    String(userId),
      sessionId: sessionId,
    };

    let supervisorResult = supervisorAgent.evaluate(supervisorInput);
    let finalText        = draft;

    if (!supervisorResult.pass) {
      console.log(`[supervisor] FAIL (score=${supervisorResult.score}) — rewriting + logging`);
      finalText        = await supervisorAgent.rewrite(supervisorInput, supervisorResult);
      supervisorResult = { ...supervisorResult, rewritten: true };
    } else {
      console.log(`[supervisor] PASS (score=${supervisorResult.score})`);
    }

    const CHUNK_SIZE = 4;
    for (let i = 0; i < finalText.length; i += CHUNK_SIZE) {
      yield { type: "token", value: finalText.slice(i, i + CHUNK_SIZE) };
    }

    yield {
      type: "done",
      sources: [...personaExamples, ...documentChunks, ...webResults],
      cot, evalResult, routeDecision, supervisorResult,
    };

    scheduleMemorySave(finalText, sessionId ?? Date.now());
  } catch (err) {
    yield { type: "error", message: err instanceof Error ? err.message : String(err) };
  }
}
