/**
 * POST /api/growth-agent/chat  —  SSE streaming chat with persistent memory.
 *
 * FLOW PER REQUEST:
 *   1. Load user profile from DB
 *   2. Load persistent memory (facts + patterns) AND recent session summaries — parallel
 *   3. Build userContext with memory + session history injected
 *   4. Stream GPT-4o response token by token  [wrapped in Circuit Breaker]
 *   5. [NON-BLOCKING] After stream ends:
 *        a. Save/update coach_sessions (messages, topics, avgConfidence, evalBreakdown)
 *        b. Extract + merge memory (facts + patterns)
 *        c. Summarize this session via GPT-4o-mini → session_summaries table
 *
 * Voice Mode (voiceMode: true in body):
 *   - Bypasses RAG, CoT, self-evaluator, supervisor
 *   - Uses buildVoiceSystemPrompt() → WENDY_SYSTEM_PROMPT (max 2-3 frasi, zero markdown)
 *   - Uses gpt-4o-mini (lower latency for TTS pipeline)
 *   - Status events are suppressed (no "🔍 Analizzando..." in voice)
 *   - Session save + memory extraction still run in background
 *
 * Circuit Breaker (wendyBreaker):
 *   - Wraps the entire runGrowthAgent() call
 *   - OPEN  → aiFallbackStream('open')    emitted; HTTP 200 + X-Circuit-State: OPEN
 *   - Timeout → aiFallbackStream('timeout') emitted
 *   - HALF_OPEN probe failure → re-opens breaker, fallback emitted
 *   - State header: X-Circuit-State: CLOSED | OPEN | HALF_OPEN
 *
 * Body: {
 *   message: string,
 *   sessionId?: number,
 *   history: ChatMessage[],
 *   userContext?: Partial<UserContext>,
 *   voiceMode?: boolean
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
import {
  summarizeSession,
  loadRecentSummaries,
  buildSessionHistorySection,
} from "@workspace/integrations-openai-ai-server/growth-agent/session-summarizer";
import { db } from "@workspace/db";
import { usersTable, coachSessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { EvalResult } from "@workspace/integrations-openai-ai-server/growth-agent/self-evaluator";
import {
  wendyBreaker,
  aiFallbackStream,
  classifyBreakerError,
  CircuitOpenError,
} from "../../ai-circuit-breaker";

const MIN_MESSAGES_TO_SUMMARIZE = 4;

const router = Router();

router.post("/", async (req, res) => {
  const userId: number = (req as any).user.id;

  const {
    message,
    sessionId,
    history = [],
    userContext: ctxOverride = {},
    voiceMode = false,
  } = req.body as {
    message: string;
    sessionId?: number;
    history: ChatMessage[];
    userContext?: Partial<UserContext>;
    voiceMode?: boolean;
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

  // ── 2. Load persistent memory + recent session summaries (PARALLEL) ─────
  const [memory, recentSummaries] = await Promise.all([
    loadMemory(userId),
    voiceMode ? Promise.resolve([]) : loadRecentSummaries(userId, 3),
  ]);

  const memorySection         = buildMemorySection(memory);
  const sessionHistorySection = voiceMode ? "" : buildSessionHistorySection(recentSummaries);

  // ── 3. Build userContext ─────────────────────────────────────────────────
  const userContext: UserContext & { memorySection?: string } = {
    name:          user.name,
    journeyType:   user.journeyType,
    userMode:      user.userMode,
    memorySection: memorySection + sessionHistorySection,
    ...ctxOverride,
  };

  if (!voiceMode && recentSummaries.length > 0) {
    console.log(`[chat] injected ${recentSummaries.length} session summaries for user ${userId}`);
  }

  // ── 4. SSE setup ──────────────────────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  // Expose circuit state to the client (useful for debugging / monitoring)
  res.setHeader("X-Circuit-State", wendyBreaker.getState());
  res.flushHeaders();

  const send = (data: unknown) =>
    res.write(`data: ${JSON.stringify(data)}\n\n`);

  const assistantTokens: string[] = [];
  let lastEvalResult: EvalResult | undefined;
  let usedFallback = false;

  try {
    // ── Circuit Breaker: wrap runGrowthAgent inside wendyBreaker.fire() ───
    // fire() returns a promise wrapping the full iteration. We convert the
    // async generator to a promise by consuming it inside fire(), then
    // replay the collected events. This keeps the breaker timeout working
    // correctly without restructuring the streaming loop.
    await wendyBreaker.fire(async () => {
      for await (const event of runGrowthAgent({
        userId,
        userContext,
        history,
        userMessage: message,
        memoryFactCount: memory.facts.length,
        voiceMode,
      })) {
        if (voiceMode && event.type === "status") continue;

        if (event.type === "token") {
          assistantTokens.push(event.value);
        }
        if (event.type === "done" && (event as any).evalResult) {
          lastEvalResult = (event as any).evalResult;
        }
        send(event);
        if (event.type === "done" || event.type === "error") break;
      }
    });
  } catch (err) {
    usedFallback = true;
    const reason = classifyBreakerError(err);

    if (err instanceof CircuitOpenError) {
      // Breaker is OPEN — stream graceful fallback, do NOT count as a new failure
      console.warn(`[chat] Circuit OPEN for user ${userId} — streaming fallback`);
    } else {
      // Unexpected error (network, parse, etc.) — already recorded by breaker
      console.error(`[chat] runGrowthAgent error (reason: ${reason}):`, err);
    }

    // Stream the fallback message then close
    for await (const event of aiFallbackStream(reason)) {
      send(event);
    }
  } finally {
    res.end();
  }

  // ── 5. Post-stream: save session + extract memory + summarize (non-blocking)
  // Skip if we served a fallback — no real assistant content to persist.
  if (usedFallback) return;

  setImmediate(async () => {
    try {
      const assistantContent = assistantTokens.join("");
      const fullHistory: ChatMessage[] = [
        ...history,
        { role: "user",      content: message },
        { role: "assistant", content: assistantContent },
      ];

      const evalBreakdownIncrement = lastEvalResult
        ? { [lastEvalResult.level]: 1 }
        : {};

      let targetSessionId = sessionId;

      // ── 5a. Create or update coach_sessions ──────────────────────────────
      if (!targetSessionId) {
        const [newSession] = await db
          .insert(coachSessionsTable)
          .values({
            userId,
            title:         message.slice(0, 80),
            messages:      fullHistory as any,
            messageCount:  fullHistory.length,
            topics:        [],
            avgConfidence: lastEvalResult?.score ?? null,
            evalBreakdown: evalBreakdownIncrement,
          })
          .returning({ id: coachSessionsTable.id });
        targetSessionId = newSession.id;
      } else {
        const [existing] = await db
          .select()
          .from(coachSessionsTable)
          .where(eq(coachSessionsTable.id, targetSessionId))
          .limit(1);

        if (existing) {
          const prevAvg   = existing.avgConfidence ?? lastEvalResult?.score ?? null;
          const prevCount = (existing.messageCount ?? 0);
          const newScore  = lastEvalResult?.score;
          const newAvg    = (prevAvg != null && newScore != null)
            ? (prevAvg * prevCount + newScore) / (prevCount + 1)
            : (prevAvg ?? newScore ?? null);

          const prevBreakdown   = (existing.evalBreakdown as Record<string, number>) ?? {};
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

      // ── 5b. Extract + merge memory ────────────────────────────────────────
      const extracted = await extractMemory(fullHistory);
      if (extracted && targetSessionId) {
        await mergeMemory(userId, targetSessionId, extracted);

        const newTopics = extracted.patterns
          .filter((p) => p.patternType === "recurring_theme")
          .map((p) => p.description.slice(0, 60));

        if (newTopics.length > 0) {
          const [sess] = await db
            .select({ topics: coachSessionsTable.topics })
            .from(coachSessionsTable)
            .where(eq(coachSessionsTable.id, targetSessionId!))
            .limit(1);

          const combined = [...new Set([
            ...((sess?.topics as string[]) ?? []),
            ...newTopics,
          ])].slice(0, 20);

          await db
            .update(coachSessionsTable)
            .set({ topics: combined })
            .where(eq(coachSessionsTable.id, targetSessionId!));
        }
      }

      // ── 5c. Summarize session (fire-and-forget) ───────────────────────────
      if (targetSessionId && fullHistory.length >= MIN_MESSAGES_TO_SUMMARIZE) {
        summarizeSession(userId, targetSessionId, fullHistory).catch((err) => {
          console.warn("[chat] session summarization failed (non-critical):", err);
        });
      }

    } catch (err) {
      console.error("[chat] post-stream analytics+memory save failed:", err);
    }
  });
});

export default router;
