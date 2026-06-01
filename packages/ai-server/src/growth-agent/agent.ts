import { getLLMForRoute, type LLMMessage } from "../llm/client";
import { buildSystemPrompt, type UserContext } from "./prompt-builder";
import { evaluateSelf, buildClarification } from "./self-evaluator";
import { routerAgent } from "./router-agent";
import { buildRoutingHistorySummary } from "./router-memory";
import { getSpecialist } from "./specialist-agent";
import { supervisorAgent } from "./supervisor-agent";
import { loadMemory, buildMemorySection, type UserMemory } from "./memory-manager";
import { buildWendyActivationContext } from "../wendy-neural";
import { runParallelHandoff } from "./parallel-handoff";
import type { UiToolArgs, UiToolName } from "./ui-tools";
import { executeToolCall } from "../wendy-router/tool-handlers";
import { isClientSideToolData } from "./tool-args";
import { toolRegistry } from "../tools/registry";
import { scheduleMemorySave } from "./memory-save";
import { buildUiDirectives } from "./ui-directives";
import { loadResponseContext } from "./response-context";
import { runVoiceFastPath } from "./voice-runner";
import { normalizeInput } from "./input-normalizer";
import { logger, type LoggerFields } from "../logger";
import { recordRequest, recordError, recordLlmTokens } from "../metrics";
import { wendyLatencySeconds } from "../metrics";
import { startSpan } from "../tracing";
import { FF } from "../feature-flags";
import { selectModelFor } from "../model-router";
import { wendyConfig } from "../config/wendy";
import { getWendyRecoveryFallbackReply } from "../wendy-router/fast-path-fallback";
import { resolveGrowthContextSections } from "./context-sections";
import { buildGrowthLlmMessages } from "./llm-message-builder";
import { buildGrowthAgentTools } from "./tool-selection";
import type { GrowthAgentEvent, GrowthAgentOptions } from "./agent-types";
export { GROWTH_AGENT_MODEL, GROWTH_AGENT_VOICE_MODEL } from "./agent-models";
export type { ChatMessage, GrowthAgentEvent, GrowthAgentOptions, GrowthAgentToolExecutor } from "./agent-types";
import "./specialists/career-agent";
import "./specialists/mindset-agent";
import "./specialists/habits-agent";
import "./specialists/trading-agent";
import "./specialists/health-agent";

