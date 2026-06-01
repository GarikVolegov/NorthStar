import type { UserMemory } from "./memory-types";

export function buildMemorySection(memory: UserMemory): string {
  const hasFacts = memory.facts.length > 0;
  const hasPatterns = memory.patterns.length > 0;

  if (!hasFacts && !hasPatterns) return "";

  const lines: string[] = ["## Memoria persistente - quello che sai gia di questo utente"];
  const mainGoal = memory.facts.find((f) => f.key === "goal_main");
  const secondaryGoal = memory.facts.find((f) => f.key === "goal_secondary");
  if (mainGoal) {
    lines.push(
      "",
      `### Obiettivo principale di sessione: ${mainGoal.value}`,
      secondaryGoal ? `Obiettivo secondario: ${secondaryGoal.value}` : "",
      "Tieni la risposta allineata a questi obiettivi. Se l'utente si allontana, riconducilo gentilmente.",
    );
  }

  if (hasFacts) {
    lines.push("\n### Fatti biografici (dichiarati dall'utente in sessioni precedenti)");
    for (const fact of memory.facts) {
      lines.push(`- **${fact.key}**: ${fact.value}`);
    }
  }

  if (hasPatterns) {
    lines.push("\n### Pattern comportamentali osservati (confidence >= 0.5)");
    for (const pattern of memory.patterns) {
      const confidenceLabel =
        pattern.confidence >= 0.80 ? "alta" :
        pattern.confidence >= 0.65 ? "media" : "bassa";
      lines.push(`- [${pattern.patternType}, ${confidenceLabel} confidence] ${pattern.description}`);
    }
  }

  lines.push(
    "\nUSA questa memoria per personalizzare la risposta.",
    "Se pertinente e c'e una connessione chiara, cita 1-2 fatti della memoria dell'utente per mostrare che ricordi la sua storia.",
    "Esempi di citazione naturale: 'So che stavi lavorando su X...', 'La scorsa sessione mi dicevi che...', 'Visto che il tuo obiettivo e Y...'",
    "Non esagerare - basta 1 citazione per risposta, solo quando aggiunge valore.",
  );

  return lines.join("\n");
}
