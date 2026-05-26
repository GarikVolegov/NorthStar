import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod/v4";
import { db, sectorsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { wendyLimiter } from "../middleware/rate-limit";
import { getLLM } from "@workspace/ai-server/llm/client";
import { estimateTokens, recordLlmUsage } from "@workspace/ai-server";

const router = Router();

const analyzeSchema = z.object({
  sectorId: z.number().int().positive(),
  userSkills: z.array(z.string().max(100)).max(50).default([]),
  experienceLevel: z.enum(["junior", "mid", "senior"]).default("junior"),
});

const LEVEL_LABELS: Record<string, string> = {
  junior: "Junior (0-2 anni di esperienza)",
  mid: "Mid-level (2-5 anni di esperienza)",
  senior: "Senior (5+ anni di esperienza)",
};

router.post("/analyze", requireAuth, wendyLimiter, async (req, res) => {
  const userId = req.user!.id;
  const parsed = analyzeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi" });
    return;
  }

  const { sectorId, userSkills, experienceLevel } = parsed.data;

  const [sector] = await db
    .select()
    .from(sectorsTable)
    .where(and(eq(sectorsTable.id, sectorId), eq(sectorsTable.isActive, true)))
    .limit(1);

  if (!sector) {
    res.status(404).json({ error: "Settore non trovato" });
    return;
  }

  const sectorSkills = (sector.skills as string[] | undefined) ?? [];
  const sectorSkillsStr = sectorSkills.length > 0
    ? sectorSkills.join(", ")
    : "nessuna skill specifica documentata";

  const hasSkills = userSkills.length > 0
    ? `L'utente possiede già queste competenze: ${userSkills.join(", ")}.`
    : "L'utente non ha indicato competenze esistenti.";

  const systemPrompt = `Sei un esperto di orientamento professionale e sviluppo di carriera per il mercato italiano.
Analizza il divario di competenze (skills gap) in modo pratico, concreto e motivante.
Usa il formato Markdown con sezioni chiare. Rispondi SEMPRE in italiano.`;

  const userPrompt = `Settore: ${sector.name}
Livello target: ${LEVEL_LABELS[experienceLevel] ?? experienceLevel}
Skill richieste dal settore: ${sectorSkillsStr}
${hasSkills}

Genera un'analisi del skills gap strutturata così:
1. **Punti di forza** — skill già possedute che sono rilevanti per il settore
2. **Gap principali** — competenze mancanti più importanti da sviluppare
3. **Piano d'azione** — 3-5 passi concreti e prioritizzati per colmare il gap
4. **Risorse consigliate** — corsi, certificazioni o esperienze pratiche specifiche

Sii diretto, motivante e specifico. Evita generalità.`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const llm = getLLM();
    const promptTokens = estimateTokens(systemPrompt + userPrompt);

    const stream = await llm.chat(
      [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: userPrompt },
      ],
      { model: "google/gemini-flash-1.5", temperature: 0.4, maxTokens: 1200 },
    );

    const chunks: string[] = [];
    for await (const delta of stream) {
      chunks.push(delta);
      res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
    }

    recordLlmUsage({
      userId,
      model: "google/gemini-flash-1.5",
      promptTokens,
      completionTokens: estimateTokens(chunks.join("")),
      requestType: "skills-gap",
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log?.error({ err }, "skills-gap analyze failed");
    res.write(`data: ${JSON.stringify({ content: "\n\nErrore durante l'analisi. Riprova." })}\n\n`);
    res.end();
  }
});

export default router;
