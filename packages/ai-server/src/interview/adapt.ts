import { getLLM } from "../llm/client";
import { logger } from "../logger";
import { withTimeout } from "../utils";

export type DifficultyLevel = "base" | "media" | "avanzata";

export async function adaptDifficulty(
  currentDifficulty: DifficultyLevel,
  averageScore: number,
  questionsAnswered: number,
): Promise<DifficultyLevel> {
  try {
    if (questionsAnswered < 2) return currentDifficulty;

    const prompt = `Sei un selezionatore HR che adatta la difficoltà di un colloquio in base alle performance.
Lo score medio dell'utente è ${averageScore.toFixed(1)}/10 dopo ${questionsAnswered} domande.
La difficoltà attuale è "${currentDifficulty}".

Regole:
- Score medio ≥ 7.5 → aumenta difficoltà
- Score medio ≤ 4.5 → diminuisci difficoltà
- Altrimenti → mantieni

Rispondi SOLO con una parola: "base", "media" o "avanzata"`;

    const llm = getLLM();
    const response = await withTimeout(
      llm.chatOnce([{ role: "system", content: prompt }], { model: "gpt-4o-mini", temperature: 0.2, maxTokens: 10 }),
      5000,
      "interview-adapt",
    );

    const clean = response.trim().toLowerCase();
    if (clean === "base" || clean === "avanzata") return clean;
    if (averageScore >= 7.5) return escalate(currentDifficulty);
    if (averageScore <= 4.5) return deescalate(currentDifficulty);
    return currentDifficulty;
  } catch (err) {
    logger.warn({ err }, "interview-adapt failed");
    if (averageScore >= 7.5) return escalate(currentDifficulty);
    if (averageScore <= 4.5) return deescalate(currentDifficulty);
    return currentDifficulty;
  }
}

function escalate(d: DifficultyLevel): DifficultyLevel {
  if (d === "base") return "media";
  if (d === "media") return "avanzata";
  return "avanzata";
}

function deescalate(d: DifficultyLevel): DifficultyLevel {
  if (d === "avanzata") return "media";
  if (d === "media") return "base";
  return "base";
}
