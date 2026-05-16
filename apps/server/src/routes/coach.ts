import { Router, type Request, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { db, coachSessionsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { writeAuditLog } from "../middleware/audit";
import { wendyLimiter, wendyIpLimiter, planQuotaLimiter } from "../middleware/rate-limit";
import { costGuard } from "../middleware/cost-guard";
import { recordLlmUsage, estimateTokens, selectModel } from "@workspace/ai-server";

const router = Router();

const JWT_SECRET: string = process.env.JWT_SECRET ?? "";

const createSessionSchema = z.object({
  title: z.string().min(1).max(100).default("Nuova sessione"),
  firstMessage: z.string().min(1).max(2000).optional(),
});

const askSchema = z.object({
  message: z.string().min(1).max(5000),
});

const COACH_SYSTEM_PROMPT = `Sei Wendy, coach di crescita personale e orientamento professionale di NorthStar.
Sei empatica, diretta, competente. Rispondi sempre in italiano.
Usa un tono caldo ma concreto — mai vago o generico.
Se non sei sicura, dillo esplicitamente piuttosto che inventare.`;

// ── LIST sessions ──────────────────────────────────────────────
router.get("/sessions", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const sessions = await db
    .select({
      id: coachSessionsTable.id,
      title: coachSessionsTable.title,
      messageCount: coachSessionsTable.messages,
      createdAt: coachSessionsTable.createdAt,
      updatedAt: coachSessionsTable.updatedAt,
    })
    .from(coachSessionsTable)
    .where(eq(coachSessionsTable.userId, userId))
    .orderBy(desc(coachSessionsTable.updatedAt));

  res.json(sessions.map((s) => ({
    id: s.id,
    title: s.title,
    messageCount: (s.messageCount ?? []).length,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  })));
});

// ── CREATE session ────────────────────────────────────────────
router.post("/sessions", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const data = createSessionSchema.parse(req.body);

  const messages = data.firstMessage
    ? [{ role: "user" as const, content: data.firstMessage, createdAt: new Date().toISOString() }]
    : [];

  const [session] = await db
    .insert(coachSessionsTable)
    .values({
      userId,
      title: data.title,
      messages,
    })
    .returning();

  res.status(201).json(session);
});

// ── GET single session ────────────────────────────────────────
router.get("/sessions/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const id = parseInt(req.params.id);

  const [session] = await db
    .select()
    .from(coachSessionsTable)
    .where(and(eq(coachSessionsTable.id, id), eq(coachSessionsTable.userId, userId)))
    .limit(1);

  if (!session) {
    res.status(404).json({ error: "Sessione non trovata" });
    return;
  }

  res.json(session);
});

// ── DELETE session ────────────────────────────────────────────
router.delete("/sessions/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const id = parseInt(req.params.id);

  const [existing] = await db
    .select()
    .from(coachSessionsTable)
    .where(and(eq(coachSessionsTable.id, id), eq(coachSessionsTable.userId, userId)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Sessione non trovata" });
    return;
  }

  await db.delete(coachSessionsTable).where(eq(coachSessionsTable.id, id));
  res.status(204).send();
});

// ── ASK (SSE streaming) ──────────────────────────────────────
router.post("/sessions/:id/ask", requireAuth, costGuard, wendyLimiter, wendyIpLimiter, planQuotaLimiter, async (req, res) => {
  const userId = req.user!.id;
  const id = parseInt(req.params.id);
  const data = askSchema.parse(req.body);

  const [session] = await db
    .select()
    .from(coachSessionsTable)
    .where(and(eq(coachSessionsTable.id, id), eq(coachSessionsTable.userId, userId)))
    .limit(1);

  if (!session) {
    res.status(404).json({ error: "Sessione non trovata" });
    return;
  }

  const log = req.log;

  // ── Load memory ────────────────────────────────────────────
  let memorySection = "";
  try {
    const { loadMemory, buildMemorySection } = await import("@workspace/ai-server/growth-agent");
    const userMemory = await loadMemory(userId);
    memorySection = buildMemorySection(userMemory);
  } catch (err) {
    log.warn({ err }, "coach memory load failed");
  }

  // ── Build messages array ────────────────────────────────────
  const systemContent = memorySection
    ? `${COACH_SYSTEM_PROMPT}\n\n${memorySection}`
    : COACH_SYSTEM_PROMPT;

  const history = (session.messages ?? []).map((m: { role: string; content: string }) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  // ── SSE headers ────────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const llm = getLLM();
    const route = selectModel({
      isPremium: !!req.user?.stripeSubscriptionId,
      complexity: data.message.length > 500 ? "deep" : "standard",
    });

    const promptText = systemContent + "\n\n" + data.message;
    const promptTokens = estimateTokens(promptText);

    const stream = await llm.chat(
      [
        { role: "system" as const, content: systemContent },
        ...history.slice(-20),
        { role: "user" as const, content: data.message },
      ],
      { model: route.model, temperature: route.temperature, maxTokens: route.maxTokens },
    );

    const tokenBuffer: string[] = [];
    for await (const delta of stream) {
      tokenBuffer.push(delta);
      res.write(`data: ${JSON.stringify({ type: "token", value: delta })}\n\n`);
    }

    const fullResponse = tokenBuffer.join("");
    const completionTokens = estimateTokens(fullResponse);

    recordLlmUsage({
      userId,
      model: route.model,
      promptTokens,
      completionTokens,
      requestType: "coach_chat",
      endpoint: "coach/sessions/:id/ask",
      metadata: JSON.stringify({ sessionId: id, routeReason: route.reason }),
    }).catch((err) => log.warn({ err }, "failed to record LLM usage"));

    // ── Save messages to session ─────────────────────────────
    const updatedMessages = [
      ...(session.messages ?? []),
      { role: "user" as const, content: data.message, createdAt: new Date().toISOString() },
      { role: "assistant" as const, content: fullResponse, createdAt: new Date().toISOString() },
    ];

    await db
      .update(coachSessionsTable)
      .set({
        messages: updatedMessages,
        updatedAt: new Date(),
      })
      .where(eq(coachSessionsTable.id, id));

    // ── Auto-title: name session from first exchange ─────────
    if (history.length <= 1 && session.title === "Nuova sessione") {
      const title = data.message.slice(0, 60).trim() + (data.message.length > 60 ? "…" : "");
      await db
        .update(coachSessionsTable)
        .set({ title })
        .where(eq(coachSessionsTable.id, id));
    }

    // ── Fire-and-forget: extract + save memory ───────────────
    (async () => {
      try {
        const { extractMemory, mergeMemory } = await import("@workspace/ai-server/growth-agent");
        const { withTimeout } = await import("@workspace/ai-server/utils");
        const lastTurns = updatedMessages.slice(-8);
        const extracted = await withTimeout(
          extractMemory(lastTurns.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }))),
          5000,
          "extractMemory",
        );
        if (extracted && (extracted.facts.length > 0 || extracted.patterns.length > 0)) {
          await withTimeout(mergeMemory(userId, id, extracted), 3000, "mergeMemory");
          log.info({ facts: extracted.facts.length, patterns: extracted.patterns.length }, "coach memory saved");
        }
      } catch (err) {
        log.warn({ err }, "coach memory save failed/timed out");
      }
    })();

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  } catch (err) {
    log.error({ err }, "coach ask error");
    res.write(`data: ${JSON.stringify({ type: "error", message: "Errore durante la generazione" })}\n\n`);
    res.end();
  }
});

export default router;
