/**
 * GrowthAgent v8 — voice mode fast path.
 *
 * CHANGES v8
 * ──────────
 * Adds voiceMode support to GrowthAgentOptions.
 * When voiceMode === true:
 *   - Skip router, RAG, CoT, self-evaluator, supervisor
 *   - Use buildVoiceSystemPrompt() (breve, TTS-friendly)
 *   - Use a lighter model (gpt-4o-mini) for lower latency
 *   - max_tokens capped at 120 (max ~2-3 frasi)
 *   - temperature 0.80 (tono più naturale/conversazionale)
 *
 * All other paths unchanged from v7.1.
 *
 * ROUTING DECISION (in order):
 * ┌─────────────────────────────────────────────────────────────┐
 * | voiceMode === true → Wendy fast path (no RAG, no CoT)                      |
 * ├─────────────────────────────────────────────────────────────┤
 * | Multi-domain: primaryConf >= threshold AND secondaryRoute present          |
 * |   → runParallelHandoff(primary, secondary)                                 |
 * ├─────────────────────────────────────────────────────────────┤
 * | Single-domain: primaryConf >= threshold AND domain != 'general'            |
 * |   → specialist.run(primary)                                                |
 * ├─────────────────────────────────────────────────────────────┤
 * | Fallback: confidence < threshold OR domain = 'general'                     |
 * |   → general pipeline (RAG + CoT + supervisor)                              |
 * └─────────────────────────────────────────────────────────────┘
 */
import OpenAI from "openai";
import { openai } from "../client";
import { retrieve } from "./retriever";
import { searchWeb, MIN_LOCAL_CHUNKS } from "./web-search";
import { buildSystemPrompt, buildVoiceSystemPrompt, type UserContext } from "./prompt-builder";
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

export const GROWTH_AGENT_MODEL       = "gpt-4o";
export const GROWTH_AGENT_VOICE_MODEL = "gpt-4o-mini"; // modello leggero per voice mode

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  domain?: RouteDecision["domain"];
}

export interface GrowthAgentOptions {
  userId:           number;
  sessionId?:       number;
  userContext:      UserContext & { memorySection?: string };
  history:          ChatMessage[];
  userMessage:      string;
  maxHistory?:      number;
  memoryFactCount?: number;
  /** Se true: bypassa RAG/CoT/supervisor, usa WENDY_SYSTEM_PROMPT ottimizzato TTS */
  voiceMode?:       boolean;
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
  const {
    userId, sessionId, userContext, history, userMessage,
    maxHistory = 12, voiceMode = false,
  } = opts;

  // ── VOICE FAST PATH ──────────────────────────────────────────────────────────
  //
  // Bypassa completamente RAG, CoT, router, supervisor.
  // Priorità: latenza < 600ms (TTS non può aspettare).
  //
  if (voiceMode) {
    const systemPrompt = buildVoiceSystemPrompt(userContext.name);
    const recentHistory = history.slice(-6); // finestra corta: meno token, meno latenza

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...recentHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: userMessage },
    ];

    try {
      const stream = await openai.chat.completions.create({
        model:       GROWTH_AGENT_VOICE_MODEL,
        messages,
        stream:      true,
        temperature: 0.80,
        max_tokens:  120, // ~2-3 frasi vocali
      });

      const tokenBuffer: string[] = [];
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          tokenBuffer.push(delta);
          yield { type: "token", value: delta };
        }
      }

      yield { type: "done", sources: [] };

      // Salva memoria in background anche in voice mode
      const assistantContent = tokenBuffer.join("");
      if (sessionId) {
        const turns = [
          ...history.slice(-4),
          { role: "user" as const,      content: userMessage },
          { role: "assistant" as const, content: assistantContent },
        ];
        (async () => {
          try {
            const extracted = await extractMemory(turns);
            if (extracted && (extracted.facts.length > 0 || extracted.patterns.length > 0)) {
              await mergeMemory(userId, sessionId, extracted);
            }
          } catch { /* non-critical */ }
        })();
      }
    } catch (err) {
      yield { type: "error", message: err instanceof Error ? err.message : String(err) };
    }
    return;
  }

  // ── STANDARD PATH (v7.1 unchanged) ───────────────────────────────────────────

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

  if (primaryConfident && routeDecision.secondaryRoute) {
    let fullResponse = "";
    for await (const event of runParallelHandoff({
      userId, userContext: enrichedContext, history, userMessage,
      primaryRoute:   routeDecision,
      secondaryRoute: routeDecision.secondaryRoute,
      memoryFactCount, maxHistory,
    })) {
      if (event.type === "token") fullResponse += event.value;
      yield event;
      if (event.type === "done") scheduleMemorySave(fullResponse, sessionId ?? Date.now());
    }
    return;
  }

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

    const supervisorInput = {
      userMessage, draft,
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
