/**
 * ai-wendy.ts — entrypoint AI unificato per Wendy.
 *
 * POST /api/ai/wendy
 *
 * Due pipeline:
 *   Fast path (navigation/simple_qa): chiamata LLM diretta, risposta leggera.
 *   Full path (conversation/planning/deep_analysis): runGrowthAgent() completo con SSE.
 *
 * SECURITY: userId SEMPRE da req.user.id (JWT), mai dal body (SECURITY_RULES.md).
 * PRIVACY: nessun contenuto integrale di messaggi nei log (PRIVACY_DESIGN.md).
 */
import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { requireAuth } from "../middleware/auth";
import { wendyLimiter } from "../middleware/rate-limit";
import { rootLogger } from "../middleware/logger";
import {
  checkFeatureAccess,
  getEffectivePlan,
  planMeets,
} from "../middleware/check-feature";
import { cacheIncr } from "../lib/redis";
import { agentRegistry } from "../lib/agent-registry";
import {
  runGrowthAgent,
  loadMemory,
  buildMemorySection,
  loadRecentSummaries,
  buildSessionHistorySection,
  resolveWendyRoute,
  buildLightPrompt,
  toolsToOpenAIFormat,
  recordAiCall,
  getLLMForRoute,
  estimateTokens,
  estimateCost,
  recordWendyCost,
  recordQualityScore,
  recordTtft,
  ensureWendyConfigFresh,
  wendyConfig,
  buildWendyActivationContext,
  persistActivationTrace,
  reinforceCoActivations,
  getFastPathFallbackReply,
  getWendyRecoveryFallbackReply,
  shouldUseImmediateFastPathFallback,
  shouldUseImmediateWendyRecoveryFallback,
  shouldUseWendyQuickActionFastPath,
  getLlmUnavailableReply,
  isLlmConfigured,
  buildWendyIntelligenceDirectives,
  buildWendySuggestedPrompts,
  evaluateWendyResponse,
  planWendyDecision,
} from "@workspace/ai-server";
import type { CompressedHistory, WendyActivationContext, WendyPageContext } from "@workspace/ai-server";
import {
  buildWendyContextSources,
  isClientSideToolData,
  isDoneWithLowEval,
  WendyRequestSchema,
  type WendyToolMessage,
} from "./ai-wendy-shared";
import { buildWikiLLMContext } from "../lib/wikillm-context-router";
import { executeWendyToolCall } from "../lib/wendy-tool-executor";
import { storeSemanticTurnInBackground } from "../lib/semantic-memory";
import { withRouteTimeout } from "../lib/wendy-fast-path";
import { resolveWendyLocale } from "../lib/wendy-locale";
import {
  buildWendyDataBackedGuidedAction,
  classifyWendyDataBackedQuickAction,
  formatWendyDataBackedQuickActionReply,
} from "../lib/wendy-data-backed-quick-action";
import { checkRabbitEmergency } from "@workspace/ai-server";
const router = Router();

