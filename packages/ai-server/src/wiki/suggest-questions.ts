import { getLLM } from "../llm/client";
import { logger } from "../logger";
import { withTimeout } from "../utils";
import { selectModelFor } from "../model-router";

export async function suggestFollowUpQuestions(
  sectorName: string,
  conversationHistory: Array<{ role: string; content: string }>,
  journeyType?: string,
): Promise<string[]> {
  try {
    const lastExchanges = conversationHistory.slice(-4).map((m) =>
      `${m.role === "user" ? "Utente" : "AI"}: ${m.content.slice(0, 300)}`
    ).join("\n");

    const prompt = `Sei un consulente di orientamento professionale specializzato in "${sectorName}".
Basandoti sulla conversazione recente, genera 3 domande di approfondimento che l'utente potrebbe voler fare.
Le domande devono essere pertinenti, utili e specifiche del settore.${journeyType ? `\nTipo di utente: ${journeyType}` : ""}

Conversazione recente:
${lastExchanges}

Rispondi SOLO con un array JSON di stringhe, esattamente 3 domande. Esempio:
["Domanda 1?", "Domanda 2?", "Domanda 3?"]`;

    const llm = getLLM();
    const route = selectModelFor("wiki-suggest");
    const response = await withTimeout(
      llm.chatOnce([{ role: "system", content: prompt }], { model: route.model, temperature: route.temperature, maxTokens: route.maxTokens }),
      8000,
      "suggest-questions",
    );

    const parsed = JSON.parse(response);
    if (Array.isArray(parsed)) return parsed.slice(0, 3).map(String);
    return [];
  } catch (err) {
    logger.warn({ err }, "suggest-questions failed");
    return [];
  }
}
