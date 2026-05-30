import type { WendyIntent } from "./types";

const THANKS_PATTERN = /\b(grazie|thanks|thank you|gracias|merci)\b/i;
const IDENTITY_PATTERN = /\b(chi sei|cosa sai fare|che cosa sai fare|come funziona|who are you|what can you do|what do you do|how does this work|quien eres|que sabes hacer|como funciona|qui etes-vous|que savez-vous faire|comment ca marche)\b/i;
const SOCIAL_PATTERN = /\b(ciao|hey|hei|ehi|salve|buongiorno|buonasera|come stai|come va|tutto bene|ok|perfetto|va bene|hi|hello|hru|how are you|how's it going|everything good|all good|thanks|hola|que tal|como estas|todo bien|gracias|salut|ca va|tout va bien|merci)\b/i;

function isPunctuationOnly(message: string): boolean {
  return message
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim() === "";
}

export function shouldUseImmediateFastPathFallback(input: {
  intent: WendyIntent;
  message: string;
}): boolean {
  if (input.intent !== "simple_qa") return false;
  const message = input.message.trim();
  if (message.length > 90) return false;
  if (isPunctuationOnly(message)) return true;
  return SOCIAL_PATTERN.test(message) || THANKS_PATTERN.test(message) || IDENTITY_PATTERN.test(message);
}

export function getFastPathFallbackReply(input: {
  intent: WendyIntent;
  message: string;
  locale?: string;
}): string | null {
  if (input.intent !== "simple_qa") return null;

  const message = input.message.trim();
  const locale = input.locale?.toLowerCase() ?? "";

  if (locale.startsWith("en")) {
    if (THANKS_PATTERN.test(message)) return "You are welcome. I am here when you want to continue.";
    if (IDENTITY_PATTERN.test(message)) {
      return "I am Wendy, your NorthStar guide. I can help you understand paths, objectives, sectors, roles, and next steps inside the platform.";
    }
    return "Hi, I am here. I am doing fine and ready to help: tell me where you want to start.";
  }

  if (locale.startsWith("es")) {
    if (THANKS_PATTERN.test(message)) return "De nada. Estoy aqui cuando quieras continuar.";
    if (IDENTITY_PATTERN.test(message)) {
      return "Soy Wendy, tu guia de NorthStar. Puedo ayudarte con rutas, objetivos, sectores, roles y proximos pasos dentro de la plataforma.";
    }
    return "Hola, estoy aqui. Estoy bien y lista para ayudarte: dime por donde quieres empezar.";
  }

  if (locale.startsWith("fr")) {
    if (THANKS_PATTERN.test(message)) return "Avec plaisir. Je suis la quand tu veux continuer.";
    if (IDENTITY_PATTERN.test(message)) {
      return "Je suis Wendy, ton guide NorthStar. Je peux t'aider avec les parcours, objectifs, secteurs, roles et prochaines etapes dans la plateforme.";
    }
    return "Salut, je suis la. Je vais bien et je peux t'aider: dis-moi par ou tu veux commencer.";
  }

  if (THANKS_PATTERN.test(message)) return "Figurati. Sono qui quando vuoi continuare.";
  if (IDENTITY_PATTERN.test(message)) {
    return "Sono Wendy, la tua guida NorthStar. Ti aiuto a capire percorsi, obiettivi, settori, ruoli e prossimi passi dentro la piattaforma.";
  }
  return "Ciao, ci sono. Sto bene e sono pronta ad aiutarti: dimmi pure da dove vuoi partire.";
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
