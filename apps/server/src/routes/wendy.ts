import { Router, type Request, type Response } from "express";
import { z } from "zod/v4";
import OpenAI from "openai";
import { requireAuth } from "../middleware/auth";
import { writeAuditLog } from "../middleware/audit";
import type { LoggerFields } from "@workspace/ai-server/logger";

const router = Router();

const askSchema = z.object({
  message: z.string().min(1).max(5000),
  sessionId: z.number().optional(),
});

const WENDY_SYSTEM = `Sei Wendy, coach di crescita personale e orientamento professionale di NorthStar.
Sei empatica, diretta, competente. Rispondi sempre in italiano.
Usa un tono calmo ma concreto — mai vago o generico.
Se non sei sicura, dillo esplicitamente piuttosto che inventare.

Hai accesso a una knowledge base con documenti, esempi e risorse.
Se il contesto fornito è sufficiente, usalo come base per la risposta.
Se non è sufficiente, dillo e chiedi più contesto. Non inventare informazioni.`;

function getOpenAI(): OpenAI {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) {
    throw new Error("AI_INTEGRATIONS env vars not configured");
  }
  return new OpenAI({ apiKey, baseURL });
}

router.post("/ask", requireAuth, async (req: Request, res: Response) => {
  const requestId = req.requestId;
  const userId = req.user!.id;
  const data = askSchema.parse(req.body);
  const logger = (await import("@workspace/ai-server/logger")).logger;
  const logFields: LoggerFields = { userId, requestId };

  // ── RAG retrieval ──────────────────────────────────────────
  let chunks: Array<{ content: string; source: string; score: number }> = [];
  try {
    const { retrieve } = await import("@workspace/ai-server/growth-agent");
    chunks = await retrieve(data.message, userId, {
      topK: 5,
      minScore: 0.30,
      sourceTypes: ["platform_content", "document", "persona_example"],
    });
  } catch (err) {
    logger.warn({ err, ...logFields }, "wendy RAG retrieval failed");
  }

  // ── Build context ──────────────────────────────────────────
  const contextSection = chunks.length > 0
    ? `\n\n## Contesto recuperato dalla knowledge base\n${
        chunks.map((c, i) => `[FONTE ${i + 1}] (${c.source}, score: ${c.score.toFixed(2)})\n${c.content}`).join("\n\n")
      }`
    : "";

  // ── SSE headers ────────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    // Send sources first
    res.write(`data: ${JSON.stringify({ type: "sources", chunks: chunks.map((c) => ({
      content: c.content.slice(0, 200),
      source: c.source,
      score: c.score,
    })) })}\n\n`);

    const openai = getOpenAI();
    const systemMsg = `${WENDY_SYSTEM}${contextSection}`;

    // ── Mock mode for testing ────────────────────────────────
    if (process.env.USE_MOCK_AI === "true") {
      const mockResponse = `Ciao! Ho analizzato la tua domanda.${contextSection ? "\n\nHo trovato alcuni documenti rilevanti nella knowledge base." : ""}\n\nCome posso aiutarti ulteriormente?`;
      for (const char of mockResponse) {
        res.write(`data: ${JSON.stringify({ type: "token", value: char })}\n\n`);
        await new Promise((r) => setTimeout(r, 15));
      }
      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
      return;
    }

    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: data.message },
      ],
      stream: true,
      temperature: 0.72,
      max_tokens: 600,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        res.write(`data: ${JSON.stringify({ type: "token", value: delta })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();

    writeAuditLog(req, {
      action: "agent_message",
      category: "agent_action",
      metadata: { messageLength: data.message.length, chunkCount: chunks.length },
    });
  } catch (err) {
    logger.error({ err, ...logFields }, "wendy ask error");
    res.write(`data: ${JSON.stringify({ type: "error", message: "Errore durante la generazione della risposta" })}\n\n`);
    res.end();
  }
});

const voiceSchema = z.object({
  text: z.string().min(1).max(5000),
  voice: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).optional(),
  format: z.enum(["mp3", "opus", "aac", "flac", "wav", "pcm16"]).optional(),
  instructions: z.string().max(2000).optional(),
});

router.post("/voice", requireAuth, async (req: Request, res: Response) => {
  const requestId = req.requestId;
  const data = voiceSchema.parse(req.body);
  const logger = (await import("@workspace/ai-server/logger")).logger;

  try {
    const { wendyTextToSpeech } = await import("@workspace/ai-server/audio");
    const audioBuffer = await wendyTextToSpeech(
      data.text,
      data.voice ?? "nova",
      data.format ?? "opus",
      data.instructions,
    );

    const contentType = data.format === "mp3" ? "audio/mpeg"
      : data.format === "opus" ? "audio/ogg"
      : data.format === "wav" ? "audio/wav"
      : data.format === "flac" ? "audio/flac"
      : data.format === "aac" ? "audio/aac"
      : "audio/ogg";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", audioBuffer.length.toString());
    res.send(audioBuffer);
  } catch (err) {
    logger.error({ err, requestId }, "wendy voice error");
    res.status(500).json({ error: "TTS generation failed", message: String(err) });
  }
});

export default router;
