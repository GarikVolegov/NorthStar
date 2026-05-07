/**
 * POST /api/growth-agent/chat  —  SSE streaming chat with persistent memory.
 *
 * FLOW PER REQUEST:
 *   1. Load user profile from DB
 *   2. Load persistent memory (facts + patterns) — parallel with RAG inside agent
 *   3. Pass memory to prompt builder via userContext extension
 *   4. Stream GPT-4o response token by token
 *   5. [NON-BLOCKING] After stream ends: save session + extract + merge memory
 *
 * Memory extraction is FIRE-AND-FORGET after the SSE stream closes:
 * the user doesn't wait for it.
 *
 * Body: {
 *   message: string,
 *   sessionId?: number,          // if continuing an existing session
 *   history: ChatMessage[],
 *   userContext?: Partial<UserContext>
 * }
 *
 * SSE events:
 *   { type: 'token',  value: '...' }
 *   { type: 'done',   sources: [...], memorySnapshot?: {...} }
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

  // ── 1. Load user profile ──────────────────────────────────────────────────
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) return res.status(401).json({ error: "User not found" });

  // ── 2. Load persistent memory (parallel — doesn't block stream start) ─────
  const memory = await loadMemory(userId);
  const memorySection = buildMemorySection(memory);

  // ── 3. Build userContext with memory injected ─────────────────────────────
  const userContext: UserContext & { memorySection?: string } = {
    name:        user.name,
    journeyType: user.journeyType,
    userMode:    user.userMode,
    memorySection,          // picked up by prompt-builder formatUserContext
    ...ctxOverride,
  };

  // ── 4. SSE setup ──────────────────────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: unknown) =>
    res.write(`data: ${JSON.stringify(data)}\n\n`);

  const assistantTokens: string[] = [];

  try {
    for await (const event of runGrowthAgent({
      userId,
      userContext,
      history,
      userMessage: message,
    })) {
      if (event.type === "token") {
        assistantTokens.push(event.value);
      }
      send(event);
      if (event.type === "done" || event.type === "error") break;
    }
  } catch (err) {
    send({ type: "error", message: String(err) });
  } finally {
    res.end();
  }

  // ── 5. Post-stream: save messages + extract memory (non-blocking) ─────────
  // This runs AFTER the SSE stream is closed — user doesn't wait for it.
  setImmediate(async () => {
    try {
      const assistantContent = assistantTokens.join("");
      const fullHistory: ChatMessage[] = [
        ...history,
        { role: "user",      content: message },
        { role: "assistant", content: assistantContent },
      ];

      // Determine session to update (or create new one)
      let targetSessionId = sessionId;

      if (!targetSessionId) {
        // Create new session
        const [newSession] = await db
          .insert(coachSessionsTable)
          .values({
            userId,
            title: message.slice(0, 80),
            messages: fullHistory as any,
          })
          .returning({ id: coachSessionsTable.id });
        targetSessionId = newSession.id;
      } else {
        // Append to existing session
        await db
          .update(coachSessionsTable)
          .set({
            messages: fullHistory as any,
            updatedAt: new Date(),
          })
          .where(
            eq(coachSessionsTable.id, targetSessionId),
          );
      }

      // Extract + merge memory
      const extracted = await extractMemory(fullHistory);
      if (extracted && targetSessionId) {
        await mergeMemory(userId, targetSessionId, extracted);
      }
    } catch (err) {
      console.error("[chat] post-stream memory save failed:", err);
    }
  });
});

export default router;
