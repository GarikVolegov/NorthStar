/**
 * POST /api/growth-agent/chat
 *
 * SSE streaming endpoint for the personal growth agent.
 *
 * Body: {
 *   message: string,
 *   history: Array<{ role: 'user'|'assistant', content: string }>,
 *   userContext?: Partial<UserContext>   // merged with DB profile
 * }
 *
 * Response: text/event-stream
 *   data: { type: 'token', value: '...' }
 *   data: { type: 'done', sources: [...] }
 *   data: { type: 'error', message: '...' }
 */
import { Router } from "express";
import {
  runGrowthAgent,
  type ChatMessage,
  type UserContext,
} from "@workspace/integrations-openai-ai-server/growth-agent";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/", async (req, res) => {
  const userId: number = (req as any).user.id;

  const { message, history = [], userContext: ctxOverride = {} } = req.body as {
    message: string;
    history: ChatMessage[];
    userContext?: Partial<UserContext>;
  };

  if (!message?.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  // Fetch user profile from DB
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) return res.status(401).json({ error: "User not found" });

  const userContext: UserContext = {
    name: user.name,
    journeyType: user.journeyType,
    userMode: user.userMode,
    ...ctxOverride,
  };

  // SSE setup
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: unknown) =>
    res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    for await (const event of runGrowthAgent({
      userId,
      userContext,
      history,
      userMessage: message,
    })) {
      send(event);
      if (event.type === "done" || event.type === "error") break;
    }
  } catch (err) {
    send({ type: "error", message: String(err) });
  } finally {
    res.end();
  }
});

export default router;
