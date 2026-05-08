/**
 * GrowthAgent v9 — RAG platform_content + Generative UI.
 *
 * CHANGES v9
 * ──────────
 * Point 7 — RAG platform content:
 *   In the general pipeline, retrieve() now pulls 'platform_content' chunks
 *   (topK=3, minScore=0.30) in parallel with document/persona retrieval.
 *   Platform chunks are passed separately to buildSystemPrompt() so
 *   prompt-builder can inject them in a dedicated [PIATTAFORMA] section.
 *
 * Point 8 — Generative UI:
 *   The standard OpenAI stream now includes UI_TOOLS in the 'tools' array
 *   and tool_choice='auto'. If finish_reason==='tool_calls', agent extracts
 *   the function call and yields { type: 'ui_tool', name, args } instead
 *   of plain tokens. Supervisor is skipped for UI tool responses.
 *
 * Voice fast-path and specialist/parallel routing unchanged from v8.
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
import { UI_TOOLS, type UiToolName, type UiToolArgs } from "./ui-tools";
import type { RetrievedChunk } from "./retriever";
import type { CoTResult } from "./chain-of-thought";
import type { RouteDecision } from "./router-agent";
import type { SupervisorResult } from "./supervisor-agent";

import "./specialists/career-agent";
import "./specialists/mindset-agent";
import "./specialists/habits-agent";

export const GROWTH_AGENT_MODEL       = "gpt-4o";
export const GROWTH_AGENT_VOICE_MODEL = "gpt-4o-mini";

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
  | { type: "token";    value: string }
  | { type: "status";   value: string; domain?: RouteDecision["domain"] }
  | { type: "ui_tool";  name: UiToolName; args: UiToolArgs }   // ← v9: Generative UI
  | { type: "done";     sources: RetrievedChunk[]; cot?: CoTResult | null; evalResult?: EvalResult; routeDecision?: RouteDecision; supervisorResult?: SupervisorResult }
  | { type: "error";    message: string }
> {
  const {
    userId, sessionId, userContext, history, userMessage,
    maxHistory = 12, voiceMode = false,
  } = opts;

  // ── VOICE FAST PATH (unchanged) ───────────────────────────────────────────
  if (voiceMode) {
    const systemPrompt  = buildVoiceSystemPrompt(userContext.name);
    const recentHistory = history.slice(-6);
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...recentHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: userMessage },
    ];
    try {
      const stream = await openai.chat.completions.create({
        model: GROWTH_AGENT_VOICE_MODEL, messages, stream: true,
        temperature: 0.80, max_tokens: 120,
      });
      const tokenBuffer: string[] = [];
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) { tokenBuffer.push(delta); yield { type: "token", value: delta }; }
      }
      yield { type: "done", sources: [] };
      const assistantContent = tokenBuffer.join("");
      if (sessionId) {
        const turns = [
          ...history.slice(-4),
          { role: "user" as const, content: userMessage },
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

  // ── STANDARD PATH ─────────────────────────────────────────────────────────
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
    `[agent] domain=${routeDecision.domain}(${routeDecision.confidence.toFixed(2)})` +
    (routeDecision.secondaryRoute ? ` + secondary=${routeDecision.secondaryRoute.domain}` : "") +
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

  // v9: retrieve platform_content in parallel with other chunks
  const [personaExamples, documentChunks, platformChunks, cot] = await Promise.all([
    retrieve(userMessage, userId, { topK: 3, minScore: 0.30, sourceTypes: ["persona_example"] }),
    retrieve(userMessage, userId, { topK: 5, minScore: 0.35, sourceTypes: ["document", "user_note"] }),
    retrieve(userMessage, userId, { topK: 3, minScore: 0.30, sourceTypes: ["platform_content"] }),
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
    platformChunks, // ← v9
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

    // v9: include UI_TOOLS for Generative UI
    const stream = await openai.chat.completions.create({
      model: GROWTH_AGENT_MODEL,
      messages,
      stream: true,
      temperature,
      max_tokens: evalResult.level === "low" ? 300 : 600,
      tools: UI_TOOLS,
      tool_choice: "auto",
      stream_options: { include_usage: false },
    });

    const tokenBuffer:   string[] = [];
    let   toolCallName:  string   = "";
    let   toolCallArgs:  string   = "";
    let   finishReason:  string   = "stop";

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;
      finishReason = choice.finish_reason ?? finishReason;

      // Regular text token
      if (choice.delta?.content) {
        tokenBuffer.push(choice.delta.content);
      }

      // Tool call accumulation
      if (choice.delta?.tool_calls) {
        for (const tc of choice.delta.tool_calls) {
          if (tc.function?.name)      toolCallName += tc.function.name;
          if (tc.function?.arguments) toolCallArgs += tc.function.arguments;
        }
      }
    }

    // ── GENERATIVE UI branch ──────────────────────────────────────────────
    if (finishReason === "tool_calls" && toolCallName) {
      let args: UiToolArgs;
      try {
        args = JSON.parse(toolCallArgs) as UiToolArgs;
      } catch {
        // Malformed args: fall back to text error
        yield { type: "error", message: `UI tool args parse error: ${toolCallArgs}` };
        yield { type: "done", sources: [...personaExamples, ...documentChunks, ...platformChunks, ...webResults], evalResult, routeDecision };
        return;
      }

      yield { type: "ui_tool", name: toolCallName as UiToolName, args };
      yield {
        type: "done",
        sources: [...personaExamples, ...documentChunks, ...platformChunks, ...webResults],
        evalResult, routeDecision,
      };
      scheduleMemorySave(`[UI: ${toolCallName}]`, sessionId ?? Date.now());
      return;
    }

    // ── Regular text branch ───────────────────────────────────────────────
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
      console.log(`[supervisor] FAIL (score=${supervisorResult.score}) — rewriting`);
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
      sources: [...personaExamples, ...documentChunks, ...platformChunks, ...webResults],
      cot, evalResult, routeDecision, supervisorResult,
    };

    scheduleMemorySave(finalText, sessionId ?? Date.now());
  } catch (err) {
    yield { type: "error", message: err instanceof Error ? err.message : String(err) };
  }
}
