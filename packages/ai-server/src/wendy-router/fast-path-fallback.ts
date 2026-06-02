import type { WendyIntent } from "./types";
import { detectWendyLanguage } from "./language-detection";

function normalizeForRecovery(message: string): string {
  return message
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Indica se un messaggio è una quick action data-dipendente che conviene far
 * passare dalla pipeline leggera LLM+tool (non da una risposta prescritta):
 * l'LLM legge i dati reali (obiettivi, profilo, settori) e ragiona sopra.
 */
export function shouldUseWendyQuickActionFastPath(input: {
  intent: WendyIntent;
  message: string;
}): boolean {
  const normalized = normalizeForRecovery(input.message);
  if (normalized.length > 80) return false;
  if (input.intent === "planning" && /\bcosa\b.*\bfare\b.*\boggi\b/.test(normalized)) {
    return true;
  }
  if (
    input.intent === "deep_analysis" &&
    normalized.includes("profilo") &&
    (normalized.includes("prossima mossa") || normalized.includes("analizza"))
  ) {
    return true;
  }
  if (
    (input.intent === "conversation" || input.intent === "deep_analysis") &&
    normalized.includes("settori") &&
    /\badatt/.test(normalized)
  ) {
    return true;
  }
  if (input.intent === "deep_analysis" && /\banalizza\b.*\bprogress/.test(normalized)) {
    return true;
  }
  return false;
}

/**
 * Messaggio onesto e operativo usato SOLO quando il modello/tool/contesto
 * fallisce o va in timeout dopo che il routing ha già capito l'intento. Non è
 * una risposta prescritta: non finge di ragionare né dà consigli inventati,
 * dichiara il problema tecnico e invita a riprovare, così la UI riceve comunque
 * una sequenza token + done coerente.
 */
export function getWendyRecoveryFallbackReply(input: {
  intent: WendyIntent;
  message: string;
  locale?: string;
}): string {
  const locale = detectWendyLanguage({ requestedLocale: input.locale, message: input.message });

  if (locale === "en") {
    return "Sorry — I hit a technical issue while putting this answer together. Try again in a moment and I'll pick it right back up.";
  }
  if (locale === "es") {
    return "Perdona — tuve un problema técnico al preparar la respuesta. Inténtalo de nuevo en un momento y sigo desde aquí.";
  }
  if (locale === "fr") {
    return "Désolée — j'ai eu un souci technique en préparant la réponse. Réessaie dans un instant et je reprends tout de suite.";
  }
  return "Scusa — ho avuto un problema tecnico nel completare la risposta. Riprova tra un istante e riparto subito da qui.";
}

/**
 * Friendly, localized message shown when no chat LLM provider is configured,
 * so substantive questions degrade gracefully instead of surfacing a raw
 * "Wendy si è interrotta" error.
 */
export function getLlmUnavailableReply(locale?: string): string {
  const l = locale?.toLowerCase() ?? "";
  if (l.startsWith("en")) {
    return "I can't generate a full answer right now — the AI model isn't configured on this environment yet. Greetings and basic guidance still work; full answers will activate once an LLM API key is added.";
  }
  if (l.startsWith("es")) {
    return "Ahora mismo no puedo generar una respuesta completa: el modelo de IA aún no está configurado en este entorno. Los saludos y la orientación básica funcionan; las respuestas completas se activarán al añadir una clave de API del LLM.";
  }
  if (l.startsWith("fr")) {
    return "Je ne peux pas générer de réponse complète pour l'instant : le modèle d'IA n'est pas encore configuré sur cet environnement. Les salutations et l'aide de base fonctionnent ; les réponses complètes s'activeront dès qu'une clé d'API LLM sera ajoutée.";
  }
  return "Al momento non posso generare una risposta completa: il modello AI non è ancora configurato su questo ambiente. Saluti e indicazioni di base funzionano; le risposte complete si attiveranno appena viene aggiunta una API key del modello.";
}
