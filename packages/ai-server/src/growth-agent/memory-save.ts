import type { LoggerFields } from "../logger";
import { logger } from "../logger";
import { FF } from "../feature-flags";
import { withTimeout } from "../utils";
import { extractMemory, mergeMemory } from "./memory-manager";
import type { ChatMessage } from "./agent";
import type { RouteDecision } from "./router-agent";

interface ScheduleMemorySaveOptions {
  userId: number;
  sessionId: number;
  history: ChatMessage[];
  userMessage: string;
  assistantResponse: string;
  routeDecision: RouteDecision;
  logFields: LoggerFields;
}

export function scheduleMemorySave(opts: ScheduleMemorySaveOptions): void {
  const { userId, sessionId, history, userMessage, assistantResponse, routeDecision, logFields } = opts;
  if (!FF.memoryEnabled) return;
  const turns = [
    ...history.slice(-8),
    { role: "user" as const, content: userMessage },
    { role: "assistant" as const, content: assistantResponse },
  ];
  void (async () => {
    try {
      const extracted = await withTimeout(extractMemory(turns), 5000, "extractMemory");
      if (!extracted) return;
      if (routeDecision.intent === "plan" || routeDecision.intent === "problem_solve") {
        const hasPending = extracted.facts.find((f) => f.key === "pending_follow_up");
        if (!hasPending) extracted.facts.push({ key: "pending_follow_up", value: routeDecision.handoffContext.slice(0, 200) });
      }
      if (extracted.facts.length > 0 || extracted.patterns.length > 0) {
        await withTimeout(mergeMemory(userId, sessionId, extracted), 3000, "mergeMemory");
        logger.info({ ...logFields, factCount: extracted.facts.length, patternCount: extracted.patterns.length }, "memory saved");
      }
    } catch (err) {
      logger.warn({ err, ...logFields }, "memory save failed/timed out");
    }
  })();
}
