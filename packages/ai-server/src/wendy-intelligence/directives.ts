import { getWendyCapability } from "./capability-matrix";
import { buildWendyTrainingPromptSection } from "./training-evaluator";
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
    "## Protocollo ragionamento adattivo",
    `Profondita: ${decision.reasoningDepth}. Strategia dati: ${decision.dataStrategy}. Esecuzione: ${decision.executionMode}.`,
    `Verifica finale: ${decision.selfCheck.join(", ")}.`,
    "- instant: rispondi subito, naturale, senza tool inutili.",
    "- grounded: usa dati/profilo/fonti prima di consigliare; se non ci sono dati, dichiaralo.",
    "- deliberate: non bloccare la chat; prepara task, routine o handoff con risultato atteso.",
    "Formato operativo obbligatorio:",
    "- Soluzione operativa: scegli una direzione concreta e spiegala in breve, non limitarti a elencare possibilita.",
    "- Azione implementabile: quando possibile prepara l'azione NorthStar successiva (obiettivo, confronto, routine, aggiornamento, memoria) e chiedi conferma solo se modifica dati.",
    "- input pronto: chiudi con il prossimo comando che l'utente puo cliccare o confermare per procedere.",
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
