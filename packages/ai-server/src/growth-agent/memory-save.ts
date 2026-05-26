import type { LoggerFields } from "../logger";
import { logger } from "../logger";
import { FF } from "../feature-flags";
import { withTimeout } from "../utils";
import { extractMemory, extractMemoryIncremental, mergeMemory } from "./memory-manager";
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
  supervisorScore?: number | undefined;
}

export function scheduleMemorySave(opts: ScheduleMemorySaveOptions): void {
  const { userId, sessionId, history, userMessage, assistantResponse, routeDecision, logFields, supervisorScore } = opts;
  if (!FF.memoryEnabled) return;

  void (async () => {
    try {
      // Incremental extraction: fast, only last 2 messages, gated by supervisor score.
      const incremental = await withTimeout(
        extractMemoryIncremental(userMessage, assistantResponse, supervisorScore),
        3000,
        "extractMemoryIncremental",
      );

      if (incremental && (incremental.facts.length > 0 || incremental.patterns.length > 0)) {
        await withTimeout(mergeMemory(userId, sessionId, incremental), 2000, "mergeMemory-incremental");
        logger.info({ ...logFields, factCount: incremental.facts.length, patternCount: incremental.patterns.length }, "incremental memory saved");
        return; // incremental is sufficient — skip full extraction this turn
      }

      // Full extraction: triggered only when incremental finds nothing but history is rich.
      const turns = [
        ...history.slice(-8),
        { role: "user" as const, content: userMessage },
        { role: "assistant" as const, content: assistantResponse },
      ];
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
