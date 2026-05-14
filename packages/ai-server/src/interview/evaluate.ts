import { getLLM } from "../llm/client";
import { logger } from "../logger";
import { withTimeout } from "../utils";

export interface AnswerEvaluation {
  score: number;
  clarity: number;
  relevance: number;
  depth: number;
  feedback: string;
  suggestions: string[];
}

export async function evaluateAnswer(
  question: string,
  answer: string,
  difficulty: string,
  sectorName: string,
): Promise<AnswerEvaluation> {
  try {
    const prompt = `Sei un valutatore di colloqui HR specializzato in "${sectorName}".
Valuta la seguente risposta a una domanda di colloquio di difficoltà "${difficulty}".

Domanda: "${question}"
Risposta: "${answer}"

Assegna punteggi da 0 a 10 per:
- clarity: chiarezza e struttura della risposta
- relevance: pertinenza alla domanda e al settore
- depth: profondità e dettaglio della risposta

Fornisci anche un feedback costruttivo (2-3 righe) e 1-2 suggerimenti di miglioramento.

Rispondi SOLO con un oggetto JSON:
{
  "score": number (media dei 3 punteggi, 0-10),
  "clarity": number,
  "relevance": number,
  "depth": number,
  "feedback": "testo feedback",
  "suggestions": ["suggerimento 1", "suggerimento 2"]
}`;

    const llm = getLLM();
    const response = await withTimeout(
      llm.chatOnce([{ role: "system", content: prompt }], { model: "gpt-4o-mini", temperature: 0.3, maxTokens: 400 }),
      10000,
      "interview-evaluate",
    );

    const parsed = JSON.parse(response);
    return {
      score: clamp(parsed.score ?? 5, 0, 10),
      clarity: clamp(parsed.clarity ?? 5, 0, 10),
      relevance: clamp(parsed.relevance ?? 5, 0, 10),
      depth: clamp(parsed.depth ?? 5, 0, 10),
      feedback: parsed.feedback ?? "Risposta ricevuta.",
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3).map(String) : [],
    };
  } catch (err) {
    logger.warn({ err }, "interview-evaluate failed");
    return {
      score: 5,
      clarity: 5,
      relevance: 5,
      depth: 5,
      feedback: "Valutazione non disponibile. La tua risposta è stata registrata.",
      suggestions: [],
    };
  }
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