function buildConfirmableClientAction(toolName: string, args: Record<string, unknown>) {
  if (toolName === "set_filters") {
    const filters = args.filters && typeof args.filters === "object" && !Array.isArray(args.filters)
      ? args.filters as Record<string, unknown>
      : {};
    const listType = typeof args.listType === "string" ? args.listType : "sectors";
    return {
      clientSide: true,
      action: "set_filters",
      wendyAction: {
        id: `wendy-set_filters-${randomUUID()}`,
        type: "set_filters",
        status: "needs_confirmation",
        risk: "low",
        label: "Preparare Esplora settori?",
        description: "Applico i filtri quando confermi, cosi non interrompo la risposta.",
        requiresConfirmation: true,
        payload: { listType, filters },
        preview: Object.entries(filters).slice(0, 4).map(([label, value]) => ({
          label,
          value: typeof value === "string" ? value : JSON.stringify(value),
        })),
      },
    };
  }

  const viewId = typeof args.viewId === "string" ? args.viewId : "settori";
  const targetRoute = viewId === "settori" ? "/settori" : "/dashboard";
  return {
    clientSide: true,
    action: "navigate",
    wendyAction: {
      id: `wendy-navigate-${randomUUID()}`,
      type: "navigate",
      status: "needs_confirmation",
      risk: "low",
      label: "Aprire Esplora settori?",
      description: "Apro la pagina quando confermi, senza tagliare la risposta di Wendy.",
      requiresConfirmation: true,
      targetRoute,
      payload: { url: targetRoute, viewId },
      preview: [{ label: "Destinazione", value: targetRoute }],
    },
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

router.post(
  "/",
  requireAuth,
  wendyLimiter,
  async (req: Request, res: Response) => {
    const parsed = WendyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({
          error: "Richiesta non valida",
          details: parsed.error.flatten(),
        });
      return;
    }

    await ensureWendyConfigFresh();

    const {
      message,
      contextPrompt,
      threadId,
      compressedHistory,
      pageContext,
      locale: rawLocale,
      hasFileAttached,
      isPredefined,
    } = parsed.data;
    const locale = resolveWendyLocale(rawLocale, message);
    const followUpContext = contextPrompt?.trim();
    const effectiveMessage = followUpContext
      ? `${message}\n\n[Contesto operativo follow-up Wendy]\n${followUpContext}`
      : message;
    const followUpPromptSection = followUpContext
      ? `\n\n## Contesto operativo follow-up\n${followUpContext}\n\nUsa questo contesto per continuare la decisione precedente, attivare tool dell'app quando servono dati/modifiche, e proporre il prossimo passo eseguibile senza ripartire da zero.`
      : "";

    // SECURITY: userId SEMPRE dal JWT, mai dal body
    const userId = req.user!.id;
    const requestId = randomUUID();
    const startedAt = Date.now();

    // Wendy is_active guard: se admin ha messo in pausa, rifiuta con gate SSE.
    try {
      const snapshot = await agentRegistry.getSnapshot();
      const wendyAgent = snapshot.agents.find((a) => a.slug === "wendy");
      if (wendyAgent && !wendyAgent.isActive) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders();
        res.write(
          `data: ${JSON.stringify({
            type: "gate",
            feature: "wendy_paused",
            message:
              "Wendy e` in pausa al momento. Riprova fra qualche minuto.",
          })}\n\n`,
        );
        res.end();
        return;
      }
    } catch (err) {
      rootLogger.warn(
        { err },
        "[ai/wendy] is_active lookup failed, proceeding",
      );
    }

    try {
      agentRegistry.update("wendy", {
        status: "executing",
        currentTask: {
          id: 0,
          title: message.slice(0, 120),
          status: "running",
          startedAt: new Date(startedAt).toISOString(),
          finishedAt: null,
          tokensUsed: null,
          modelUsed: null,
        },
      });
    } catch (err) {
      rootLogger.warn(
        { err },
        "[ai/wendy] agent registry update on start failed",
      );
    }

    const markIdle = () => {
      try {
        agentRegistry.clear("wendy");
      } catch (err) {
        rootLogger.warn({ err }, "[ai/wendy] agent registry clear failed");
      }
    };

    const currentPlan = await getEffectivePlan(userId);
    const isPremium = planMeets(currentPlan, "pro");

    // ── Daily message limit per piano ─────────────────────────────────────────
    const FREE_DAILY_LIMIT = parseInt(
      process.env.WENDY_FREE_DAILY_LIMIT ?? "40",
    );
    const { allowed: isUnlimited } = await checkFeatureAccess(
      userId,
      "wendy_unlimited",
    );

    if (!isUnlimited) {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const key = `wendy:daily:${userId}:${today}`;
      const secondsUntilMidnight = 86400 - (((Date.now() / 1000) % 86400) | 0);
      const count = await cacheIncr(key, secondsUntilMidnight);

      if (count !== null && count > FREE_DAILY_LIMIT) {
        res.setHeader("Content-Type", "text/event-stream");
        res.flushHeaders();
        res.write(
          `data: ${JSON.stringify({
            type: "gate",
            feature: "wendy_unlimited",
            requiredPlan: "pro",
            used: count - 1,
            limit: FREE_DAILY_LIMIT,
            message: `Hai usato i tuoi ${FREE_DAILY_LIMIT} messaggi gratuiti oggi. Passa a Pro per continuare senza limiti.`,
          })}\n\n`,
        );
        res.end();
        markIdle();
        return;
      }
    }

    let personalContext: Awaited<ReturnType<typeof buildWikiLLMContext>> = {
      context: "",
      contexts: { semanticMemory: "", openHuman: "", graphify: "", wendyBrain: "" },
      sources: [],
    };

    // ── SSE headers ───────────────────────────────────────────────────────────
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const send = (data: object) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
      // Intercetta tool_call per telemetria — senza rileggere il body
      const d = data as Record<string, unknown>;
      if (d.type === "tool_call" && typeof d.name === "string") {
        toolsUsedInRequest.push(d.name);
        const result = d.result as Record<string, unknown> | null;
        // Ricerca semantica
        if (result?.searchMode === "semantic") searchModeUsed = "semantic";
        else if (result?.searchMode === "keyword" && searchModeUsed === "none")
          searchModeUsed = "keyword";
        // RAG telemetria: cattura dati da search_rag
        if (d.name === "search_rag" && result) {
          const chunks =
            (result.chunks as Array<{
              similarity?: number;
              sourceName?: string;
            }>) ?? [];
          ragChunksRetrieved += chunks.length;
          const topSim = chunks[0]?.similarity;
          if (
            typeof topSim === "number" &&
            (ragTopSimilarity === null || topSim > ragTopSimilarity)
          ) {
            ragTopSimilarity = topSim;
          }
          for (const chunk of chunks) {
            if (
              chunk.sourceName &&
              !ragSourcesUsed.includes(chunk.sourceName)
            ) {
              ragSourcesUsed.push(chunk.sourceName);
            }
          }
        }
      }
    };

    // Cleanup se il client chiude la connessione
    let aborted = false;
    req.on("close", () => {
      aborted = true;
    });

    rootLogger.info(
      { userId, requestId, locale },
      "[ai/wendy] request started",
    );

    let status:
      | "success"
      | "error_model"
      | "error_timeout"
      | "error_ratelimit"
      | "error_internal" = "success";
    let errorCode: string | undefined;
    let inputTokens = 0;
    let outputTokens = 0;
    let assistantResponseForMemory = "";
    const fastPathTimeoutMs = wendyConfig.fastPath.timeoutMs;

    // Telemetria Step 5
    const toolsUsedInRequest: string[] = [];
    let responseCategory:
      | "success"
      | "insufficient_data"
      | "refused"
      | "error_tool"
      | "error_model" = "success";
    let searchModeUsed: "semantic" | "keyword" | "none" = "none";

    // Telemetria Step 6 — RAG
    let ragChunksRetrieved = 0;
    let ragTopSimilarity: number | null = null;
    const ragSourcesUsed: string[] = [];
    let neuralContext: WendyActivationContext | null = null;

    // Telemetria Phase 2 — Quality + Domain
    let domainForLog: string | null = null;
    let supervisorScoreForLog: number | null = null;
    let wasRewrittenForLog = false;
    let ttftMs: number | null = null;
    let adaptiveDecisionForDone: ReturnType<typeof planWendyDecision> | null = null;

    const donePayload = (extra: Record<string, unknown> = {}) => ({
      type: "done",
      requestId,
      contextSources: buildWendyContextSources({
        personalSources: personalContext.sources,
        toolsUsed: toolsUsedInRequest,
        ragChunksRetrieved,
      }),
      ...(neuralContext ? { activationSummary: neuralContext.activationSummary } : {}),
      ...(adaptiveDecisionForDone
        ? {
            adaptiveReasoning: {
              mode: adaptiveDecisionForDone.mode,
              reasoningDepth: adaptiveDecisionForDone.reasoningDepth,
              dataStrategy: adaptiveDecisionForDone.dataStrategy,
              executionMode: adaptiveDecisionForDone.executionMode,
              selfCheck: adaptiveDecisionForDone.selfCheck,
              latencyTargetMs: adaptiveDecisionForDone.latencyTargetMs,
            },
          }
        : {}),
      suggestedPrompts: buildWendySuggestedPrompts({
        decision: adaptiveDecisionForDone,
        locale,
      }),
      ...extra,
    });

    // ── Rabbit emergency triage (deterministic, pre-LLM) ─────────────────────
    if (
      pageContext?.journeyType === "rabbit" ||
      /\b(coniglio|conigli|rabbit|bunny)\b/i.test(message)
    ) {
      const triage = checkRabbitEmergency(message);
      if (triage.isEmergency) {
        rootLogger.warn(
          { userId, requestId, signals: triage.matchedSignals },
          "[rabbit-triage] emergency detected",
        );
        send({ type: "token", value: triage.responseText });
        send(donePayload({
          answerMode: "local-fast-path",
          rabbitTriage: { emergency: true, signals: triage.matchedSignals },
        }));
        if (!res.writableEnded) res.end();
        markIdle();
        return;
      }
    }

    // Routing fuori dal try — serve nel finally per il logging
    const { intent, decision } = resolveWendyRoute({
      userMessage: effectiveMessage,
      pageContext: pageContext as WendyPageContext | undefined,
      compressedHistory: compressedHistory as CompressedHistory | undefined,
      isPremium,
      hasFileAttached,
    });

    rootLogger.debug(
      { userId, intent, model: decision.model, tier: decision.tier },
      "[ai/wendy] routed",
    );

    const wendyDecisionPlan = planWendyDecision({
      message: effectiveMessage,
      intent,
      page: pageContext?.page,
      hasFileAttached,
    });
    adaptiveDecisionForDone = wendyDecisionPlan;
    const wendyIntelligenceDirectives =
      buildWendyIntelligenceDirectives(wendyDecisionPlan);
    const useQuickActionLightPipeline = shouldUseWendyQuickActionFastPath({ intent, message: effectiveMessage });
    let terminalDoneSent = false;
    const sendDoneOnce = (extra: Record<string, unknown> = {}) => {
      if (terminalDoneSent || res.writableEnded) return;
      terminalDoneSent = true;
      send(donePayload(extra));
    };
    const sendRecoveryFallbackOnce = (
      reason: string,
      fallbackStatus: typeof status = "error_model",
    ) => {
      if (terminalDoneSent || res.writableEnded) return false;
      const fallbackText = getWendyRecoveryFallbackReply({ intent, message, locale });
      status = fallbackStatus;
      responseCategory = "error_model";
      outputTokens += estimateTokens(fallbackText);
      assistantResponseForMemory += fallbackText;
      if (ttftMs === null) ttftMs = Date.now() - startedAt;
      send({ type: "token", value: fallbackText });
      sendDoneOnce({
        intent,
        answerMode: "recovery-fallback",
        usage: {
          model: "local-recovery-fallback",
          inputTokens: estimateTokens(message),
          outputTokens,
        },
        recovery: { reason, status: fallbackStatus },
      });
      return true;
    };

    const llmConfigured = isLlmConfigured();

    const dataBackedQuickAction = classifyWendyDataBackedQuickAction(effectiveMessage);
    if (dataBackedQuickAction) {
      const [objectivesResult, contextResult] = await Promise.all([
        executeWendyToolCall("get_user_objectives", {}, userId),
        executeWendyToolCall("get_user_context", {}, userId),
      ]);
      send({
        type: "tool_call",
        name: "get_user_objectives",
        args: {},
        result: objectivesResult.ok ? objectivesResult.data : null,
      });
      send({
        type: "tool_call",
        name: "get_user_context",
        args: {},
        result: contextResult.ok ? contextResult.data : null,
      });
      const quickActionText = formatWendyDataBackedQuickActionReply({
        kind: dataBackedQuickAction,
        locale,
        objectives: objectivesResult.ok ? objectivesResult.data : undefined,
        userContext: contextResult.ok ? contextResult.data : undefined,
      });
      const guidedAction = buildWendyDataBackedGuidedAction({
        kind: dataBackedQuickAction,
        objectives: objectivesResult.ok ? objectivesResult.data : undefined,
        userContext: contextResult.ok ? contextResult.data : undefined,
      });
      if (guidedAction) {
        const guidedActionResult = guidedAction.confirmBeforeExecution
          ? {
              ok: true as const,
              data: buildConfirmableClientAction(guidedAction.toolName, guidedAction.args),
            }
          : await executeWendyToolCall(
              guidedAction.toolName,
              guidedAction.args,
              userId,
            );
        send({
          type: "tool_call",
          name: guidedAction.toolName,
          args: guidedAction.args,
          result: guidedActionResult.ok ? guidedActionResult.data : null,
        });
      }
      outputTokens += estimateTokens(quickActionText);
      assistantResponseForMemory += quickActionText;
      if (ttftMs === null) ttftMs = Date.now() - startedAt;
      send({ type: "token", value: quickActionText });
      sendDoneOnce({
        intent,
        answerMode: "local-quick-action",
        usage: {
          model: "local-data-quick-action",
          inputTokens: estimateTokens(message),
          outputTokens,
        },
      });
      if (!res.writableEnded) res.end();
      markIdle();
      return;
    }

    if (shouldUseImmediateWendyRecoveryFallback({ intent, message, llmConfigured })) {
      const quickActionText = getWendyRecoveryFallbackReply({ intent, message, locale });
      outputTokens += estimateTokens(quickActionText);
      assistantResponseForMemory += quickActionText;
      if (ttftMs === null) ttftMs = Date.now() - startedAt;
      send({ type: "token", value: quickActionText });
      sendDoneOnce({
        intent,
        answerMode: "local-quick-action",
        usage: {
          model: "local-quick-action",
          inputTokens: estimateTokens(message),
          outputTokens,
        },
      });
      if (!res.writableEnded) res.end();
      markIdle();
      return;
    }

    if (shouldUseImmediateFastPathFallback({ intent, message })) {
      const fallbackText = getFastPathFallbackReply({ intent, message, locale });
      if (fallbackText) {
        outputTokens += estimateTokens(fallbackText);
        assistantResponseForMemory += fallbackText;
        if (ttftMs === null) ttftMs = Date.now() - startedAt;
        send({ type: "token", value: fallbackText });
        sendDoneOnce({
          intent,
          answerMode: "local-fast-path",
          usage: { model: "local-fast-path", inputTokens: estimateTokens(message), outputTokens },
        });
        if (!res.writableEnded) res.end();
        markIdle();
        return;
      }
    }

    // No chat LLM provider configured → degrade gracefully with a clear message
    // instead of letting downstream LLM/embedding calls throw ("si è interrotta").
    if (!llmConfigured) {
      const msg = getLlmUnavailableReply(locale);
      outputTokens += estimateTokens(msg);
      assistantResponseForMemory += msg;
      if (ttftMs === null) ttftMs = Date.now() - startedAt;
      rootLogger.warn({ userId, requestId }, "[ai/wendy] no LLM provider configured — returning graceful notice");
      send({ type: "token", value: msg });
      sendDoneOnce({
        intent,
        answerMode: "unconfigured",
        usage: { model: "unconfigured", inputTokens: estimateTokens(message), outputTokens },
      });
      if (!res.writableEnded) res.end();
      markIdle();
      return;
    }

    if (!useQuickActionLightPipeline) {
      personalContext = await buildWikiLLMContext({
        query: effectiveMessage,
        userId,
        userRole: req.user!.role,
        includePersonalMemory: true,
        includeWendyBrain: false,
        graphifyProfile: "auto",
      }).catch((err) => {
        rootLogger.warn({ err, userId, requestId }, "[ai/wendy] context build failed; continuing without personal context");
        return {
          context: "",
          contexts: { semanticMemory: "", openHuman: "", graphify: "", wendyBrain: "" },
          sources: [],
        };
      });

      neuralContext = await buildWendyActivationContext({
        requestId,
        userId,
        message: effectiveMessage,
        intent,
        domain: null,
        pageContext: pageContext as WendyPageContext | undefined,
      }).catch((err) => {
        rootLogger.warn({ err, userId, requestId }, "[ai/wendy] neural activation failed");
        return null;
      });
      if (neuralContext) {
        await persistActivationTrace(neuralContext);
      }
    } else {
      rootLogger.debug({ userId, requestId, intent }, "[ai/wendy] using lightweight quick-action path");
    }

    try {
      // ── 2. Fast path: navigation / simple_qa ────────────────────────────
      const useLightPipeline = decision.skipFullPipeline || useQuickActionLightPipeline;
      if (useLightPipeline) {
        const systemPrompt =
          buildLightPrompt({
            locale,
            intent,
            userMessage: effectiveMessage,
            ...(pageContext
              ? { pageContext: pageContext as WendyPageContext }
              : {}),
            ...(neuralContext?.promptSection
              ? { neuralSection: neuralContext.promptSection }
              : {}),
          }) + personalContext.context + followUpPromptSection;

        const openAiTools = toolsToOpenAIFormat(decision.toolsEnabled);
        const llm = getLLMForRoute({
          provider: decision.provider ?? "openrouter",
        });

        inputTokens = estimateTokens(systemPrompt + message + (followUpContext ?? ""));
        send({ type: "status", value: intent === "navigation" ? "⚡" : "💬" });

        // Tool calling loop — max 3 turni per evitare loop infiniti
        const msgs: WendyToolMessage[] = [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ];
        const textOnlyMsgs: WendyToolMessage[] = [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ];

        const MAX_TOOL_TURNS = wendyConfig.fastPath.maxToolTurns;
        let toolTurns = 0;
        let finalText = "";

        while (toolTurns < MAX_TOOL_TURNS) {
          let result: Awaited<ReturnType<typeof llm.chatWithTools>>;
          try {
            result = await withRouteTimeout(
              llm.chatWithTools(msgs, openAiTools, {
                model: decision.model,
                temperature: 0.1,
                maxTokens: wendyConfig.fastPath.maxTokens,
              }),
              fastPathTimeoutMs,
              "wendy fast path",
            );
          } catch (err) {
            if (intent !== "simple_qa") throw err;
            rootLogger.warn(
              { err, userId, requestId },
              "[ai/wendy] fast path tool call failed, retrying text-only",
            );
            try {
              finalText = await withRouteTimeout(
                llm.chatOnce(textOnlyMsgs, {
                  model: decision.model,
                  temperature: 0.2,
                  maxTokens: wendyConfig.fastPath.maxTokens,
                }),
                fastPathTimeoutMs,
                "wendy fast path text-only",
              );
            } catch (fallbackErr) {
              const fallbackText = getFastPathFallbackReply({ intent, message, locale });
              if (!fallbackText) throw fallbackErr;
              rootLogger.warn(
                { err: fallbackErr, userId, requestId },
                "[ai/wendy] fast path text-only failed, using local simple_qa fallback",
              );
              finalText = fallbackText;
            }
            outputTokens += estimateTokens(finalText);
            break;
          }
          outputTokens += estimateTokens(result.content);

          if (result.toolCalls.length === 0 || result.finishReason === "stop") {
            finalText = result.content;
            break;
          }

          // Appende il messaggio assistant con tool_calls al thread
          msgs.push({
            role: "assistant",
            content: result.content ?? "",
            tool_calls: result.toolCalls.map((tc) => ({
              id: tc.id,
              type: "function",
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments),
              },
            })),
          });

          // Esegui ogni tool call e aggiungi i risultati al thread
          for (const tc of result.toolCalls) {
            const toolResult = await executeWendyToolCall(tc.name, tc.arguments, userId);
            const toolData = toolResult.ok
              ? toolResult.data
              : { error: toolResult.message };
            send({
              type: "tool_call",
              name: tc.name,
              args: tc.arguments,
              result: toolResult.ok ? toolData : null,
            });

            // Navigazione client-side — termina subito senza risposta testuale
            if (toolResult.ok && isClientSideToolData(toolData)) {
              sendDoneOnce({
                intent,
                answerMode: "llm-fast-path",
                usage: { model: decision.model, inputTokens, outputTokens },
              });
              return;
            }

            msgs.push({
              role: "tool",
              content: JSON.stringify(toolData),
              tool_call_id: tc.id,
            });
          }

          toolTurns++;
        }

        if (!finalText && intent === "simple_qa") {
          try {
            finalText = await withRouteTimeout(
              llm.chatOnce(textOnlyMsgs, {
                model: decision.model,
                temperature: 0.2,
                maxTokens: wendyConfig.fastPath.maxTokens,
              }),
              fastPathTimeoutMs,
              "wendy fast path text-only",
            );
          } catch (fallbackErr) {
            const fallbackText = getFastPathFallbackReply({ intent, message, locale });
            if (!fallbackText) throw fallbackErr;
            rootLogger.warn(
              { err: fallbackErr, userId, requestId },
              "[ai/wendy] empty fast path failed, using local simple_qa fallback",
            );
            finalText = fallbackText;
          }
          outputTokens += estimateTokens(finalText);
        }

        if (finalText) {
          assistantResponseForMemory += finalText;
          if (ttftMs === null) ttftMs = Date.now() - startedAt;
          send({ type: "token", value: finalText });
        }
        if (!finalText && !terminalDoneSent) {
          sendRecoveryFallbackOnce("empty_fast_path", "error_model");
        } else {
          sendDoneOnce({
            intent,
            answerMode: "llm-fast-path",
            usage: { model: decision.model, inputTokens, outputTokens },
          });
        }
      } else {
        // ── 3. Full path: growth agent completo ──────────────────────────
        const FULL_PATH_TIMEOUT_MS = parseInt(process.env.WENDY_FULL_PATH_TIMEOUT_MS ?? "12000");
        let fullPathTimedOut = false;
        const fullPathTimeout = setTimeout(() => {
          fullPathTimedOut = true;
          aborted = true;
          status = "error_timeout";
          responseCategory = "error_model";
          if (assistantResponseForMemory.trim()) {
            sendDoneOnce({
              intent,
              answerMode: "llm-full-path",
              usage: { model: decision.model, inputTokens, outputTokens },
              recovery: { reason: "full_path_timeout_after_tokens", status: "error_timeout" },
            });
          } else {
            sendRecoveryFallbackOnce("full_path_timeout", "error_timeout");
          }
          if (!res.writableEnded) res.end();
        }, FULL_PATH_TIMEOUT_MS);

        const [userMemory, recentSummaries] = await Promise.all([
          loadMemory(userId),
          loadRecentSummaries(userId).catch(() => []),
        ]);
        const memorySection =
          buildMemorySection(userMemory) +
          buildSessionHistorySection(recentSummaries) +
          personalContext.contexts.semanticMemory +
          personalContext.contexts.openHuman +
          `\n\n${wendyIntelligenceDirectives}` +
          followUpPromptSection;

        // Flatten compressed history per il growth agent
        const flatHistory = [
          ...(compressedHistory?.summary
            ? [
                {
                  role: "assistant" as const,
                  content: `[Riepilogo sessione precedente]\n${compressedHistory.summary}`,
                },
              ]
            : []),
          ...(compressedHistory?.recentMessages ?? []),
        ];

        inputTokens = estimateTokens(
          memorySection + message + flatHistory.map((m) => m.content).join(" "),
        );

        try {
          for await (const event of runGrowthAgent({
            userId,
            sessionId: threadId ? Number(threadId) : undefined,
            userContext: {
              isPremium,
              memorySection,
              codeGraphSection: personalContext.contexts.graphify,
              locale,
              journeyType: pageContext?.journeyType,
            },
            history: flatHistory,
            userMessage: effectiveMessage,
            requestId,
            wendyIntent: intent, // abilita i Wendy domain tools nel full path
            isPredefined,
            ...(neuralContext ? { neuralContext } : {}),
            executeExternalTool: executeWendyToolCall,
          })) {
            if (aborted) break;
            if (event.type === "done") {
              sendDoneOnce({
                answerMode: "llm-full-path",
                ...(event as Record<string, unknown>),
              });
            } else if (event.type === "error") {
              status = "error_model";
              errorCode = "GROWTH_AGENT_ERROR";
              responseCategory = "error_model";
              if (assistantResponseForMemory.trim()) {
                sendDoneOnce({
                  intent,
                  answerMode: "recovery-fallback",
                  usage: { model: decision.model, inputTokens, outputTokens },
                  recovery: { reason: "growth_agent_error_after_tokens", status: "error_model" },
                });
              } else {
                sendRecoveryFallbackOnce("growth_agent_error", "error_model");
              }
            } else {
              send(event);
            }
            if (event.type === "token") {
              if (ttftMs === null) ttftMs = Date.now() - startedAt;
              outputTokens += estimateTokens(event.value);
              assistantResponseForMemory += event.value;
            }
            if (event.type === "done") {
              domainForLog = event.routeDecision?.domain ?? null;
              supervisorScoreForLog = event.supervisorResult?.score ?? null;
              wasRewrittenForLog = event.supervisorResult?.rewritten ?? false;
            }
            if (event.type === "done" || event.type === "error") {
              // Rileva insufficient_data dal done event dell'agente
              if (isDoneWithLowEval(event)) {
                responseCategory = "insufficient_data";
              }
              break;
            }
          }
        } finally {
          clearTimeout(fullPathTimeout);
          if (fullPathTimedOut) {
            status = "error_timeout";
            errorCode = "FULL_PATH_TIMEOUT";
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      rootLogger.error(
        { err, userId, requestId },
        "[ai/wendy] unhandled error",
      );
      const lowerMsg = msg.toLowerCase();
      status = lowerMsg.includes("timeout")
        ? "error_timeout"
        : lowerMsg.includes("rate")
          ? "error_ratelimit"
          : "error_internal";
      errorCode = msg.slice(0, 50);
      responseCategory = status.startsWith("error")
        ? "error_model"
        : responseCategory;
      if (assistantResponseForMemory.trim()) {
        sendDoneOnce({
          intent,
          answerMode: "recovery-fallback",
          usage: { model: decision.model, inputTokens, outputTokens },
          recovery: { reason: "unhandled_error_after_tokens", status },
        });
      } else {
        sendRecoveryFallbackOnce("unhandled_error", status);
      }
    } finally {
      // Inferisci responseCategory da status se non già impostato
      if (responseCategory === "success" && status !== "success") {
        responseCategory = status.includes("tool")
          ? "error_tool"
          : "error_model";
      }
      // Se ci sono stati tool failure e responseCategory è ancora success, segnalalo
      if (
        toolsUsedInRequest.length > 0 &&
        responseCategory === "success" &&
        toolsUsedInRequest.some((t) => t === "__failed")
      ) {
        responseCategory = "error_tool";
      }

      const latencyMs = Date.now() - startedAt;
      if (status === "success" || assistantResponseForMemory.trim()) {
        storeSemanticTurnInBackground({
          userId,
          userMessage: message,
          assistantResponse: assistantResponseForMemory,
        });
        if (neuralContext) {
          void reinforceCoActivations({
            userId,
            requestId,
            items: neuralContext.activeItems,
          });
        }
      }
      const wendySelfCheck = evaluateWendyResponse({
        userMessage: message,
        responseText: assistantResponseForMemory,
        decision: wendyDecisionPlan,
        contextSources: [
          ...new Set([
            ...toolsUsedInRequest.filter((tool) => tool !== "__failed"),
            ...ragSourcesUsed,
            ...(ragChunksRetrieved > 0 ? ["search_rag"] : []),
          ]),
        ],
      });
      if (!wendySelfCheck.ok) {
        rootLogger.warn(
          {
            userId,
            requestId,
            score: wendySelfCheck.score,
            issues: wendySelfCheck.issues.map((issue) => issue.code),
          },
          "[ai/wendy] self-check issues detected",
        );
      }
      const costUsdEst = estimateCost(decision.model, inputTokens, outputTokens);
      recordAiCall({
        requestId,
        userId,
        ...(threadId ? { threadId } : {}),
        intent: intent,
        tier: decision.tier,
        model: decision.model,
        inputTokens,
        outputTokens,
        costUsdEst,
        latencyMs,
        totalTurns: compressedHistory?.totalTurns ?? 0,
        status,
        ...(errorCode ? { errorCode } : {}),
        locale,
        toolCallsCount: toolsUsedInRequest.length,
        toolsUsed: [...new Set(toolsUsedInRequest)],
        responseCategory,
        searchMode: searchModeUsed,
        ragChunksRetrieved,
        ragTopSimilarity,
        ragSourcesUsed: [...new Set(ragSourcesUsed)],
        domain: domainForLog,
        supervisorScore: supervisorScoreForLog,
        wasRewritten: wasRewrittenForLog,
        ttftMs,
      });
      recordWendyCost(decision.model, costUsdEst);
      if (supervisorScoreForLog !== null && domainForLog) {
        recordQualityScore(domainForLog, intent, supervisorScoreForLog);
      }
      if (ttftMs !== null) recordTtft(ttftMs / 1000);

      if (!res.writableEnded) res.end();
      markIdle();
    }
  },
);

export default router;
