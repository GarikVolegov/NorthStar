import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, sectorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { optionalAuthMiddleware } from "../lib/auth-jwt.js";
import { aiGenerationRateLimiter } from "../lib/rate-limiter.js";

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
  res.flushHeaders();

  const prompt = `Sei un career coach esperto nel settore "${sector.name}" in Italia.

SETTORE TARGET: ${sector.name}
Competenze richieste dal settore: ${(sector.skills as string[]).join(", ")}
Livello esperienza target dell'utente: ${experienceLevel}

COMPETENZE ATTUALI DICHIARATE DALL'UTENTE:
${userSkills.length > 0 ? userSkills.join(", ") : "Nessuna competenza dichiarata"}

Genera un'analisi del gap di competenze DETTAGLIATA e PRATICA con questo formato in markdown:

## 🎯 Indice di Readiness: X/100
[breve frase motivazionale basata sul punteggio]

## ✅ Competenze già acquisite
[elenco puntato delle competenze utente già allineate al settore, con una nota su come valorizzarle]

## 🚨 Gap Critici (priorità alta)
[2-4 competenze fondamentali mancanti. Per ognuna: nome, perché è cruciale, risorsa specifica per apprenderla in Italia (corso, certificazione, piattaforma)]

## 📈 Gap Secondari (priorità media)
[2-3 competenze utili ma non bloccanti. Stessa struttura sopra]

## 🗺️ Piano d'azione a 6 mesi
[3-5 step concreti con timeline e azioni specifiche]

## 💡 Consiglio del career coach
[1 paragrafo di insight personale specifico per questo settore nel mercato italiano]

Rispondi solo in italiano. Sii specifico e pratico, non generico.`;

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
  } catch {
    res.write(`data: ${JSON.stringify({ error: "Errore analisi. Riprova." })}\n\n`);
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
