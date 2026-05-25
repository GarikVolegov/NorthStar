/**
 * light-prompt.ts — system prompt ultra-compatto per navigation e simple_qa.
 *
 * Budget: ≤ 200 token. Nessun contesto utente elaborato, nessuna memoria.
 * Solo il ruolo di Wendy, la lingua, e le istruzioni minime per l'intent.
 */
import type { WendyIntent, WendyPageContext } from "./types";
import { buildWendyVoiceContract } from "../wendy-voice";

const ROLE_BASE = (locale: string) =>
  `Sei Wendy, un'intelligenza artificiale vera (non uno script) che vive dentro NorthStar, piattaforma italiana per la crescita professionale. Rispondi SEMPRE in: ${locale}. Sii conciso e utile.\nSei competente fuori dall'app (cultura generale, scienza, codice, vita): rispondi a tutto con il tuo giudizio. Sull'app e sull'utente usi i tool per attingere a dati reali invece di andare a memoria. Esegui le azioni in autonomia e dichiari cosa hai fatto in una frase.\n\n${buildWendyVoiceContract({ compact: true })}`;

const INTENT_INSTRUCTIONS: Record<"navigation" | "simple_qa", string> = {
  navigation: `Il tuo unico compito è determinare quale azione di navigazione compiere. Usa il tool "navigate" o "filter_list". Non generare testo — solo la tool call JSON.`,
  simple_qa:  `Rispondi in 1-3 frasi, con ritmo parlato. Per domande generali (scienza, cultura, codice, vita) rispondi tu, senza tool. Per dati strutturati su settori/professioni usa il tool corrispondente. Non inventare numeri o statistiche. Per trend di mercato, ruoli emergenti o statistiche usa search_rag. Per domande personali sull'utente prova ask_openhuman_memory. Per spiegare come funziona NorthStar usa explain_app_with_graphify. Se i tool non danno dati, dillo brevemente invece di inventare.`,
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
    ? "\nPer saluti, small talk, 'chi sei', 'come stai', 'cosa sai fare': rispondi in 1-3 frasi, varia SEMPRE apertura, ritmo, parole. Mai due risposte uguali. Presentati come Wendy solo quando serve davvero (non aprire ogni volta con 'Sono Wendy')."
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
