/**
 * POST /api/growth-agent/feedback
 * ────────────────────────────────────
 * Saves / updates a thumbs-up or thumbs-down on a single coach message.
 * Protected by jwtMiddleware (standard — no admin secret needed).
 *
 * REQUEST
 *   Body: {
 *     sessionId:    number,   // coach_sessions.id
 *     messageIndex: number,   // 0-based index of the assistant message
 *     rating:       1 | -1,  // +1 = good, -1 = bad
 *     comment?:     string    // optional free text (max 500 chars)
 *   }
 *
 * RESPONSE 200
 *   { ok: true, id: number }   ← feedback row id (created or updated)
 *
 * UPSERT SEMANTICS:
 *   If the user already rated this message, the row is updated (rating + comment).
 *   This lets the user change thumbs-up → thumbs-down or vice versa.
 *
 * SECURITY:
 *   The route validates that the session belongs to the authenticated user
 *   before writing — prevents rating other users' sessions.
 *
 * ANALYTICS DOWNSTREAM:
 *   - supervisor-pattern-analyzer reads negative-rated sessions from
 *     supervisor_logs for prioritized weekly analysis.
 *   - GET /api/growth-agent/analytics can expose aggregate rating stats.
 */
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import {
  coachSessionsTable,
  responseFeedbackTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const userId: number = (req as any).user.id;

  const { sessionId, messageIndex, rating, comment } = req.body as {
    sessionId:    number;
    messageIndex: number;
    rating:       number;
    comment?:     string;
  };

  // ── Input validation ─────────────────────────────────────────────────────
  if (!Number.isInteger(sessionId) || sessionId < 1) {
    res.status(400).json({ error: "sessionId must be a positive integer" });
    return;
  }
  if (!Number.isInteger(messageIndex) || messageIndex < 0) {
    res.status(400).json({ error: "messageIndex must be a non-negative integer" });
    return;
  }
  if (rating !== 1 && rating !== -1) {
    res.status(400).json({ error: "rating must be 1 or -1" });
    return;
  }
  if (comment && comment.length > 500) {
    res.status(400).json({ error: "comment must be <= 500 chars" });
    return;
  }

  // ── Ownership check ─────────────────────────────────────────────────────
  const [session] = await db
    .select({ id: coachSessionsTable.id })
    .from(coachSessionsTable)
    .where(
      and(
        eq(coachSessionsTable.id, sessionId),
        eq(coachSessionsTable.userId, userId),
      ),
    )
    .limit(1);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  // ── Upsert feedback ──────────────────────────────────────────────────
  const [row] = await db
    .insert(responseFeedbackTable)
    .values({
      sessionId,
      messageIndex,
      rating:    rating as 1 | -1,
      comment:   comment?.trim() ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [responseFeedbackTable.sessionId, responseFeedbackTable.messageIndex],
      set: {
        rating:    rating as 1 | -1,
        comment:   comment?.trim() ?? null,
        updatedAt: new Date(),
      },
    })
    .returning({ id: responseFeedbackTable.id });

  res.json({ ok: true, id: row.id });
});

export default router;
