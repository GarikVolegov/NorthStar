import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, sectorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { optionalAuthMiddleware } from "../lib/auth-jwt.js";
import { aiChatRateLimiter } from "../lib/rate-limiter.js";
import { getPrompt, fillTemplate } from "../lib/prompt-store.js";

const router = Router();

router.post("/interview/:sectorId/ask", optionalAuthMiddleware, aiChatRateLimiter, async (req, res): Promise<void> => {
  const sectorId = parseInt(req.params.sectorId, 10);
  const { message, history = [], phase = "question" } = req.body as {
    message: string;
    history: Array<{ role: string; content: string }>;
    phase: "question" | "evaluate" | "final";
  };

  if (!sectorId || !message) {
    res.status(400).json({ error: "sectorId e message sono obbligatori" });
    return;
  }

  const [sector] = await db.select().from(sectorsTable).where(eq(sectorsTable.id, sectorId));
  if (!sector) { res.status(404).json({ error: "Settore non trovato" }); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const template = await getPrompt("interview.system");
  const systemPrompt = fillTemplate(template, {
    SECTOR_NAME: sector.name,
    SECTOR_SKILLS: (sector.skills as string[]).slice(0, 6).join(", "),
    SALARY_RANGE: `€${sector.avgSalaryMin / 1000}k–€${sector.avgSalaryMax / 1000}k RAL`,
  });

  try {
    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.slice(-12).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: message },
    ];

    const stream = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_tokens: 1024,
      messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
  } catch {
    res.write(`data: ${JSON.stringify({ error: "Errore AI. Riprova." })}\n\n`);
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
