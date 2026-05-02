import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, sectorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/roadmap/:sectorId/generate", async (req, res): Promise<void> => {
  const sectorId = parseInt(req.params.sectorId, 10);

  const [sector] = await db.select().from(sectorsTable).where(eq(sectorsTable.id, sectorId));
  if (!sector) {
    res.status(404).json({ error: "Settore non trovato" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const prompt = `Crea una roadmap professionale dettagliata per entrare nel settore "${sector.name}" in Italia partendo da zero.

Dati del settore:
- Competenze richieste: ${sector.skills.join(", ")}
- Tempo stimato per raggiungere autonomia: ${sector.timeToAutonomy}
- RAL media: €${sector.avgSalaryMin / 1000}k - €${sector.avgSalaryMax / 1000}k
- Crescita annua: +${sector.growthRate}%
- Trend di mercato: ${sector.trend}
- Vantaggi principali: ${sector.advantages.slice(0, 3).join("; ")}

Rispondi SOLO con un JSON valido e nessun testo aggiuntivo. Struttura esatta:
{
  "totalDuration": "X-Y mesi",
  "phases": [
    {
      "id": 1,
      "title": "string",
      "duration": "X-Y mesi",
      "emoji": "string (1 emoji)",
      "description": "string (2-3 frasi descrittive e concrete)",
      "actions": ["azione concreta 1", "azione concreta 2", "azione concreta 3", "azione concreta 4"],
      "resources": [
        {"type": "corso", "name": "Nome specifico", "platform": "Udemy|Coursera|YouTube|ecc"},
        {"type": "certificazione", "name": "Nome certificazione", "issuer": "Ente certificatore"},
        {"type": "libro", "name": "Titolo libro", "author": "Autore"}
      ],
      "milestone": "Risultato concreto e misurabile da raggiungere entro questa fase"
    }
  ],
  "salaryProgression": [
    {"phase": "0-6 mesi (stage/entry)", "range": "€X.000 - €X.000"},
    {"phase": "6 mesi - 2 anni (junior)", "range": "€X.000 - €X.000"},
    {"phase": "2-4 anni (mid)", "range": "€X.000 - €X.000"},
    {"phase": "4+ anni (senior)", "range": "€X.000 - €X.000"}
  ],
  "topRoles": ["Ruolo 1", "Ruolo 2", "Ruolo 3", "Ruolo 4", "Ruolo 5"],
  "keyTip": "Il consiglio più importante e specifico per avere successo in questo settore in Italia"
}

Crea 5-6 fasi logiche e progressive. Sii specifico sui nomi di corsi e certificazioni realmente esistenti.`;

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }
  } catch {
    res.write(`data: ${JSON.stringify({ error: "Errore nella generazione. Riprova." })}\n\n`);
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
