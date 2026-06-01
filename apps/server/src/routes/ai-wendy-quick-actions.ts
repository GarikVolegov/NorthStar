import {
  estimateTokens,
  getFastPathFallbackReply,
  getLlmUnavailableReply,
  getWendyRecoveryFallbackReply,
  shouldUseImmediateFastPathFallback,
  shouldUseImmediateWendyRecoveryFallback,
} from "@workspace/ai-server";
import type { WendyIntent } from "@workspace/ai-server";
import type { Logger } from "pino";
import {
  buildWendyDataBackedGuidedAction,
  buildWendyDataBackedSuggestedPrompts,
  classifyWendyDataBackedQuickAction,
  formatWendyDataBackedQuickActionReply,
} from "../lib/wendy-data-backed-quick-action";
import { executeWendyToolCall } from "../lib/wendy-tool-executor";
import { buildConfirmableClientAction } from "./ai-wendy-actions";

type SendFn = (data: object) => void;
type SendDoneFn = (extra?: Record<string, unknown>) => void;

export async function handleWendyLocalQuickAction(input: {
  effectiveMessage: string;
  endStream: () => void;
  intent: WendyIntent;
  llmConfigured: boolean;
  locale: string;
  logger: Logger;
  message: string;
  requestId: string;
  send: SendFn;
  sendDoneOnce: SendDoneFn;
  startedAt: number;
  userId: number;
}) {
  const {
    effectiveMessage,
    endStream,
    intent,
    llmConfigured,
    locale,
    logger,
    message,
    requestId,
    send,
    sendDoneOnce,
    startedAt,
    userId,
  } = input;

  const suggestedPromptExtraFor = (candidateMessage: string) => {
    const kind = classifyWendyDataBackedQuickAction(candidateMessage);
    return kind
      ? { suggestedPrompts: buildWendyDataBackedSuggestedPrompts({ kind, locale }) }
      : {};
  };
  const finish = (text: string, extra: Record<string, unknown>) => {
    const outputTokens = estimateTokens(text);
    const ttftMs = Date.now() - startedAt;
    send({ type: "token", value: text });
    sendDoneOnce(extra);
    endStream();
    return { assistantResponseForMemory: text, outputTokens, ttftMs };
  };

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

    return finish(quickActionText, {
      intent,
      answerMode: "local-quick-action",
      suggestedPrompts: buildWendyDataBackedSuggestedPrompts({
        kind: dataBackedQuickAction,
        locale,
      }),
      usage: {
        model: "local-data-quick-action",
        inputTokens: estimateTokens(message),
        outputTokens: estimateTokens(quickActionText),
      },
    });
  }

  if (shouldUseImmediateWendyRecoveryFallback({ intent, message, llmConfigured })) {
    const quickActionText = getWendyRecoveryFallbackReply({ intent, message, locale });
    return finish(quickActionText, {
      intent,
      answerMode: "local-quick-action",
      ...suggestedPromptExtraFor(message),
      usage: {
        model: "local-quick-action",
        inputTokens: estimateTokens(message),
        outputTokens: estimateTokens(quickActionText),
      },
    });
  }

  if (shouldUseImmediateFastPathFallback({ intent, message })) {
    const fallbackText = getFastPathFallbackReply({ intent, message, locale });
    if (fallbackText) {
      return finish(fallbackText, {
        intent,
        answerMode: "local-fast-path",
        usage: {
          model: "local-fast-path",
          inputTokens: estimateTokens(message),
          outputTokens: estimateTokens(fallbackText),
        },
      });
    }
  }

  if (!llmConfigured) {
    const msg = getLlmUnavailableReply(locale);
    logger.warn(
      { userId, requestId },
      "[ai/wendy] no LLM provider configured - returning graceful notice",
    );
    return finish(msg, {
      intent,
      answerMode: "unconfigured",
      usage: {
        model: "unconfigured",
        inputTokens: estimateTokens(message),
        outputTokens: estimateTokens(msg),
      },
    });
  }

  return null;
}
