import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, sectorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { optionalAuthMiddleware } from "../lib/auth-jwt.js";
import { aiChatRateLimiter } from "../lib/rate-limiter.js";
import { getPrompt, fillTemplate } from "../lib/prompt-store.js";
import { rejectIfOpenAINotConfigured, openAIErrorMessage } from "../lib/openai-availability.js";

const router = Router();

router.post("/wiki/:sectorId/ask", optionalAuthMiddleware, aiChatRateLimiter, async (req, res): Promise<void> => {
  const sectorId = parseInt(req.params.sectorId, 10);
  const { question, history = [] } = req.body as {
    question: string;
    history: Array<{ role: string; content: string }>;
  };

  if (!question || !sectorId) {
    res.status(400).json({ error: "sectorId e question sono obbligatori" });
    return;
  }

  const [sector] = await db.select().from(sectorsTable).where(eq(sectorsTable.id, sectorId));
  if (!sector) {
    res.status(404).json({ error: "Settore non trovato" });
    return;
  }

  if (rejectIfOpenAINotConfigured(res)) return;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sectorContext = `Contesto del settore:
- Descrizione: ${sector.description}
- Competenze richieste: ${(sector.skills as string[]).join(", ")}
- RAL media: €${sector.avgSalaryMin / 1000}k - €${sector.avgSalaryMax / 1000}k
- Crescita annua: +${sector.growthRate}%
- Rischio automazione: ${sector.automationRisk}
- Tendenza di mercato: ${sector.trend}
- Tempo stimato per autonomia: ${sector.timeToAutonomy}`;

  const template = await getPrompt("wiki.system");
  const systemPrompt = fillTemplate(template, {
    SECTOR_NAME: sector.name,
    SECTOR_CONTEXT: sectorContext,
  });

  try {
    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.slice(-10).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: question },
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
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: openAIErrorMessage(err) })}\n\n`);
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
