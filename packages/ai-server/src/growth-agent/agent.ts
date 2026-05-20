import OpenAI from "openai";
import { openai } from "../client";
import { retrieve } from "./retriever";
import { searchWeb, MIN_LOCAL_CHUNKS } from "./web-search";
import { buildSystemPrompt, buildVoiceSystemPrompt, type UserContext } from "./prompt-builder";
import { runChainOfThought } from "./chain-of-thought";
import { evaluateSelf, buildClarification, type EvalResult } from "./self-evaluator";
import { routerAgent } from "./router-agent";
import { buildRoutingHistorySummary } from "./router-memory";
import { getSpecialist } from "./specialist-agent";
import { supervisorAgent } from "./supervisor-agent";
import { loadMemory, buildMemorySection, extractMemory, mergeMemory, type UserMemory } from "./memory-manager";
import { runParallelHandoff } from "./parallel-handoff";
import { UI_TOOLS, type UiToolName, type UiToolArgs } from "./ui-tools";
import { getToolsForIntent, toolsToOpenAIFormat } from "../wendy-router/tool-registry";
import { executeToolCall } from "../wendy-router/tool-handlers";
import type { WendyIntent } from "../wendy-router/types";
import type { RetrievedChunk } from "./retriever";
import type { CoTResult } from "./chain-of-thought";
import type { RouteDecision } from "./router-agent";
import type { SupervisorResult } from "./supervisor-agent";
import { logger, type LoggerFields } from "../logger";
import { recordRequest, recordError, recordLlmTokens } from "../metrics";
import { wendyLatencySeconds } from "../metrics";
import { startSpan } from "../tracing";
import { FF } from "../feature-flags";
import { withTimeout } from "../utils";
import { selectModelFor, modelFor } from "../model-router";

import "./specialists/career-agent";
import "./specialists/mindset-agent";
import "./specialists/habits-agent";
import "./specialists/trading-agent";
import "./specialists/health-agent";

/**
 * @deprecated kept for backward compatibility — use `selectModelFor("growth-agent-chat", { isPremium })` instead.
 * The actual model is chosen per-request inside `runGrowthAgent` via the router,
 * so this constant only reflects the *baseline* (non-premium, standard complexity).
 */
export const GROWTH_AGENT_MODEL       = modelFor("growth-agent-chat");
export const GROWTH_AGENT_VOICE_MODEL = modelFor("growth-agent-voice");

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  domain?: RouteDecision["domain"] | undefined;
}

// Set dei nomi tool UI (generative UI) per distinguerli dai Wendy domain tools
const UI_TOOL_NAMES = new Set<string>(
  (UI_TOOLS as Array<{ function: { name: string } }>).map((t) => t.function.name),
);

