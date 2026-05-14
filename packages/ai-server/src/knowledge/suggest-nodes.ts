import { getLLM } from "../llm/client";
import { logger } from "../logger";
import { withTimeout } from "../utils";

export interface NodeSuggestion {
  title: string;
  type: string;
  reason: string;
}

export async function suggestMissingNodes(
  existingNodes: Array<{ title: string; type: string; content: string }>,
  sectorName?: string,
  journeyType?: string,
  cvText?: string,
): Promise<NodeSuggestion[]> {
  try {
    const contextParts: string[] = [];
    if (sectorName) contextParts.push(`Settore di interesse: ${sectorName}`);
    if (journeyType) contextParts.push(`Tipo di percorso: ${journeyType}`);
    if (cvText) contextParts.push(`CV: ${cvText.slice(0, 500)}`);
    const contextStr = contextParts.length > 0 ? `\nContesto utente:\n${contextParts.join("\n")}` : "";

    const existingStr = existingNodes.length > 0
      ? `\nNodi esistenti:\n${existingNodes.map((n) => `- "${n.title}" (${n.type})`).join("\n")}`
      : "";

    const prompt = `Sei un consulente AI che analizza un grafo della conoscenza personale.
Dati i nodi esistenti e il profilo utente, suggerisci nuovi nodi che potrebbero essere utili.
I nodi possono essere di tipo: document, user_note, web, platform_content.${contextStr}${existingStr}

Suggerisci massimo 3 nodi mancanti, scegli quelli più importanti.
Rispondi SOLO con un array JSON nel formato:
[{ "title": "Titolo nodo", "type": "tipo", "reason": "Perché sarebbe utile" }]`;

    const llm = getLLM();
    const response = await withTimeout(
      llm.chatOnce([{ role: "system", content: prompt }], { model: "gpt-4o-mini", temperature: 0.5, maxTokens: 400 }),
      10000,
      "suggest-nodes",
    );

    const parsed = JSON.parse(response);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 3).map((item: { title?: string; type?: string; reason?: string }) => ({
      title: item.title ?? "Nuovo nodo",
      type: item.type ?? "user_note",
      reason: item.reason ?? "",
    }));
  } catch (err) {
    logger.warn({ err }, "suggest-nodes failed");
    return [];
  }
}
