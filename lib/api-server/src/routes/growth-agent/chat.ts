/**
 * POST /api/growth-agent/chat  —  SSE streaming chat with persistent memory.
 *
 * FLOW PER REQUEST:
 *   1. Load user profile from DB
 *   2. Load persistent memory (facts + patterns) — parallel with RAG inside agent
 *   3. Pass memory to prompt builder via userContext extension
 *   4. Stream GPT-4o response token by token
 *   5. [NON-BLOCKING] After stream ends:
 *        a. Save/update coach_sessions (messages, topics, avgConfidence, evalBreakdown)
 *        b. Extract + merge memory (facts + patterns)
 *
 * Memory extraction and analytics save are FIRE-AND-FORGET after the SSE
 * stream closes — the user doesn't wait for them.
 *
 * Body: {
 *   message: string,
 *   sessionId?: number,
 *   history: ChatMessage[],
 *   userContext?: Partial<UserContext>
 * }
 *
 * SSE events:
 *   { type: 'token',  value: '...' }
 *   { type: 'done',   sources: [...], evalResult?: {...}, sessionId?: number }
 *   { type: 'error',  message: '...' }
 */
import { Router } from "express";
import {
  runGrowthAgent,
  type ChatMessage,
  type UserContext,
} from "@workspace/integrations-openai-ai-server/growth-agent";
import {
  loadMemory,
  extractMemory,
  mergeMemory,
  buildMemorySection,
} from "@workspace/integrations-openai-ai-server/growth-agent/memory-manager";
import { db } from "@workspace/db";
import { usersTable, coachSessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { EvalResult } from "@workspace/integrations-openai-ai-server/growth-agent/self-evaluator";

const router = Router();

router.post("/", async (req, res) => {
  const userId: number = (req as any).user.id;

  const {
    message,
    sessionId,
    history = [],
    userContext: ctxOverride = {},
  } = req.body as {
    message: string;
    sessionId?: number;
    history: ChatMessage[];
    userContext?: Partial<UserContext>;
  };

  if (!message?.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  // ── 1. Load user profile ────────────────────────────────────────────────
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) return res.status(401).json({ error: "User not found" });

  // ── 2. Load persistent memory ───────────────────────────────────────────
  const memory = await loadMemory(userId);
  const memorySection = buildMemorySection(memory);

  // ── 3. Build userContext with memory injected ────────────────────────────
  const userContext: UserContext & { memorySection?: string } = {
    name:        user.name,
    journeyType: user.journeyType,
    userMode:    user.userMode,
    memorySection,
    ...ctxOverride,
  };

  // ── 4. SSE setup ─────────────────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: unknown) =>
    res.write(`data: ${JSON.stringify(data)}\n\n`);

  const assistantTokens: string[] = [];
  let lastEvalResult: EvalResult | undefined;

  try {
    for await (const event of runGrowthAgent({
      userId,
      userContext,
      history,
      userMessage: message,
      memoryFactCount: memory.facts.length,  // ← NEW: self-evaluator uses this
    })) {
      if (event.type === "token") {
        assistantTokens.push(event.value);
      }
      // Capture evalResult from done event
      if (event.type === "done" && event.evalResult) {
        lastEvalResult = event.evalResult;
      }
      send(event);
      if (event.type === "done" || event.type === "error") break;
    }
  } catch (err) {
    send({ type: "error", message: String(err) });
  } finally {
    res.end();
  }

  // ── 5. Post-stream: save session + extract memory (non-blocking) ──────────
  setImmediate(async () => {
    try {
      const assistantContent = assistantTokens.join("");
      const fullHistory: ChatMessage[] = [
        ...history,
        { role: "user",      content: message },
        { role: "assistant", content: assistantContent },
      ];

      // Build eval breakdown increment for this message
      const evalBreakdownIncrement = lastEvalResult
        ? {
            [lastEvalResult.level]: 1,
          }
        : {};

      let targetSessionId = sessionId;

      if (!targetSessionId) {
        // ── CREATE new session ──────────────────────────────────────────────
        const [newSession] = await db
          .insert(coachSessionsTable)
          .values({
            userId,
            title:          message.slice(0, 80),
            messages:       fullHistory as any,
            messageCount:   fullHistory.length,
            // Analytics fields
            topics:         [],
            avgConfidence:  lastEvalResult?.score ?? null,
            evalBreakdown:  evalBreakdownIncrement,
          })
          .returning({ id: coachSessionsTable.id });
        targetSessionId = newSession.id;
      } else {
        // ── UPDATE existing session ───────────────────────────────────────────
        // Fetch current session to merge analytics fields
        const [existing] = await db
          .select()
          .from(coachSessionsTable)
          .where(eq(coachSessionsTable.id, targetSessionId))
          .limit(1);

        if (existing) {
          // Rolling average for confidence
          const prevAvg    = existing.avgConfidence ?? lastEvalResult?.score ?? null;
          const prevCount  = (existing.messageCount ?? 0);
          const newScore   = lastEvalResult?.score;
          const newAvg     = (prevAvg != null && newScore != null)
            ? (prevAvg * prevCount + newScore) / (prevCount + 1)
            : (prevAvg ?? newScore ?? null);

          // Merge eval breakdown
          const prevBreakdown = (existing.evalBreakdown as Record<string, number>) ?? {};
          const mergedBreakdown: Record<string, number> = { ...prevBreakdown };
          if (lastEvalResult) {
            mergedBreakdown[lastEvalResult.level] =
              (mergedBreakdown[lastEvalResult.level] ?? 0) + 1;
          }

          await db
            .update(coachSessionsTable)
            .set({
              messages:      fullHistory as any,
              messageCount:  fullHistory.length,
              avgConfidence: newAvg != null ? Math.round(newAvg * 100) / 100 : null,
              evalBreakdown: mergedBreakdown,
              endedAt:       new Date(),
              updatedAt:     new Date(),
            })
            .where(eq(coachSessionsTable.id, targetSessionId));
        }
      }

      // ── Topics: extract from CoT themes via extractMemory ──────────────────
      // Topics are populated separately after memory extraction:
      // memory-manager extractMemory already identifies themes via GPT.
      // We append those themes to coach_sessions.topics[].
      const extracted = await extractMemory(fullHistory);
      if (extracted && targetSessionId) {
        await mergeMemory(userId, targetSessionId, extracted);

        // Append recurring_theme patterns as topics on the session
        const newTopics = extracted.patterns
          .filter((p) => p.patternType === "recurring_theme")
          .map((p) => p.description.slice(0, 60));

        if (newTopics.length > 0) {
          const [sess] = await db
            .select({ topics: coachSessionsTable.topics })
            .from(coachSessionsTable)
            .where(eq(coachSessionsTable.id, targetSessionId))
            .limit(1);

          const combined = [...new Set([
            ...((sess?.topics as string[]) ?? []),
            ...newTopics,
          ])].slice(0, 20); // max 20 topics per session

          await db
            .update(coachSessionsTable)
            .set({ topics: combined })
            .where(eq(coachSessionsTable.id, targetSessionId));
        }
      }
    } catch (err) {
      console.error("[chat] post-stream analytics+memory save failed:", err);
    }
  });
});

export default router;
