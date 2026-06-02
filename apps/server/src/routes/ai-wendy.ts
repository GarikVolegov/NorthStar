/**
 * ai-wendy.ts — entrypoint AI unificato per Wendy.
 *
 * POST /api/ai/wendy
 *
 * Due pipeline:
 *   Fast path (navigation/simple_qa): chiamata LLM diretta, risposta leggera.
 *   Full path (conversation/planning/deep_analysis): runGrowthAgent() completo con SSE.
 *
 * SECURITY: userId SEMPRE da req.user.id (JWT), mai dal body (.brain/40_Agent_Context/rules/SECURITY_RULES.md).
 * PRIVACY: nessun contenuto integrale di messaggi nei log (PRIVACY_DESIGN.md).
 */
import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { optionalAuth } from "../middleware/auth";
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
  resolveWendyRoute,
  estimateTokens,
  ensureWendyConfigFresh,
  wendyConfig,
  getWendyRecoveryFallbackReply,
  shouldUseWendyQuickActionFastPath,
  isLlmConfigured,
  buildWendyIntelligenceDirectives,
  buildWendySuggestedPrompts,
  planWendyDecision,
} from "@workspace/ai-server";
import type { CompressedHistory, WendyActivationContext, WendyPageContext } from "@workspace/ai-server";
import {
  buildWendyContextSources,
  WendyRequestSchema,
} from "./ai-wendy-shared";
import { runWendyFastPath } from "./ai-wendy-fast-path";
import { runWendyFullPath } from "./ai-wendy-full-path";
import {
  finalizeWendyRequest,
  type WendyResponseCategory,
  type WendyRouteStatus,
} from "./ai-wendy-finalize";
import { handleWendyLocalQuickAction } from "./ai-wendy-quick-actions";
import {
  EMPTY_WENDY_PERSONAL_CONTEXT,
  prepareWendyContext,
  type WendyPersonalContext,
} from "./ai-wendy-context";
import { resolveWendyLocale } from "../lib/wendy-locale";
import {
  buildWendyDataBackedSuggestedPrompts,
  classifyWendyDataBackedQuickAction,
} from "../lib/wendy-data-backed-quick-action";
import { checkRabbitEmergency } from "@workspace/ai-server";
const router = Router();

// ── Handler ───────────────────────────────────────────────────────────────────

