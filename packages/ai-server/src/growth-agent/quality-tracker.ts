import { eq } from "drizzle-orm";
import { aiCostLogTable, db } from "@workspace/db";
import { logger } from "../logger";
import { recordFeedback, recordQualityScore } from "../metrics";

export interface QualityEvent {
  requestId: string;
  domain: string;
  intent: string;
  model: string;
  supervisorScore: number;
  userFeedback: "up" | "down" | null;
  wasRewritten: boolean;
  platitudeHits: string[];
  actionPatternHits: string[];
}

function numeric(value: number, scale: number): string {
  return value.toFixed(scale);
}

export async function recordQualityEvent(event: QualityEvent): Promise<void> {
  try {
    await db
      .update(aiCostLogTable)
      .set({
        supervisorScore: numeric(event.supervisorScore, 3),
        userFeedback: event.userFeedback,
        wasRewritten: event.wasRewritten,
      })
      .where(eq(aiCostLogTable.requestId, event.requestId));
  } catch (err) {
    logger.warn({ err, requestId: event.requestId }, "[quality-tracker] ai_cost_log update failed");
  }

  recordQualityScore(event.domain, event.intent, event.supervisorScore);
  if (event.userFeedback) {
    recordFeedback(event.domain, event.userFeedback);
  }
}

export async function recordUserFeedback(
  requestId: string,
  feedback: "up" | "down",
  domain?: string | null,
): Promise<void> {
  try {
    await db
      .update(aiCostLogTable)
      .set({ userFeedback: feedback })
      .where(eq(aiCostLogTable.requestId, requestId));
  } catch (err) {
    logger.warn({ err, requestId }, "[quality-tracker] feedback update failed");
  }

  if (domain) {
    recordFeedback(domain, feedback);
  }
}
