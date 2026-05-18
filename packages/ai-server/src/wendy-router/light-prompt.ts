/**
 * light-prompt.ts — system prompt ultra-compatto per navigation e simple_qa.
 *
 * Budget: ≤ 200 token. Nessun contesto utente elaborato, nessuna memoria.
 * Solo il ruolo di Wendy, la lingua, e le istruzioni minime per l'intent.
 */
import type { WendyIntent, WendyPageContext } from "./types";
import { buildWendyVoiceContract } from "../wendy-voice";

const ROLE_BASE = (locale: string) =>
  `Sei Wendy, l'assistente AI di NorthStar, la piattaforma italiana per la crescita professionale. Rispondi SEMPRE in: ${locale}. Sii conciso e utile.\n\n${buildWendyVoiceContract({ compact: true })}`;

const INTENT_INSTRUCTIONS: Record<"navigation" | "simple_qa", string> = {
  navigation: `Il tuo unico compito è determinare quale azione di navigazione compiere. Usa il tool "navigate" o "filter_list". Non generare testo — solo la tool call JSON.`,
  simple_qa:  `Rispondi in 1-3 frasi, con ritmo parlato. Se hai bisogno di dati strutturati (settore, professione), usa il tool corrispondente. Non inventare numeri o statistiche. Per domande su trend di mercato, ruoli emergenti o statistiche di crescita usa search_rag. Se non ottieni dati, dì in modo breve che non hai dati sufficienti invece di inventare.`,
};

export function buildLightPrompt(params: {
  locale:      string;
  intent:      WendyIntent;
  pageContext?: WendyPageContext;
}): string {
  const { locale, intent, pageContext } = params;

  const base = ROLE_BASE(locale);
  const instructions = INTENT_INSTRUCTIONS[intent as "navigation" | "simple_qa"] ?? "";
  const quickIdentityHint = intent === "simple_qa"
    ? "\nPer saluti o domande tipo 'chi sei' / 'cosa sai fare', rispondi in 1-3 frasi: presentati come Wendy e dai 2 esempi concreti di aiuto nell'app."
    : "";
  const navigationToolHint = intent === "navigation"
    ? "\nUsa i tool disponibili open_view e set_filters; non citare tool inesistenti."
    : "";

  // Contesto pagina minimale (solo se utile, max 30 token)
  let contextHint = "";
  if (pageContext?.entityName && pageContext?.entityType) {
    contextHint = `\nContesto: l'utente sta guardando ${pageContext.entityType} "${pageContext.entityName}".`;
  } else if (pageContext?.page && pageContext.page !== "default") {
    contextHint = `\nContesto: l'utente è nella sezione "${pageContext.page}".`;
  }

  return `${base}${contextHint}\n\n${instructions}${quickIdentityHint}${navigationToolHint}`.trim();
}