export async function* runGrowthAgent(
  opts: GrowthAgentOptions,
): AsyncGenerator<GrowthAgentEvent> {
  const {
    userId, sessionId, userContext, history, userMessage,
    maxHistory = 12, voiceMode = false, requestId,
    wendyIntent,
    isPredefined = false,
    neuralContext: providedNeuralContext,
  } = opts;
  const normalizedMessage = normalizeInput(userMessage);
  const logFields: LoggerFields = { userId, sessionId, requestId };
  if (voiceMode) {
    yield* runVoiceFastPath({ userId, sessionId, name: userContext.name, history, userMessage, logFields });
    return;
  }
  const endRagTimer    = wendyLatencySeconds.startTimer({ phase: "rag" });
  const [routeDecision, userMemory] = await Promise.all([
    (async () => {
      const endRouterTimer = wendyLatencySeconds.startTimer({ phase: "router" });
      const routerSpan = startSpan("router", { requestId });
      try {
        const result = await routerAgent.route(normalizedMessage, history, requestId);
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

  const neuralContext = providedNeuralContext ?? await buildWendyActivationContext({
    requestId: requestId ?? `growth-${sessionId ?? Date.now()}`,
    userId,
    message: normalizedMessage,
    intent: wendyIntent ?? "conversation",
    domain: routeDecision.domain,
  }).catch((err) => {
    logger.warn({ err, ...logFields }, "neural activation failed");
    return null;
  });

  const [contextualMemorySection, wendyBrainSection] = await resolveGrowthContextSections({
    neuralContext,
    userId,
    normalizedMessage,
    logFields,
  });
  const memorySection = contextualMemorySection || buildMemorySection({
    facts: userMemory.facts.filter((f) => f.key === "goal_main" || f.key === "pending_follow_up"),
    patterns: [],
  });
  const enrichedContext: UserContext & { memorySection?: string | undefined } = {
    ...userContext,
    memorySection: memorySection || userContext.memorySection,
    neuralSection: neuralContext?.promptSection || userContext.neuralSection,
    wendyBrainSection: wendyBrainSection || userContext.wendyBrainSection,
  };
  let routingHistorySummary = "";
  if (
    userId > 0 &&
    !routeDecision.isFallback &&
    history.length >= 2 &&
    (routeDecision.intent === "plan" || routeDecision.intent === "problem_solve")
  ) {
    routingHistorySummary = await buildRoutingHistorySummary(userId).catch(() => "");
  }

  const fallbackInstruction = routeDecision.isFallback
    ? "Non hai abbastanza informazioni per classificare la richiesta dell'utente. Invece di rispondere direttamente, fai 1 domanda di chiarimento specifica per capire meglio di cosa ha bisogno. Non inventare risposte generiche."
    : undefined;
  let lastSupervisorScore: number | undefined;
  const saveAssistantMemory = (assistantResponse: string): void => {
    if (sessionId == null) return;
    scheduleMemorySave({ userId, sessionId, history, userMessage, assistantResponse, routeDecision, logFields, supervisorScore: lastSupervisorScore });
  };

  const primaryConfident =
    routeDecision.confidence >= routeDecision.threshold &&
    routeDecision.domain !== "general";

  if (primaryConfident && routeDecision.secondaryRoute) {
    if (!FF.parallelHandoff) {
      logger.info({ ...logFields }, "parallel handoff disabled by flag — falling back to primary specialist");
    } else {
      let fullResponse = "";
      try {
        for await (const event of runParallelHandoff({
          userId, userContext: enrichedContext, history, userMessage: normalizedMessage,
          primaryRoute:   routeDecision,
          secondaryRoute: routeDecision.secondaryRoute,
          memoryFactCount, maxHistory, requestId,
        })) {
          if (event.type === "token") fullResponse += event.value;
          yield event;
          if (event.type === "done") saveAssistantMemory(fullResponse);
        }
        endRagTimer();
        return;
      } catch (err) {
        logger.warn({ err, ...logFields }, "parallel handoff failed, falling back to generic growth agent");
        yield { type: "status", value: "Cambio approccio..." };
      }
    }
  }

  if (primaryConfident) {
    const specialist = getSpecialist(routeDecision.domain);
    if (specialist) {
      let fullResponse = "";
      try {
        for await (const event of specialist.run({
          userId, sessionId, userContext: enrichedContext, history, userMessage,
          normalizedMessage,
          routeDecision, memoryFactCount, maxHistory, requestId,
        })) {
          if (event.type === "error") {
            throw new Error(event.message);
          }
          if (event.type === "token") fullResponse += event.value;
          yield event;
          if (event.type === "done") saveAssistantMemory(fullResponse);
        }
        endRagTimer();
        return;
      } catch (err) {
        logger.warn({ err, ...logFields }, "specialist failed, falling back to generic growth agent");
        yield { type: "status", value: "Cambio approccio..." };
      }
    }
  }

  yield { type: "status", value: "🔍 Analizzando il tuo profilo..." };

  const { personaExamples, documentChunks, platformChunks, webResults, cot } =
    await loadResponseContext(userId, normalizedMessage, history, requestId, sessionId);
  endRagTimer();

  yield { type: "status", value: "🧠 Ragionamento in corso..." };

  const evalResult = evaluateSelf({ userMessage: normalizedMessage, documentChunks, webResults, cot, memoryFactCount, isPredefined });

  if (evalResult.needsClarification) {
    yield { type: "status", value: "Non ho ancora abbastanza elementi per darti una risposta utile." };
    const clarification = buildClarification(evalResult, userContext.name);
    yield { type: "token", value: clarification };
    yield { type: "done", sources: [...personaExamples, ...documentChunks, ...platformChunks, ...webResults], cot, evalResult, routeDecision, uiDirectives: buildUiDirectives(routeDecision.domain, routeDecision.intent) };
    saveAssistantMemory(clarification);
    return;
  }

  const sessionMessageCount = history.length;

  const systemPrompt = buildSystemPrompt({
    userContext: enrichedContext, personaExamples, documentChunks,
    webResults, cot, userMessage: normalizedMessage, evalResult,
    platformChunks,
    routeDecision,
    behaviorPatterns: userMemory.patterns,
    routingHistorySummary,
    fallbackInstruction,
    sessionMessageCount,
    hasSessionGoal,
    pendingFollowUp,
  });

  const messages = buildGrowthLlmMessages({ systemPrompt, history, maxHistory, userMessage });

  const temperature = evalResult.level === "low" ? wendyConfig.specialist.temperatureLow : wendyConfig.specialist.temperatureHigh;

  try {
    yield { type: "status", value: "✍️ Generando risposta..." };

    const endLlmTimer = wendyLatencySeconds.startTimer({ phase: "llm" });
    const llmSpan = startSpan("llm_generation", { requestId, domain: routeDecision.domain, intent: routeDecision.intent });

    const route = selectModelFor("growth-agent-chat", {
      isPremium: !!userContext.isPremium,
      complexity: evalResult.level === "high" ? "deep" : "standard",
    });

    const llm = getLLMForRoute({ provider: route.provider });
    const allTools = buildGrowthAgentTools(wendyIntent);
    const hasTools = allTools.length > 0;

    const result = await llm.chatWithTools(messages, hasTools ? allTools : [], {
      model: route.model,
      temperature,
      maxTokens: evalResult.level === "low" ? wendyConfig.agent.maxTokensLow : wendyConfig.agent.maxTokensHigh,
    });

    llmSpan.end();
    endLlmTimer();
    const fullText = result.content ?? "";
    recordLlmTokens(route.model, fullText.length);

    const endSupervisorTimer = wendyLatencySeconds.startTimer({ phase: "supervisor" });
    const supervisorSpan = startSpan("supervisor_evaluation", { requestId, domain: routeDecision.domain, intent: routeDecision.intent });

    const orderedToolCalls = result.toolCalls
      .map((toolCall, index) => ({
        id: toolCall.id || `tc_${index}`,
        name: toolCall.name,
        arguments: toolCall.arguments,
      }))
      .filter((toolCall) => toolCall.name);

    if (result.finishReason === "tool_calls" && orderedToolCalls.length > 0) {
      supervisorSpan.end();
      endSupervisorTimer();

      if (!orderedToolCalls.every((toolCall) => toolRegistry.isUiTool(toolCall.name))) {
        const toolExecutor = opts.executeExternalTool ?? executeToolCall;
        const toolResults: Array<{ toolCall: (typeof orderedToolCalls)[number]; toolData: unknown }> = [];

        for (const toolCall of orderedToolCalls) {
          const toolResult = await toolExecutor(toolCall.name, toolCall.arguments, userId);
          const toolData = toolResult.ok ? toolResult.data : { error: toolResult.message };

          if (toolResult.ok && isClientSideToolData(toolData)) {
            yield { type: "tool_call", name: toolCall.name, result: toolData };
            yield { type: "done", sources: [], evalResult, routeDecision, uiDirectives: buildUiDirectives(routeDecision.domain, routeDecision.intent) };
            saveAssistantMemory(`[tool: ${toolCall.name}]`);
            return;
          }

          toolResults.push({ toolCall, toolData });
          yield { type: "tool_call", name: toolCall.name, result: toolData };
        }

        const toolSummary = toolResults
          .map(({ toolCall, toolData }) => `${toolCall.name}: ${JSON.stringify(toolData)}`)
          .join("\n");
        const followUpMessages: LLMMessage[] = [
          ...messages,
          {
            role: "assistant",
            content: fullText || "Ho consultato gli strumenti disponibili.",
          },
          {
            role: "user",
            content: `Risultati degli strumenti:\n${toolSummary}\n\nRispondi all'utente in modo sintetico, citando solo cio che emerge dai risultati.`,
          },
        ];

        const followUpText = await llm.chatOnce(followUpMessages, {
          model: route.model,
          temperature: 0.55,
          maxTokens: wendyConfig.agent.followUpMaxTokens,
        });
        for (let i = 0; i < followUpText.length; i += wendyConfig.agent.chunkSize) {
          yield { type: "token", value: followUpText.slice(i, i + wendyConfig.agent.chunkSize) };
        }
        yield { type: "done", sources: [...personaExamples, ...documentChunks, ...platformChunks, ...webResults], evalResult, routeDecision };
        saveAssistantMemory(followUpText);
        return;
      }

      for (const toolCall of orderedToolCalls) {
        const args = toolCall.arguments as unknown as UiToolArgs;

        yield { type: "ui_tool" as const, name: toolCall.name as UiToolName, args };
      }

      yield {
        type: "done",
        sources: [...personaExamples, ...documentChunks, ...platformChunks, ...webResults],
        evalResult, routeDecision, uiDirectives: buildUiDirectives(routeDecision.domain, routeDecision.intent),
      };
      saveAssistantMemory(`[UI: ${orderedToolCalls.map((toolCall) => toolCall.name).join(", ")}]`);
      return;
    }

    const draft = fullText;

    const supervisorInput = {
      userMessage: normalizedMessage, draft,
      domain:    routeDecision.domain,
      intent:    routeDecision.intent,
      userId:    String(userId),
      sessionId: sessionId,
    };

    let supervisorResult = await supervisorAgent.evaluate(supervisorInput);
    lastSupervisorScore  = supervisorResult.score;
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

    if (!finalText.trim()) {
      finalText = getWendyRecoveryFallbackReply({
        intent: wendyIntent ?? "conversation",
        message: normalizedMessage,
        ...(userContext.locale ? { locale: userContext.locale } : {}),
      });
    }

    const CHUNK_SIZE = wendyConfig.agent.chunkSize;
    for (let i = 0; i < finalText.length; i += CHUNK_SIZE) {
      yield { type: "token", value: finalText.slice(i, i + CHUNK_SIZE) };
    }

    yield {
      type: "done",
      sources: [...personaExamples, ...documentChunks, ...platformChunks, ...webResults],
      cot, evalResult, routeDecision, supervisorResult,
      uiDirectives: buildUiDirectives(routeDecision.domain, routeDecision.intent),
    };

    saveAssistantMemory(finalText);
    logger.info({ ...logFields, responseLength: finalText.length }, "response completed");
  } catch (err) {
    recordError("llm_generation", routeDecision.domain);
    logger.error({ err, ...logFields }, "response generation failed");
    yield { type: "error", message: err instanceof Error ? err.message : String(err) };
  }
}
