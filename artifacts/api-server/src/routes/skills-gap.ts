import { Router } from "express";
import { db, sectorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { optionalAuthMiddleware } from "../lib/auth-jwt.js";
import { aiGenerationRateLimiter } from "../lib/rate-limiter.js";
import { getPrompt, fillTemplate } from "../lib/prompt-store.js";
import { ai } from "../lib/ai/index.js";

const router = Router();

router.post("/skills-gap/analyze", optionalAuthMiddleware, aiGenerationRateLimiter, async (req, res): Promise<void> => {
  const { sectorId, userSkills = [], experienceLevel = "junior" } = req.body as {
    sectorId: number;
    userSkills: string[];
    experienceLevel: "junior" | "mid" | "senior";
  };

  if (!sectorId) { res.status(400).json({ error: "sectorId obbligatorio" }); return; }

  const [sector] = await db.select().from(sectorsTable).where(eq(sectorsTable.id, sectorId));
  if (!sector) { res.status(404).json({ error: "Settore non trovato" }); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const template = await getPrompt("skills-gap.prompt");
  const prompt = fillTemplate(template, {
    SECTOR_NAME: sector.name,
    SECTOR_SKILLS: (sector.skills as string[]).join(", "),
    EXPERIENCE_LEVEL: experienceLevel,
    USER_SKILLS: userSkills.length > 0 ? userSkills.join(", ") : "Nessuna competenza dichiarata",
  });

  try {
    for await (const chunk of ai.streamChat({
      useCase: "streaming_chat",
      messages: [{ role: "user", content: prompt }],
      maxTokens: 2048,
    })) {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Errore AI";
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
