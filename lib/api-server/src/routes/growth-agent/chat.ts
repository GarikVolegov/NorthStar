/**
 * POST /api/growth-agent/chat  —  SSE streaming chat with persistent memory.
 *
 * FLOW PER REQUEST:
 *   1. Load user profile from DB
 *   2. Load persistent memory (facts + patterns) AND recent session summaries — parallel
 *   3. Build userContext with memory + session history injected
 *   4. Stream GPT-4o response token by token
 *   5. [NON-BLOCKING] After stream ends:
 *        a. Save/update coach_sessions (messages, topics, avgConfidence, evalBreakdown)
 *        b. Extract + merge memory (facts + patterns)
 *        c. [NEW Phase 10] Summarize this session via GPT-4o-mini → session_summaries table
 *
 * Phase 10 additions:
 *   - loadRecentSummaries(userId, 3) runs in parallel with loadMemory at step 2.
 *     Zero extra latency for the user: both fetches happen concurrently.
 *   - buildSessionHistorySection() formats the last 3 summaries and appends them
 *     to the system prompt so the coach always has cross-session context.
 *   - summarizeSession() fires after the session is saved (step 5c).
 *     It is FIRE-AND-FORGET — user never waits for it.
 *   - Summarization is SKIPPED for very short sessions (< 4 messages total)
 *     to avoid noisy one-liner summaries.
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
import {
  summarizeSession,
  loadRecentSummaries,
  buildSessionHistorySection,
} from "@workspace/integrations-openai-ai-server/growth-agent/session-summarizer";
import { db } from "@workspace/db";
import { usersTable, coachSessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { EvalResult } from "@workspace/integrations-openai-ai-server/growth-agent/self-evaluator";

// Minimum number of messages in a session before we bother summarizing.
// A session shorter than this (e.g. a single hello-world exchange) produces
// noise rather than useful context.
const MIN_MESSAGES_TO_SUMMARIZE = 4;

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

  // ── 2. Load persistent memory + recent session summaries (PARALLEL) ─────
  //
  // Both DB reads run concurrently via Promise.all — zero extra latency
  // compared to the previous version which only loaded memory.
  //
  const [memory, recentSummaries] = await Promise.all([
    loadMemory(userId),
    loadRecentSummaries(userId, 3),   // Phase 10: last 3 session summaries
  ]);

  const memorySection       = buildMemorySection(memory);
  const sessionHistorySection = buildSessionHistorySection(recentSummaries); // "" if no prior sessions

  // ── 3. Build userContext with memory + session history injected ──────────
  //
  // sessionHistorySection is appended to memorySection so the prompt builder
  // receives a single enriched context string. Format:
  //
  //   ## Memoria utente
  //   …facts and patterns…
  //
  //   ## Contesto sessioni recenti
  //   Sessione precedente 1:
  //     L'utente ha lavorato su…
  //     Temi: cambio carriera, ansia
  //     Tono: neutral
  //
  const userContext: UserContext & { memorySection?: string } = {
    name:        user.name,
    journeyType: user.journeyType,
    userMode:    user.userMode,
    memorySection: memorySection + sessionHistorySection,
    ...ctxOverride,
  };

  if (recentSummaries.length > 0) {
    console.log(`[chat] injected ${recentSummaries.length} session summaries for user ${userId}`);
  }

  // ── 4. SSE setup ──────────────────────────────────────────────────────────
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
      memoryFactCount: memory.facts.length,
    })) {
      if (event.type === "token") {
        assistantTokens.push(event.value);
      }
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

  // ── 5. Post-stream: save session + extract memory + summarize (non-blocking)
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
            title:          message.slice(0, 80),
            messages:       fullHistory as any,
            messageCount:   fullHistory.length,
            topics:         [],
            avgConfidence:  lastEvalResult?.score ?? null,
            evalBreakdown:  evalBreakdownIncrement,
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

          const prevBreakdown  = (existing.evalBreakdown as Record<string, number>) ?? {};
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

      // ── 5c. Phase 10 — Summarize session (fire-and-forget) ────────────────
      //
      // Only summarize once the session has enough messages to be meaningful.
      // We summarize on EVERY message update (not just session end) so that
      // even long multi-day sessions have an up-to-date summary available
      // for the NEXT conversation the user starts.
      //
      // summarizeSession() does an INSERT with ON CONFLICT DO UPDATE keyed on
      // (userId, sessionId), so calling it multiple times is safe — it simply
      // overwrites the previous summary with a fresher one.
      //
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
