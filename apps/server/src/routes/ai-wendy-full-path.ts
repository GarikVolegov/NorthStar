import {
  buildMemorySection,
  buildSessionHistorySection,
  estimateTokens,
  getWendyRecoveryFallbackReply,
  loadMemory,
  loadRecentSummaries,
  runGrowthAgent,
} from "@workspace/ai-server";
import type {
  CompressedHistory,
  WendyActivationContext,
  WendyIntent,
  WendyPageContext,
  WendyRouterDecision,
} from "@workspace/ai-server";
import { executeWendyToolCall } from "../lib/wendy-tool-executor";
import { isDoneWithLowEval } from "./ai-wendy-shared";

type SendFn = (data: object) => void;
type SendDoneFn = (extra?: Record<string, unknown>) => void;

type FullPathPersonalContext = {
  contexts: {
    semanticMemory: string;
    openHuman: string;
    graphify: string;
  };
};

export async function runWendyFullPath(input: {
  compressedHistory?: CompressedHistory | undefined;
  decision: WendyRouterDecision;
  effectiveMessage: string;
  endStream: () => void;
  followUpPromptSection: string;
  getAborted: () => boolean;
  intent: WendyIntent;
  isPremium: boolean;
  isPredefined: boolean;
  locale: string;
  message: string;
  neuralContext: WendyActivationContext | null;
  pageContext?: WendyPageContext | undefined;
  personalContext: FullPathPersonalContext;
  requestId: string;
  send: SendFn;
  sendDoneOnce: SendDoneFn;
  setAborted: (aborted: boolean) => void;
  startedAt: number;
  threadId?: string | undefined;
  userId: number;
  wendyIntelligenceDirectives: string;
}) {
  const {
    compressedHistory,
    decision,
    effectiveMessage,
    endStream,
    followUpPromptSection,
    getAborted,
    intent,
    isPremium,
    isPredefined,
    locale,
    message,
    neuralContext,
    pageContext,
    personalContext,
    requestId,
    send,
    sendDoneOnce,
    setAborted,
    startedAt,
    threadId,
    userId,
    wendyIntelligenceDirectives,
  } = input;

  let status:
    | "success"
    | "error_model"
    | "error_timeout"
    | "error_ratelimit"
    | "error_internal" = "success";
  let errorCode: string | undefined;
  let responseCategory:
    | "success"
    | "insufficient_data"
    | "refused"
    | "error_tool"
    | "error_model" = "success";
  let inputTokens = 0;
  let outputTokens = 0;
  let assistantResponseForMemory = "";
  let domainForLog: string | null = null;
  let supervisorScoreForLog: number | null = null;
  let wasRewrittenForLog = false;
  let ttftMs: number | null = null;

  const sendLocalRecoveryFallback = (
    reason: string,
    fallbackStatus: typeof status = "error_model",
  ) => {
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
      usage: { model: decision.model, inputTokens, outputTokens },
      recovery: { reason, status: fallbackStatus },
    });
  };

  const fullPathTimeoutMs = parseInt(
    process.env.WENDY_FULL_PATH_TIMEOUT_MS ?? "12000",
  );
  let fullPathTimedOut = false;
  const fullPathTimeout = setTimeout(() => {
    fullPathTimedOut = true;
    setAborted(true);
    status = "error_timeout";
    responseCategory = "error_model";
    if (assistantResponseForMemory.trim()) {
      sendDoneOnce({
        intent,
        answerMode: "llm-full-path",
        usage: { model: decision.model, inputTokens, outputTokens },
        recovery: {
          reason: "full_path_timeout_after_tokens",
          status: "error_timeout",
        },
      });
    } else {
      sendLocalRecoveryFallback("full_path_timeout", "error_timeout");
    }
    endStream();
  }, fullPathTimeoutMs);

  try {
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

    for await (const event of runGrowthAgent({
      userId,
      sessionId: threadId ? Number(threadId) : undefined,
      userContext: {
        isPremium,
        memorySection,
        codeGraphSection: personalContext.contexts.graphify,
        locale,
        journeyType: pageContext?.journeyType,
        pageContext: pageContext as Record<string, unknown> | undefined,
      },
      history: flatHistory,
      userMessage: effectiveMessage,
      requestId,
      wendyIntent: intent,
      isPredefined,
      ...(neuralContext ? { neuralContext } : {}),
      executeExternalTool: executeWendyToolCall,
    })) {
      if (getAborted()) break;
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
            recovery: {
              reason: "growth_agent_error_after_tokens",
              status: "error_model",
            },
          });
        } else {
          sendLocalRecoveryFallback("growth_agent_error", "error_model");
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

  return {
    assistantResponseForMemory,
    domainForLog,
    errorCode,
    inputTokens,
    outputTokens,
    responseCategory,
    status,
    supervisorScoreForLog,
    ttftMs,
    wasRewrittenForLog,
  };
}
