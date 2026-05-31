import { getWendyCapability } from "./capability-matrix";
import { buildWendyTrainingPromptSection } from "./training-cases";
import type { WendyDecision } from "./types";

export function buildWendyIntelligenceDirectives(decision: WendyDecision): string {
  const capabilityLines = decision.requiredCapabilities
    .map((key) => `- ${getWendyCapability(key).directive}`)
    .join("\n");
  const confirmation = decision.requiresConfirmation
    ? "Se l'azione modifica dati, chiedi conferma prima di eseguirla."
    : "Se l'azione e' solo informativa o reversibile, procedi senza teatrini.";
  const safetyGuardrail = decision.requiresConfirmation
    ? "- Non dire fatto, eliminato, creato o modificato prima della conferma esplicita dell'utente."
    : "";
  const trainingSection = buildWendyTrainingPromptSection(decision);

  return [
    "## Modalita decisionale Wendy",
    `Modo: ${decision.mode}. Target latenza: ${decision.latencyTargetMs}ms. Motivo: ${decision.reason}`,
    confirmation,
    "Regole Jarvis:",
    "- Capisci il bisogno reale, non solo le parole.",
    "- Se servono dati NorthStar, mercato o profilo, usa i tool: non inventare.",
    "- Per lavori lunghi, crea o proponi task/routine invece di bloccare la chat.",
    "- Prima di chiudere, verifica che la risposta sia completa, concreta e non generica.",
    safetyGuardrail,
    capabilityLines,
    trainingSection,
  ].filter(Boolean).join("\n");
}
