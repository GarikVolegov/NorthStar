import { getLLM } from "../llm/client";
import { logger } from "../logger";
import { withTimeout } from "../utils";

const VALID_TYPES = [
  "document",
  "persona_example",
  "user_note",
  "web",
  "platform_content",
];

const TYPE_HINTS = `- "document": PDF, articolo, paper, libro, report
- "persona_example": esempio personale, esperienza, caso studio
- "user_note": appunto personale, idea, riflessione
- "web": contenuto da sito web, blog, news
- "platform_content": contenuto generato dalla piattaforma`;

export async function autoCategorize(title: string, content: string): Promise<string> {
  try {
    const llm = getLLM();
    const prompt = `Classifica il seguente contenuto in uno di questi tipi:
${TYPE_HINTS}

Titolo: "${title}"
Contenuto: "${content.slice(0, 500)}"

Rispondi SOLO con il nome del tipo, senza spiegazioni o punteggiatura.`;

    const response = await withTimeout(
      llm.chatOnce([{ role: "system", content: prompt }], { model: "gpt-4o-mini", temperature: 0.1, maxTokens: 20 }),
      5000,
      "auto-categorize",
    );

    const clean = response.trim().toLowerCase();
    if (VALID_TYPES.includes(clean)) return clean;
    return "user_note";
  } catch (err) {
    logger.warn({ err }, "auto-categorize failed");
    return "user_note";
  }
}
