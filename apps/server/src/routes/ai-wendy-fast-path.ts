import {
  buildLightPrompt,
  estimateTokens,
  getLLMForRoute,
  getWendyRecoveryFallbackReply,
  toolsToOpenAIFormat,
  wendyConfig,
} from "@workspace/ai-server";
import type {
  WendyActivationContext,
  WendyIntent,
  WendyPageContext,
  WendyRouterDecision,
} from "@workspace/ai-server";
import type { Logger } from "pino";
import { executeWendyToolCall } from "../lib/wendy-tool-executor";
import { withRouteTimeout } from "../lib/wendy-fast-path";
import { isClientSideToolData, type WendyToolMessage } from "./ai-wendy-shared";

type SendFn = (data: object) => void;
type SendDoneFn = (extra?: Record<string, unknown>) => void;

export async function runWendyFastPath(input: {
  decision: WendyRouterDecision;
  effectiveMessage: string;
  fastPathTimeoutMs: number;
  followUpContext?: string | undefined;
  followUpPromptSection: string;
  intent: WendyIntent;
  locale: string;
  logger: Logger;
  message: string;
  neuralContext: WendyActivationContext | null;
  pageContext?: WendyPageContext | undefined;
  personalContext: string;
  requestId: string;
  send: SendFn;
  sendDoneOnce: SendDoneFn;
  startedAt: number;
  userId: number;
}) {
  const {
    decision,
    effectiveMessage,
    fastPathTimeoutMs,
    followUpContext,
    followUpPromptSection,
    intent,
    locale,
    logger,
    message,
    neuralContext,
    pageContext,
    personalContext,
    requestId,
    send,
    sendDoneOnce,
    startedAt,
    userId,
  } = input;

  let inputTokens = 0;
  let outputTokens = 0;
  let assistantResponseForMemory = "";
  let ttftMs: number | null = null;
  let status: "success" | "error_model" = "success";
  let responseCategory: "success" | "error_model" = "success";

  const sendLocalRecoveryFallback = (reason: string) => {
    const fallbackText = getWendyRecoveryFallbackReply({ intent, message, locale });
    status = "error_model";
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
      recovery: { reason, status: "error_model" },
    });
  };

  const systemPrompt =
    buildLightPrompt({
      locale,
      intent,
      userMessage: effectiveMessage,
      ...(pageContext ? { pageContext } : {}),
      ...(neuralContext?.promptSection
        ? { neuralSection: neuralContext.promptSection }
        : {}),
    }) +
    personalContext +
    followUpPromptSection;

  const openAiTools = toolsToOpenAIFormat(decision.toolsEnabled);
  const llm = getLLMForRoute({
    provider: decision.provider ?? "openrouter",
  });

  inputTokens = estimateTokens(systemPrompt + message + (followUpContext ?? ""));
  send({ type: "status", value: intent === "navigation" ? "âš¡" : "ðŸ’¬" });

  const msgs: WendyToolMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: message },
  ];
  const textOnlyMsgs: WendyToolMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: message },
  ];

  const maxToolTurns = wendyConfig.fastPath.maxToolTurns;
  let toolTurns = 0;
  let finalText = "";

  while (toolTurns < maxToolTurns) {
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
      logger.warn(
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
        logger.warn(
          { err: fallbackErr, userId, requestId },
          "[ai/wendy] fast path text-only failed, using honest recovery message",
        );
        finalText = getWendyRecoveryFallbackReply({ intent, message, locale });
      }
      outputTokens += estimateTokens(finalText);
      break;
    }
    outputTokens += estimateTokens(result.content);

    if (result.toolCalls.length === 0 || result.finishReason === "stop") {
      finalText = result.content;
      break;
    }

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

      if (toolResult.ok && isClientSideToolData(toolData)) {
        sendDoneOnce({
          intent,
          answerMode: "llm-fast-path",
          usage: { model: decision.model, inputTokens, outputTokens },
        });
        return {
          assistantResponseForMemory,
          inputTokens,
          outputTokens,
          responseCategory,
          shouldReturn: true,
          status,
          ttftMs,
        };
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
      logger.warn(
        { err: fallbackErr, userId, requestId },
        "[ai/wendy] empty fast path failed, using honest recovery message",
      );
      finalText = getWendyRecoveryFallbackReply({ intent, message, locale });
    }
    outputTokens += estimateTokens(finalText);
  }

  if (finalText) {
    assistantResponseForMemory += finalText;
    if (ttftMs === null) ttftMs = Date.now() - startedAt;
    send({ type: "token", value: finalText });
  }
  if (!finalText) {
    sendLocalRecoveryFallback("empty_fast_path");
  } else {
    sendDoneOnce({
      intent,
      answerMode: "llm-fast-path",
      usage: { model: decision.model, inputTokens, outputTokens },
    });
  }

  return {
    assistantResponseForMemory,
    inputTokens,
    outputTokens,
    responseCategory,
    shouldReturn: false,
    status,
    ttftMs,
  };
}