router.post(
  "/",
  optionalAuth,
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

    if (!req.user) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();
      res.write(
        `data: ${JSON.stringify({
          type: "gate",
          feature: "auth_required",
          authRequired: true,
          retryable: false,
          loginUrl: "/sign-in",
          message: "Accedi per parlare con Wendy e salvare il contesto del tuo percorso.",
        })}\n\n`,
      );
      res.end();
      return;
    }

    await ensureWendyConfigFresh();

    const user = req.user;

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
    const dataBackedSuggestedPromptExtraFor = (candidateMessage: string) => {
      const kind = classifyWendyDataBackedQuickAction(candidateMessage);
      return kind
        ? { suggestedPrompts: buildWendyDataBackedSuggestedPrompts({ kind, locale }) }
        : {};
    };
    const followUpContext = contextPrompt?.trim();
    const effectiveMessage = followUpContext
      ? `${message}\n\n[Contesto operativo follow-up Wendy]\n${followUpContext}`
      : message;
    const followUpPromptSection = followUpContext
      ? `\n\n## Contesto operativo follow-up\n${followUpContext}\n\nUsa questo contesto per continuare la decisione precedente, attivare tool dell'app quando servono dati/modifiche, e proporre il prossimo passo eseguibile senza ripartire da zero.`
      : "";

    // SECURITY: userId SEMPRE dal JWT, mai dal body
    const userId = user.id;
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

    let personalContext: WendyPersonalContext = EMPTY_WENDY_PERSONAL_CONTEXT;

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

    let status: WendyRouteStatus = "success";
    let errorCode: string | undefined;
    let inputTokens = 0;
    let outputTokens = 0;
    let assistantResponseForMemory = "";
    const fastPathTimeoutMs = wendyConfig.fastPath.timeoutMs;

    // Telemetria Step 5
    const toolsUsedInRequest: string[] = [];
    let responseCategory: WendyResponseCategory = "success";
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
        searchModeUsed,
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
        ...dataBackedSuggestedPromptExtraFor(message),
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

    const quickActionResult = await handleWendyLocalQuickAction({
      effectiveMessage,
      endStream: () => {
        if (!res.writableEnded) res.end();
        markIdle();
      },
      intent,
      llmConfigured,
      locale,
      logger: rootLogger,
      message,
      requestId,
      send,
      sendDoneOnce,
      startedAt,
      userId,
    });
    if (quickActionResult) {
      outputTokens += quickActionResult.outputTokens;
      assistantResponseForMemory += quickActionResult.assistantResponseForMemory;
      ttftMs = quickActionResult.ttftMs;
      return;
    }

    const preparedContext = await prepareWendyContext({
      effectiveMessage,
      intent,
      logger: rootLogger,
      ...(pageContext ? { pageContext: pageContext as WendyPageContext } : {}),
      requestId,
      useQuickActionLightPipeline,
      userId,
      userRole: user.role,
    });
    personalContext = preparedContext.personalContext;
    neuralContext = preparedContext.neuralContext;

    try {
      // ── 2. Fast path: navigation / simple_qa ────────────────────────────
      const useLightPipeline = decision.skipFullPipeline || useQuickActionLightPipeline;
      if (useLightPipeline) {
        const result = await runWendyFastPath({
          decision,
          effectiveMessage,
          fastPathTimeoutMs,
          followUpContext,
          followUpPromptSection,
          intent,
          locale,
          logger: rootLogger,
          message,
          neuralContext,
          ...(pageContext ? { pageContext: pageContext as WendyPageContext } : {}),
          personalContext: personalContext.context,
          requestId,
          send,
          sendDoneOnce,
          startedAt,
          userId,
        });
        inputTokens = result.inputTokens;
        outputTokens += result.outputTokens;
        assistantResponseForMemory += result.assistantResponseForMemory;
        if (result.ttftMs !== null) ttftMs = result.ttftMs;
        if (result.status !== "success") status = result.status;
        if (result.responseCategory !== "success") {
          responseCategory = result.responseCategory;
        }
        if (result.shouldReturn) return;
      } else {
        const result = await runWendyFullPath({
          ...(compressedHistory
            ? { compressedHistory: compressedHistory as CompressedHistory }
            : {}),
          decision,
          effectiveMessage,
          endStream: () => {
            if (!res.writableEnded) res.end();
          },
          followUpPromptSection,
          getAborted: () => aborted,
          intent,
          isPremium,
          isPredefined,
          locale,
          message,
          neuralContext,
          ...(pageContext ? { pageContext: pageContext as WendyPageContext } : {}),
          personalContext,
          requestId,
          send,
          sendDoneOnce,
          setAborted: (value) => {
            aborted = value;
          },
          startedAt,
          ...(threadId ? { threadId } : {}),
          userId,
          wendyIntelligenceDirectives,
        });
        inputTokens = result.inputTokens;
        outputTokens += result.outputTokens;
        assistantResponseForMemory += result.assistantResponseForMemory;
        status = result.status;
        if (result.errorCode) errorCode = result.errorCode;
        responseCategory = result.responseCategory;
        domainForLog = result.domainForLog;
        supervisorScoreForLog = result.supervisorScoreForLog;
        wasRewrittenForLog = result.wasRewrittenForLog;
        if (result.ttftMs !== null) ttftMs = result.ttftMs;
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
      finalizeWendyRequest({
        assistantResponseForMemory,
        ...(compressedHistory
          ? { compressedHistory: compressedHistory as CompressedHistory }
          : {}),
        decision,
        domainForLog,
        ...(errorCode ? { errorCode } : {}),
        inputTokens,
        intent,
        locale,
        logger: rootLogger,
        message,
        neuralContext,
        outputTokens,
        ragChunksRetrieved,
        ragSourcesUsed,
        ragTopSimilarity,
        requestId,
        responseCategory,
        searchModeUsed,
        startedAt,
        status,
        supervisorScoreForLog,
        ...(threadId ? { threadId } : {}),
        toolsUsedInRequest,
        ttftMs,
        userId,
        wasRewrittenForLog,
        wendyDecisionPlan,
      });

      if (!res.writableEnded) res.end();
      markIdle();
    }
  },
);

export default router;
