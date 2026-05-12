/**
 * Wendy RAG endpoint — POST /api/wendy/ask
 *
 * Accepts a user message, retrieves relevant context from knowledge_nodes,
 * and streams an AI response via SSE.
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod/v4";
import OpenAI from "openai";
import { requireAuth } from "../middleware/auth";

const router = Router();

const askSchema = z.object({
  message: z.string().min(1).max(5000),
  sessionId: z.number().optional(),
});

const WENDY_SYSTEM = `Sei Wendy, coach di crescita personale e orientamento professionale di NorthStar.
Sei empatica, diretta, competente. Rispondi sempre in italiano.
Usa un tono caldo ma concreto — mai vago o generico.
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
  const userId = req.user!.id;
  const data = askSchema.parse(req.body);

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
    console.warn("[wendy] RAG retrieval failed:", err);
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
  } catch (err) {
    console.error("[wendy] ask error:", err);
    res.write(`data: ${JSON.stringify({ type: "error", message: "Errore durante la generazione della risposta" })}\n\n`);
    res.end();
  }
});

export default router;
