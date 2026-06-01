import {
  buildWendyActivationContext,
  persistActivationTrace,
} from "@workspace/ai-server";
import type { WendyActivationContext, WendyIntent, WendyPageContext } from "@workspace/ai-server";
import type { Logger } from "pino";
import { buildWikiLLMContext } from "../lib/wikillm-context-router";

export type WendyPersonalContext = Awaited<ReturnType<typeof buildWikiLLMContext>>;

export const EMPTY_WENDY_PERSONAL_CONTEXT: WendyPersonalContext = {
  context: "",
  contexts: { semanticMemory: "", openHuman: "", graphify: "", wendyBrain: "" },
  sources: [],
};

export async function prepareWendyContext(input: {
  effectiveMessage: string;
  intent: WendyIntent;
  logger: Logger;
  pageContext?: WendyPageContext | undefined;
  requestId: string;
  useQuickActionLightPipeline: boolean;
  userId: number;
  userRole: Parameters<typeof buildWikiLLMContext>[0]["userRole"];
}): Promise<{
  neuralContext: WendyActivationContext | null;
  personalContext: WendyPersonalContext;
}> {
  const {
    effectiveMessage,
    intent,
    logger,
    pageContext,
    requestId,
    useQuickActionLightPipeline,
    userId,
    userRole,
  } = input;

  if (useQuickActionLightPipeline) {
    logger.debug({ userId, requestId, intent }, "[ai/wendy] using lightweight quick-action path");
    return { personalContext: EMPTY_WENDY_PERSONAL_CONTEXT, neuralContext: null };
  }

  const personalContext = await buildWikiLLMContext({
    query: effectiveMessage,
    userId,
    userRole,
    includePersonalMemory: true,
    includeWendyBrain: false,
    graphifyProfile: "auto",
  }).catch((err) => {
    logger.warn({ err, userId, requestId }, "[ai/wendy] context build failed; continuing without personal context");
    return EMPTY_WENDY_PERSONAL_CONTEXT;
  });

  const neuralContext = await buildWendyActivationContext({
    requestId,
    userId,
    message: effectiveMessage,
    intent,
    domain: null,
    ...(pageContext ? { pageContext } : {}),
  }).catch((err) => {
    logger.warn({ err, userId, requestId }, "[ai/wendy] neural activation failed");
    return null;
  });
  if (neuralContext) await persistActivationTrace(neuralContext);
  return { personalContext, neuralContext };
}