export interface GrowthAgentOptions {
  userId:           number;
  sessionId?:       number | undefined;
  userContext:      UserContext & { memorySection?: string | undefined };
  history:          ChatMessage[];
  userMessage:      string;
  maxHistory?:      number | undefined;
  memoryFactCount?: number | undefined;
  voiceMode?:       boolean | undefined;
  requestId?:       string | undefined;
  wendyIntent?:     WendyIntent | undefined;   // passato da ai-wendy.ts per scegliere i tool di dominio
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
  | { type: "token";     value: string }
  | { type: "status";    value: string; domain?: RouteDecision["domain"] | undefined }
  | { type: "ui_tool";   name: UiToolName; args: UiToolArgs }
  | { type: "tool_call"; name: string; result: unknown }
  | { type: "done";     sources: RetrievedChunk[]; cot?: CoTResult | null | undefined; evalResult?: EvalResult | undefined; routeDecision?: RouteDecision | undefined; supervisorResult?: SupervisorResult | undefined }
  | { type: "error";    message: string }
> {
  const {
    userId, sessionId, userContext, history, userMessage,
    maxHistory = 12, voiceMode = false, requestId,
    wendyIntent,
  } = opts;

  const logFields: LoggerFields = { userId, sessionId, requestId };

  // ── VOICE FAST PATH ─────────────────────────────────────────────────────
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
      if (sessionId && FF.memoryEnabled) {
        const turns = [
          ...history.slice(-4),
          { role: "user" as const, content: userMessage },
          { role: "assistant" as const, content: assistantContent },
        ];
        (async () => {
          try {
            const extracted = await withTimeout(extractMemory(turns), 5000, "extractMemory");
            if (extracted && (extracted.facts.length > 0 || extracted.patterns.length > 0)) {
              await withTimeout(mergeMemory(userId, sessionId, extracted), 3000, "mergeMemory");
            }
          } catch (err) {
            logger.warn({ err, ...logFields }, "voice memory save failed/timed out");
          }
        })();
      }
    } catch (err) {
      recordError("voice", "general");
      logger.error({ err, ...logFields }, "voice fast path failed");
      yield { type: "error", message: err instanceof Error ? err.message : String(err) };
    }
    return;
  }

  // ── STANDARD PATH ─────────────────────────────────────────────────────────
  const endRagTimer    = wendyLatencySeconds.startTimer({ phase: "rag" });

  const [routeDecision, userMemory] = await Promise.all([
    (async () => {
      const endRouterTimer = wendyLatencySeconds.startTimer({ phase: "router" });
      const routerSpan = startSpan("router", { requestId });
      try {
        const result = await routerAgent.route(userMessage, history, requestId);
        return result;
      } finally {
        routerSpan.end();
        endRouterTimer();
      }
    })(),
    loadMemory(userId).catch((err) => {
      recordError("memory_load", "general");
      logger.warn({ err, ...logFields }, "memory load failed");
      return { facts: [], patterns: [] } as UserMemory;
    }),
  ]);

  recordRequest(routeDecision.domain, routeDecision.intent);
  const memoryFactCount = userMemory.facts.length;
  const hasSessionGoal = userMemory.facts.some((f) => f.key === "goal_main");
  const pendingFollowUp = userMemory.facts.find((f) => f.key === "pending_follow_up")?.value;

  logger.info({
    ...logFields,
    domain: routeDecision.domain,
    intent: routeDecision.intent,
    routeConfidence: routeDecision.confidence,
    secondaryDomain: routeDecision.secondaryRoute?.domain,
    memoryFactCount,
    isFallback: routeDecision.isFallback,
  }, "route decision");

  Object.assign(logFields, {
    domain: routeDecision.domain,
    intent: routeDecision.intent,
    routeConfidence: routeDecision.confidence,
  });

  const memorySection   = buildMemorySection(userMemory);
  const enrichedContext: UserContext & { memorySection?: string | undefined } = {
    ...userContext,
    memorySection: memorySection || userContext.memorySection,
  };

  let routingHistorySummary = "";
  if (userId > 0 && !routeDecision.isFallback) {
    routingHistorySummary = await buildRoutingHistorySummary(userId).catch(() => "");
  }

  const fallbackInstruction = routeDecision.isFallback
    ? "Non hai abbastanza informazioni per classificare la richiesta dell'utente. Invece di rispondere direttamente, fai 1 domanda di chiarimento specifica per capire meglio di cosa ha bisogno. Non inventare risposte generiche."
    : undefined;

  function scheduleMemorySave(assistantResponse: string, sid: number): void {
    if (!FF.memoryEnabled) return;
    const turns = [
      ...history.slice(-8),
      { role: "user",      content: userMessage },
      { role: "assistant", content: assistantResponse },
    ];
    (async () => {
      try {
        const extracted = await withTimeout(extractMemory(turns), 5000, "extractMemory");
        if (!extracted) return;

        // If this exchange was a plan, save a pending_follow_up for next session
        if (routeDecision.intent === "plan" || routeDecision.intent === "problem_solve") {
          const hasPending = extracted.facts.find((f) => f.key === "pending_follow_up");
          if (!hasPending) {
            extracted.facts.push({
              key: "pending_follow_up",
              value: routeDecision.handoffContext.slice(0, 200),
            });
          }
        }

        if (extracted.facts.length > 0 || extracted.patterns.length > 0) {
          await withTimeout(mergeMemory(userId, sid, extracted), 3000, "mergeMemory");
          logger.info({ ...logFields, factCount: extracted.facts.length, patternCount: extracted.patterns.length }, "memory saved");
        }
      } catch (err) {
        logger.warn({ err, ...logFields }, "memory save failed/timed out");
      }
    })();
  }

  const primaryConfident =
    routeDecision.confidence >= routeDecision.threshold &&
    routeDecision.domain !== "general";

  if (primaryConfident && routeDecision.secondaryRoute) {
    if (!FF.parallelHandoff) {
      logger.info({ ...logFields }, "parallel handoff disabled by flag — falling back to primary specialist");
    } else {
      let fullResponse = "";
      for await (const event of runParallelHandoff({
        userId, userContext: enrichedContext, history, userMessage,
        primaryRoute:   routeDecision,
        secondaryRoute: routeDecision.secondaryRoute,
        memoryFactCount, maxHistory, requestId,
      })) {
        if (event.type === "token") fullResponse += event.value;
        yield event;
        if (event.type === "done") scheduleMemorySave(fullResponse, sessionId ?? Date.now());
      }
      endRagTimer();
      return;
    }
  }

  if (primaryConfident) {
    const specialist = getSpecialist(routeDecision.domain);
    if (specialist) {
      let fullResponse = "";
      for await (const event of specialist.run({
        userId, userContext: enrichedContext, history, userMessage,
        routeDecision, memoryFactCount, maxHistory, requestId,
      })) {
        if (event.type === "token") fullResponse += event.value;
        yield event;
        if (event.type === "done") scheduleMemorySave(fullResponse, sessionId ?? Date.now());
      }
      endRagTimer();
      return;
    }
  }

  yield { type: "status", value: "🔍 Analizzando il tuo profilo..." };

  const conversationSummary = buildConversationSummary(history);

  const ragSpan = startSpan("rag_retrieval", { requestId });
  const [personaExamples, documentChunks, platformChunks, cot] = await Promise.all([
    retrieve(userMessage, userId, { topK: 3, minScore: 0.30, sourceTypes: ["persona_example"] }),
    retrieve(userMessage, userId, { topK: 5, minScore: 0.35, sourceTypes: ["document", "user_note"] }),
    retrieve(userMessage, userId, { topK: 3, minScore: 0.30, sourceTypes: ["platform_content"] }),
    FF.chainOfThought ? runChainOfThought(userId, userMessage, conversationSummary) : Promise.resolve(null),
  ]);
  ragSpan.end();

  endRagTimer();

  let webResults: RetrievedChunk[] = [];
  if (documentChunks.length < MIN_LOCAL_CHUNKS) {
    webResults = await searchWeb(`crescita personale ${userMessage}`, 4);
  }

  yield { type: "status", value: "🧠 Ragionamento in corso..." };

  const evalResult = evaluateSelf({ userMessage, documentChunks, webResults, cot, memoryFactCount });

  if (evalResult.needsClarification) {
    yield { type: "status", value: "Non ho ancora abbastanza elementi per darti una risposta utile." };
    const clarification = buildClarification(evalResult, userContext.name);
    yield { type: "token", value: clarification };
    yield { type: "done", sources: [...personaExamples, ...documentChunks, ...platformChunks, ...webResults], cot, evalResult, routeDecision };
    scheduleMemorySave(clarification, sessionId ?? Date.now());
    return;
  }

  const sessionMessageCount = history.length;

  const systemPrompt = buildSystemPrompt({
    userContext: enrichedContext, personaExamples, documentChunks,
    webResults, cot, userMessage, evalResult,
    platformChunks,
    routeDecision,
    behaviorPatterns: userMemory.patterns,
    routingHistorySummary,
    fallbackInstruction,
    sessionMessageCount,
    hasSessionGoal,
    pendingFollowUp,
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

    const endLlmTimer = wendyLatencySeconds.startTimer({ phase: "llm" });
    const llmSpan = startSpan("llm_generation", { requestId, domain: routeDecision.domain, intent: routeDecision.intent });

    // Per-request model pick: premium users with high-confidence specialist
    // routing get the premium model; everyone else gets the free-tier default.
    const route = selectModelFor("growth-agent-chat", {
      isPremium: !!userContext.isPremium,
      complexity: evalResult.level === "high" ? "deep" : "standard",
    });

    // Combina UI tools e Wendy domain tools (solo per intent rilevanti)
    const wendyDomainTools = wendyIntent
      ? toolsToOpenAIFormat(getToolsForIntent(wendyIntent))
      : [];
    const allTools: OpenAI.Chat.ChatCompletionTool[] = [
      ...(FF.generativeUI ? (UI_TOOLS as OpenAI.Chat.ChatCompletionTool[]) : []),
      ...wendyDomainTools as OpenAI.Chat.ChatCompletionTool[],
    ];
    const hasTools = allTools.length > 0;

    const completionParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
      model: route.model,
      messages,
      stream: true,
      temperature,
      max_tokens: evalResult.level === "low" ? 300 : 600,
      stream_options: { include_usage: false },
      ...(hasTools ? { tools: allTools, tool_choice: "auto" } : {}),
    };
    const stream = await openai.chat.completions.create(completionParams);

    const tokenBuffer:   string[] = [];
    let   toolCallName:  string   = "";
    let   toolCallArgs:  string   = "";
    let   toolCallId:    string   = "";
    let   finishReason:  string   = "stop";

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;
      finishReason = choice.finish_reason ?? finishReason;

      if (choice.delta?.content) {
        tokenBuffer.push(choice.delta.content);
      }

      if (choice.delta?.tool_calls) {
        for (const tc of choice.delta.tool_calls) {
          if (tc.id)              toolCallId   += tc.id;
          if (tc.function?.name)  toolCallName += tc.function.name;
          if (tc.function?.arguments) toolCallArgs += tc.function.arguments;
        }
      }
    }

    llmSpan.end();
    endLlmTimer();
    const fullText = tokenBuffer.join("");
    recordLlmTokens(route.model, fullText.length);

    const endSupervisorTimer = wendyLatencySeconds.startTimer({ phase: "supervisor" });
    const supervisorSpan = startSpan("supervisor_evaluation", { requestId, domain: routeDecision.domain, intent: routeDecision.intent });

    if (finishReason === "tool_calls" && toolCallName) {
      supervisorSpan.end();
      endSupervisorTimer();

      // ── Wendy domain tool (settori, professioni, obiettivi, ecc.) ───────────
      if (!UI_TOOL_NAMES.has(toolCallName)) {
        let parsedArgs: Record<string, unknown> = {};
        try { parsedArgs = JSON.parse(toolCallArgs); } catch { /* args malformati — procedi vuoto */ }

        const toolResult = await executeToolCall(toolCallName, parsedArgs, userId);
        const toolData   = toolResult.ok ? toolResult.data : { error: (toolResult as any).message };

        // Navigazione client-side → nessuna risposta testuale
        if (toolResult.ok && (toolData as any)?.clientSide) {
          yield { type: "tool_call" as any, name: toolCallName, result: toolData };
          yield { type: "done", sources: [], evalResult, routeDecision };
          scheduleMemorySave(`[tool: ${toolCallName}]`, sessionId ?? Date.now());
          return;
        }

        // Turno 2: LLM genera risposta finale con i dati del tool — streaming
        const followUpMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          ...messages,
          {
            role: "assistant",
            content:    null,
            tool_calls: [{ id: toolCallId || "tc_0", type: "function", function: { name: toolCallName, arguments: toolCallArgs } }],
          },
          { role: "tool", tool_call_id: toolCallId || "tc_0", content: JSON.stringify(toolData) },
        ];

        yield { type: "tool_call" as any, name: toolCallName, result: toolData };

        const followUpStream = await openai.chat.completions.create({
          model: route.model, messages: followUpMessages,
          stream: true, temperature: 0.55, max_tokens: 700,
        });

        const followUpBuffer: string[] = [];
        for await (const chunk of followUpStream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            followUpBuffer.push(delta);
            yield { type: "token", value: delta };
          }
        }

        const followUpText = followUpBuffer.join("");
        yield { type: "done", sources: [...personaExamples, ...documentChunks, ...platformChunks, ...webResults], evalResult, routeDecision };
        scheduleMemorySave(followUpText, sessionId ?? Date.now());
        return;
      }

      // ── UI tool (generative UI) — comportamento originale ───────────────────
      let args: UiToolArgs;
      try {
        args = JSON.parse(toolCallArgs) as UiToolArgs;
      } catch {
        yield { type: "error", message: `UI tool args parse error: ${toolCallArgs}` };
        yield { type: "done", sources: [...personaExamples, ...documentChunks, ...platformChunks, ...webResults], evalResult, routeDecision };
        return;
      }

      yield { type: "ui_tool" as const, name: toolCallName as UiToolName, args };
      yield {
        type: "done",
        sources: [...personaExamples, ...documentChunks, ...platformChunks, ...webResults],
        evalResult, routeDecision,
      };
      scheduleMemorySave(`[UI: ${toolCallName}]`, sessionId ?? Date.now());
      return;
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

    if (!supervisorResult.pass && FF.supervisorEnabled) {
      logger.info({
        ...logFields,
        domain: routeDecision.domain,
        intent: routeDecision.intent,
        supervisorScore: supervisorResult.score,
      }, "supervisor FAIL — rewriting");
      finalText        = await supervisorAgent.rewrite(supervisorInput, supervisorResult);
      supervisorResult = { ...supervisorResult, rewritten: true };
    } else if (supervisorResult.pass) {
      logger.info({
        ...logFields,
        supervisorScore: supervisorResult.score,
      }, "supervisor PASS");
    }

    supervisorSpan.end();
    endSupervisorTimer();

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
    logger.info({ ...logFields, responseLength: finalText.length }, "response completed");
  } catch (err) {
    recordError("llm_generation", routeDecision.domain);
    logger.error({ err, ...logFields }, "response generation failed");
    yield { type: "error", message: err instanceof Error ? err.message : String(err) };
  }
}
