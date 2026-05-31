import type { WendyIntent } from "./types";
import { detectWendyLanguage } from "./language-detection";

const THANKS_PATTERN = /\b(grazie|thanks|thank you|gracias|merci)\b/i;
const IDENTITY_PATTERN = /\b(chi sei|cosa sai fare|che cosa sai fare|come funziona|who are you|what can you do|what do you do|how does this work|quien eres|que sabes hacer|como funciona|qui etes-vous|que savez-vous faire|comment ca marche)\b/i;
const APP_EXPLAIN_PATTERN = /\bcome funziona\b(\s*\?)?$|\b(come funziona|funziona)\b.*\b(app|northstar|piattaforma)\b|\b(app|northstar|piattaforma)\b.*\b(come funziona|funziona)\b/i;
const SOCIAL_PATTERN = /\b(ciao|hey|hei|ei|ehi|salve|buongiorno|buonasera|come stai|come va|tutto bene|ok|perfetto|va bene|hi|hello|hru|how are you|how's it going|everything good|all good|thanks|hola|que tal|como estas|todo bien|gracias|salut|ca va|tout va bien|merci)\b/i;
const SAFE_SOCIAL_FRAGMENT_PATTERN = /^(ciao|hey|hei|ei|ehi|salve|ok|perfetto|grazie|hi|hello|thanks|hola|salut|merci)[!?.\s]*$/i;
const ACK_PATTERN = /\b(ce\s+l\s*ho|ce\s+lho|ce\s+l'ho|l\s*ho\s+gi[aà]|lho\s+gi[aà]|l'ho\s+gi[aà]|gi[aà]\s+ce\s+l\s*ho|gi[aà]\s+ce\s+lho)\b/i;

function isPunctuationOnly(message: string): boolean {
  return message
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim() === "";
}

export function shouldUseImmediateFastPathFallback(input: {
  intent: WendyIntent;
  message: string;
}): boolean {
  const message = input.message.trim();
  if (input.intent !== "simple_qa") {
    return APP_EXPLAIN_PATTERN.test(message) || ACK_PATTERN.test(message) || SAFE_SOCIAL_FRAGMENT_PATTERN.test(message);
  }
  if (message.length > 90) return false;
  if (isPunctuationOnly(message)) return true;
  return SOCIAL_PATTERN.test(message) || THANKS_PATTERN.test(message) || IDENTITY_PATTERN.test(message) || ACK_PATTERN.test(message);
}

export function getFastPathFallbackReply(input: {
  intent: WendyIntent;
  message: string;
  locale?: string;
}): string | null {
  const message = input.message.trim();
  if (
    input.intent !== "simple_qa" &&
    !APP_EXPLAIN_PATTERN.test(message) &&
    !ACK_PATTERN.test(message) &&
    !SAFE_SOCIAL_FRAGMENT_PATTERN.test(message)
  ) return null;
  const locale = detectWendyLanguage({ requestedLocale: input.locale, message });
  const isItalian = locale === "it";

  if (locale === "en" && !isItalian) {
    if (THANKS_PATTERN.test(message)) return "You are welcome. I am here when you want to continue.";
    if (IDENTITY_PATTERN.test(message)) {
      return "I am Wendy, your NorthStar guide. I can help you understand paths, objectives, sectors, roles, and next steps inside the platform.";
    }
    return "Hi, I am here. I am doing fine and ready to help: tell me where you want to start.";
  }

  if (locale === "es") {
    if (THANKS_PATTERN.test(message)) return "De nada. Estoy aqui cuando quieras continuar.";
    if (IDENTITY_PATTERN.test(message)) {
      return "Soy Wendy, tu guia de NorthStar. Puedo ayudarte con rutas, objetivos, sectores, roles y proximos pasos dentro de la plataforma.";
    }
    return "Hola, estoy aqui. Estoy bien y lista para ayudarte: dime por donde quieres empezar.";
  }

  if (locale === "fr") {
    if (THANKS_PATTERN.test(message)) return "Avec plaisir. Je suis la quand tu veux continuer.";
    if (IDENTITY_PATTERN.test(message)) {
      return "Je suis Wendy, ton guide NorthStar. Je peux t'aider avec les parcours, objectifs, secteurs, roles et prochaines etapes dans la plateforme.";
    }
    return "Salut, je suis la. Je vais bien et je peux t'aider: dis-moi par ou tu veux commencer.";
  }

  if (THANKS_PATTERN.test(message)) return "Figurati. Sono qui quando vuoi continuare.";
  if (ACK_PATTERN.test(message)) {
    return "Perfetto, allora lo considero gia fatto. Dimmi cosa vuoi fare adesso e parto da quello, senza farti ripetere tutto.";
  }
  if (APP_EXPLAIN_PATTERN.test(message)) {
    return [
      "NorthStar funziona come una bussola personale: parti dal test, ottieni un profilo iniziale e poi esplori settori, ruoli e percorsi compatibili con te.",
      "Da li puoi salvare obiettivi, confrontare alternative, seguire i progressi e chiedere a Wendy di trasformare i dati in una prossima azione concreta.",
    ].join(" ");
  }
  if (IDENTITY_PATTERN.test(message)) {
    return "Sono Wendy, la tua guida NorthStar. Ti aiuto a capire percorsi, obiettivi, settori, ruoli e prossimi passi dentro la piattaforma.";
  }
  return "Ciao, ci sono. Sto bene e sono pronta ad aiutarti: dimmi pure da dove vuoi partire.";
}

function normalizeForRecovery(message: string): string {
  return message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isItalianQuickAction(message: string): boolean {
  const normalized = normalizeForRecovery(message);
  return /\b(cosa|dovrei|fare|oggi|analizza|profilo|prossima|mossa|quali|settori|adatti|progressi|obiettivi)\b/.test(normalized);
}

export function shouldUseImmediateWendyRecoveryFallback(input: {
  intent: WendyIntent;
  message: string;
  llmConfigured?: boolean | undefined;
}): boolean {
  if (input.llmConfigured) return false;
  const normalized = normalizeForRecovery(input.message);
  if (normalized.length > 80) return false;
  if (input.intent === "deep_analysis" && /\banalizza\b.*\bprogress/.test(normalized)) {
    return true;
  }
  if (
    (input.intent === "conversation" || input.intent === "deep_analysis") &&
    normalized.includes("settori") &&
    /\badatt/.test(normalized)
  ) {
    return true;
  }
  if (
    (input.intent === "conversation" || input.intent === "deep_analysis") &&
    normalized.includes("profilo") &&
    (normalized.includes("prossima mossa") || normalized.includes("analizza"))
  ) {
    return true;
  }
  if (
    (input.intent === "conversation" || input.intent === "planning") &&
    /\bcosa\b.*\bfare\b.*\boggi\b/.test(normalized)
  ) {
    return true;
  }
  return false;
}

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
 * Last-resort local reply for recoverable Wendy runtime failures. It is used
 * only after routing has understood the user's intent but tools/model/context
 * fail or time out, so the UI still receives a normal token + done sequence.
 */
export function getWendyRecoveryFallbackReply(input: {
  intent: WendyIntent;
  message: string;
  locale?: string;
}): string {
  const normalized = normalizeForRecovery(input.message);
  const locale = detectWendyLanguage({ requestedLocale: input.locale, message: input.message });
  const isItalian = locale === "it" || isItalianQuickAction(input.message);

  if (isItalian && normalized.includes("progress")) {
    return [
      "Posso aiutarti ad analizzare i tuoi progressi. In questo momento uso una lettura rapida: controlla obiettivi completati, obiettivi in ritardo e l'ultima prossima azione utile.",
      "Partirei da tre domande: cosa hai completato questa settimana, cosa e rimasto bloccato, e quale obiettivo ha piu impatto sul tuo percorso.",
    ].join(" ");
  }

  if (isItalian && normalized.includes("profilo")) {
    return [
      "La prossima mossa migliore e trasformare il profilo in una decisione piccola ma verificabile.",
      "Guarda tre segnali: interessi ricorrenti, competenze gia spendibili e vincoli reali di tempo. Poi scegli un settore da esplorare per 30 minuti e un obiettivo pratico da aggiornare oggi.",
    ].join(" ");
  }

  if (isItalian && normalized.includes("settori")) {
    return [
      "Per scegliere i settori piu adatti partirei dal fit, non dalla moda del momento.",
      "Guarda prima aree coerenti con il tuo profilo, poi filtra per modalita di lavoro, compenso indicativo e impatto AI. Se non hai ancora un test recente, fai il test: rende il ranking molto piu personale.",
    ].join(" ");
  }

  if (isItalian && (normalized.includes("oggi") || normalized.includes("fare"))) {
    return [
      "Per oggi sceglierei una sola prossima azione concreta: aggiorna un obiettivo, completa un passo breve del percorso e poi chiedimi di ricalibrare la priorita.",
      "Se vuoi essere pratico: 25 minuti su un task importante, 5 minuti per segnare il progresso, poi una decisione su cosa rimandare.",
    ].join(" ");
  }

  if (locale === "en") {
    return "I can still help with a safe quick answer. Pick one concrete next step, check what changed in your objectives, and ask me again for a deeper analysis in a moment.";
  }
  if (locale === "es") {
    return "Puedo darte una respuesta rapida y segura: elige una accion concreta, revisa que cambio en tus objetivos y vuelve a pedirme un analisis mas profundo en un momento.";
  }
  if (locale === "fr") {
    return "Je peux quand meme t'aider avec une reponse rapide: choisis une action concrete, verifie ce qui a avance dans tes objectifs, puis redemande-moi une analyse plus profonde dans un instant.";
  }

  return "Ci sono. Posso darti una risposta rapida e sicura: scegli una prossima azione concreta, aggiorna i tuoi obiettivi e poi richiedimi l'analisi completa tra poco.";
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
