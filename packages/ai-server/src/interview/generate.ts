import { getLLM } from "../llm/client";
import { logger } from "../logger";
import { withTimeout } from "../utils";
import { selectModelFor } from "../model-router";

export interface InterviewQuestion {
  question: string;
  difficulty: "base" | "media" | "avanzata";
  focus: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readDifficulty(value: unknown): InterviewQuestion["difficulty"] {
  return value === "base" || value === "media" || value === "avanzata"
    ? value
    : "media";
}

export async function generateQuestions(
  sectorName: string,
  cvText?: string,
  count = 3,
): Promise<InterviewQuestion[]> {
  try {
    const cvSection = cvText
      ? `\nCV dell'utente:\n${cvText.slice(0, 800)}`
      : "";

    const prompt = `Sei un selezionatore HR specializzato nel settore "${sectorName}".
Genera ${count} domande per un colloquio tecnico-comportamentale.
Le domande devono essere realistiche, mirate a valutare competenze specifiche del settore.${cvSection}

Per ogni domanda specifica:
- difficulty: "base" (concetti fondamentali), "media" (esperienza pratica), "avanzata" (problem solving complesso)
- focus: l'area specifica che la domanda valuta

Rispondi SOLO con un array JSON nel formato:
[{ "question": "testo domanda", "difficulty": "base|media|avanzata", "focus": "area valutata" }]`;

    const llm = getLLM();
    const route = selectModelFor("interview-generate");
    const response = await withTimeout(
      llm.chatOnce([{ role: "system", content: prompt }], { model: route.model, temperature: route.temperature, maxTokens: route.maxTokens }),
      10000,
      "interview-generate",
    );

    const parsed = JSON.parse(response) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, count).map((item) => {
      const record = isRecord(item) ? item : {};
      return {
        question: typeof record.question === "string" ? record.question : "Parlami della tua esperienza.",
        difficulty: readDifficulty(record.difficulty),
        focus: typeof record.focus === "string" ? record.focus : "Esperienza generale",
      };
    });
  } catch (err) {
    logger.warn({ err }, "interview-generate failed");
    return generateFallbackQuestions(sectorName, count);
  }
}

function generateFallbackQuestions(sector: string, count: number): InterviewQuestion[] {
  const fallbacks: InterviewQuestion[] = [
    { question: `Parlami della tua esperienza nel settore ${sector}.`, difficulty: "base", focus: "Esperienza" },
    { question: `Quali competenze ritieni fondamentali per lavorare in ${sector}?`, difficulty: "media", focus: "Competenze" },
    { question: "Descrivi una situazione difficile che hai affrontato e come l'hai risolta.", difficulty: "media", focus: "Problem solving" },
    { question: "Come ti tieni aggiornato sulle novità del settore?", difficulty: "base", focus: "Aggiornamento" },
    { question: "Dove ti vedi tra 5 anni?", difficulty: "base", focus: "Obiettivi" },
  ];
  return fallbacks.slice(0, count);
}
