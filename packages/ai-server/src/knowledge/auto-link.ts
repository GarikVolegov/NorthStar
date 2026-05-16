import { getLLM } from "../llm/client";
import { embedText } from "../growth-agent/embedder";
import { logger } from "../logger";
import { withTimeout } from "../utils";
import { selectModelFor } from "../model-router";

export interface AutoLinkSuggestion {
  targetNodeId: number;
  targetTitle: string;
  label: string;
  reason: string;
  score: number;
}

export interface KnowledgeNodeBrief {
  id: number;
  title: string;
  content: string;
  type: string;
}

export async function suggestAutoLinks(
  sourceNode: KnowledgeNodeBrief,
  candidates: KnowledgeNodeBrief[],
  topK = 5,
): Promise<AutoLinkSuggestion[]> {
  try {
    const sourceEmbedding = await embedText(`${sourceNode.title}\n${sourceNode.content}`);

    const candidateEmbeddings = await Promise.all(
      candidates.map((c) => embedText(`${c.title}\n${c.content}`)),
    );

    const scored = candidates.map((c, i) => ({
      node: c,
      similarity: cosineSimilarity(sourceEmbedding, candidateEmbeddings[i]),
    }));

    scored.sort((a, b) => b.similarity - a.similarity);
    const topCandidates = scored.slice(0, topK);

    const prompt = `Sei un assistente che analizza connessioni semantiche tra nodi di un grafo della conoscenza.
Dato un nodo sorgente e una lista di candidati, decidi se esiste una relazione significativa.
Per ogni candidato con similarità ≥ 0.50, assegna un'etichetta di relazione (es. "approfondisce", "contraddice", "esemplifica", "si basa su") e spiega brevemente perché.

Nodo sorgente: "${sourceNode.title}" — ${sourceNode.content.slice(0, 200)}

Candidati:
${topCandidates.map((c, i) => `[${i + 1}] "${c.node.title}" (score: ${c.similarity.toFixed(3)}): ${c.node.content.slice(0, 150)}`).join("\n")}

Rispondi SOLO con un array JSON degli indici dei candidati da collegare, nel formato:
[{ "index": number, "label": "relazione", "reason": "motivo" }]`;

    const llm = getLLM();
    const route = selectModelFor("knowledge-link");
    const response = await withTimeout(
      llm.chatOnce([{ role: "system", content: prompt }], { model: route.model, temperature: route.temperature, maxTokens: route.maxTokens }),
      10000,
      "auto-link",
    );

    const parsed = JSON.parse(response);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item: { index: number }) => item.index !== undefined && topCandidates[item.index])
      .map((item: { index: number; label?: string; reason?: string }) => ({
        targetNodeId: topCandidates[item.index].node.id,
        targetTitle: topCandidates[item.index].node.title,
        label: item.label ?? "collegato",
        reason: item.reason ?? "",
        score: topCandidates[item.index].similarity,
      }));
  } catch (err) {
    logger.warn({ err }, "auto-link failed");
    return [];
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
