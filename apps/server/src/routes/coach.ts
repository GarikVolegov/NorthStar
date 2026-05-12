import { Router, type Request, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { db, coachSessionsTable } from "@workspace/db";
import OpenAI from "openai";
import { requireAuth } from "../middleware/auth";

const router = Router();

const JWT_SECRET: string = process.env.JWT_SECRET ?? "";

function getOpenAI(): OpenAI {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) {
    throw new Error("AI_INTEGRATIONS env vars not configured");
  }
  return new OpenAI({ apiKey, baseURL });
}

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
router.post("/sessions/:id/ask", requireAuth, async (req, res) => {
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

  // ── Load memory ────────────────────────────────────────────
  let memorySection = "";
  try {
    const { loadMemory, buildMemorySection } = await import("@workspace/ai-server/growth-agent");
    const userMemory = await loadMemory(userId);
    memorySection = buildMemorySection(userMemory);
  } catch (err) {
    console.warn("[coach] memory load failed:", err);
  }

  // ── Build messages array ────────────────────────────────────
  const systemContent = memorySection
    ? `${COACH_SYSTEM_PROMPT}\n\n${memorySection}`
    : COACH_SYSTEM_PROMPT;

  const history = (session.messages ?? []).map((m: { role: string; content: string }) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemContent },
    ...history.slice(-20),
    { role: "user", content: data.message },
  ];

  // ── SSE headers ────────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const openai = getOpenAI();
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: openaiMessages,
      stream: true,
      temperature: 0.72,
      max_tokens: 800,
    });

    const tokenBuffer: string[] = [];
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        tokenBuffer.push(delta);
        res.write(`data: ${JSON.stringify({ type: "token", value: delta })}\n\n`);
      }
    }

    const fullResponse = tokenBuffer.join("");

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
        const lastTurns = updatedMessages.slice(-8);
        const extracted = await extractMemory(
          lastTurns.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }))
        );
        if (extracted && (extracted.facts.length > 0 || extracted.patterns.length > 0)) {
          await mergeMemory(userId, id, extracted);
          console.log(`[coach] memory saved: ${extracted.facts.length} facts + ${extracted.patterns.length} patterns`);
        }
      } catch (err) {
        console.warn("[coach] memory save failed:", err);
      }
    })();

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  } catch (err) {
    console.error("[coach] ask error:", err);
    res.write(`data: ${JSON.stringify({ type: "error", message: "Errore durante la generazione" })}\n\n`);
    res.end();
  }
});

export default router;
