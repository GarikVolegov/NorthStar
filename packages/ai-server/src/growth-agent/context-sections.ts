import type { WendyActivationContext } from "../wendy-neural";
import { buildWendyBrainContextSection, searchWendyBrain } from "../wendy-brain";
import { wendyConfig } from "../config/wendy";
import { logger, type LoggerFields } from "../logger";
import { buildContextualMemorySection, searchMemory } from "./memory-search";

export async function resolveGrowthContextSections(input: {
  neuralContext: WendyActivationContext | null;
  userId: number;
  normalizedMessage: string;
  logFields: LoggerFields;
}): Promise<[contextualMemorySection: string, wendyBrainSection: string]> {
  if (input.neuralContext) {
    return [input.neuralContext.memorySection ?? "", input.neuralContext.wendyBrainSection ?? ""];
  }

  return await Promise.all([
    input.userId > 0
      ? searchMemory(input.userId, input.normalizedMessage, 5).then(buildContextualMemorySection).catch((err) => {
          logger.warn({ err, ...input.logFields }, "contextual memory search failed");
          return "";
        })
      : Promise.resolve(""),
    searchWendyBrain(input.normalizedMessage, {
      limit: wendyConfig.brain.maxContextNodes,
      includeCandidates: false,
    }).then(buildWendyBrainContextSection).catch((err) => {
      logger.warn({ err, ...input.logFields }, "wendy brain search failed");
      return "";
    }),
  ]);
}
