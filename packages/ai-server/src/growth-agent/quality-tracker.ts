import { eq } from "drizzle-orm";
import { aiCostLogTable, db } from "@workspace/db";
import { logger } from "../logger";
import { recordFeedback, recordQualityScore } from "../metrics";
import { recordWendyBrainEvent } from "../wendy-brain";

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

  if (event.userFeedback === "down" || event.wasRewritten) {
    void recordWendyBrainEvent({
      type: "open_question",
      title: `Quality issue: ${event.domain}/${event.intent}`,
      content: `Supervisor score ${event.supervisorScore.toFixed(2)} for ${event.domain}/${event.intent}. Rewritten: ${event.wasRewritten ? "yes" : "no"}. Feedback: ${event.userFeedback ?? "none"}.`,
      sourceType: "quality_event",
      sourceRef: event.requestId,
      confidence: Math.max(0.55, 1 - event.supervisorScore),
      importance: event.userFeedback === "down" ? 0.8 : 0.65,
      metadata: {
        domain: event.domain,
        intent: event.intent,
        model: event.model,
        platitudeHits: event.platitudeHits,
        actionPatternHits: event.actionPatternHits,
      },
    }).catch((err) => {
      logger.warn({ err, requestId: event.requestId }, "[quality-tracker] wendy brain event failed");
    });
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
