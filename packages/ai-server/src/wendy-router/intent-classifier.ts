/**
 * Classifica l'intent di una richiesta Wendy.
 *
 * V1: heuristics rule-based pure, senza LLM call extra.
 * Firma stabile: sostituibile con classificatore LLM senza toccare i chiamanti.
 */
import type { WendyIntent, WendyPageContext, CompressedHistory } from "./types";
import { isLocalWendyReplyMessage } from "./local-reply";

// L'utente vuole aprire, filtrare o raggiungere una vista.
const NAV_PATTERNS = /\b(apri|vai a|portami|mostrami|torna|naviga|cerca in|filtra|apri la sezione|vai al|vai alla|open|go to|take me|show me|return|navigate|search in|filter|open section|abre|ve a|llevame|muestrame|vuelve|navega|busca en|abre la seccion|ve al|ve a la|ouvre|va a|emmene-moi|montre-moi|reviens|navigue|cherche dans|ouvre la section|va vers|va a la)\b/i;

// Richieste esplicite di piano, roadmap o percorso.
const PLANNING_PATTERNS = /\b(roadmap|piano|percorso|obiettivo|obiettivi|come diventare|come imparare|in (\d+) mes|entro quando|step|fase|milestone|programma di studio|piano di apprendimento|dove iniziare|plan|path|objective|objectives|how to become|how to learn|in (\d+) months|by when|study program|learning program|where to start|hoja de ruta|camino|objetivo|objetivos|como convertirse|como aprender|en (\d+) meses|para cuando|paso|hito|programa de estudio|programa de aprendizaje|donde comenzar|feuille de route|chemin|objectif|objectifs|comment devenir|comment apprendre|en (\d+) mois|quand|etape|jalon|programme d'etude|programme d'apprentissage|par ou commencer)\b/i;

// Richieste che richiedono confronto o analisi profonda.
const DEEP_PATTERNS = /\b(confronta|analizza|differenza tra|vantaggi e svantaggi|pro e contro|quale scelgo|dimmi tutto su|approfondisci|analisi completa|compare|analyze|difference between|pros and cons|which should i choose|tell me everything about|elaborate|complete analysis|compara|analiza|diferencia entre|ventajas y desventajas|pros y contras|que elijo|cuentame todo sobre|profundiza|analisis completo|comparez|analysez|difference entre|avantages et inconvenients|quel choisir|dites-moi tout sur|approfondissez|analyse complete)\b/i;

const QUICK_IDENTITY_PATTERNS = /^(ciao|hey|hei|ehi|salve|buongiorno|buonasera|hru|come stai\??|come va\??|tutto bene\??|grazie|ok|perfetto|va bene|chi sei\??|cosa sai fare\??|che cosa sai fare\??|come funziona\??|come funziona wendy\??|presentati|aiutami a capire cosa puoi fare|hi|hello|how are you\??|how's it going\??|everything good\??|thanks|perfect|all good\??|who are you\??|what can you do\??|what do you do\??|how does this work\??|how does wendy work\??|introduce yourself|help me understand what you can do|hola|que tal\??|como estas\??|como va\??|todo bien\??|gracias|perfecto|va bien\??|quien eres\??|que sabes hacer\??|que haces\??|como funciona\??|como funciona wendy\??|salut|ca va\??|tout va bien\??|merci|d'accord|parfait|qui etes-vous\??|que savez-vous faire\??|que faites-vous\??|comment ca marche\??|comment fonctionne wendy\??|presentez-vous|aidez-moi a comprendre ce que vous pouvez faire)$/i;

const GREETING_TERMS = /\b(ciao|hey|hei|ehi|salve|buongiorno|buonasera|hi|hello|hola|salut)\b/i;
const SMALL_TALK_TERMS = /\b(come stai|come va|tutto bene|hru|how are you|how's it going|everything good|all good|que tal|como estas|como va|todo bien|ca va|tout va bien)\b/i;
const QUICK_FRAGMENT_PHRASES = new Set([
  "ciao",
  "hey",
  "hei",
  "ehi",
  "salve",
  "buongiorno",
  "buonasera",
  "ok",
  "perfetto",
  "grazie",
  "hi",
  "hello",
  "thanks",
  "hola",
  "gracias",
  "salut",
  "merci",
]);

const APP_OR_LANGUAGE_PATTERNS = /\b(parlami in italiano|rispondi in italiano|usa l'italiano|a cosa serve (l'app|northstar)|cos['’]?e northstar|che cos['’]?e northstar|come funziona (l'app|northstar)|spiegami northstar|talk to me in italian|respond in italian|use italian|what is (the app|northstar) for|what['’]?s northstar|what is northstar|how does (the app|northstar) work|explain northstar|hablame en italiano|responde en italiano|usa el italiano|para que sirve (la app|northstar)|que es northstar|como funciona (la app|northstar)|explicame northstar|parlez-moi en italien|repondez en italien|utilisez l'italien|a quoi sert (l'app|northstar)|qu'est-ce que northstar|comment fonctionne (l'app|northstar)|expliquez-moi northstar)\b/i;

const QA_PAGES = new Set(["settore", "ruolo", "professione", "sector", "profession"]);

export interface ClassifyIntentInput {
  userMessage: string;
  pageContext?: WendyPageContext | undefined;
  compressedHistory?: CompressedHistory | undefined;
  hasFileAttached?: boolean | undefined;
}

function isCombinedSmallTalk(msg: string): boolean {
  if (msg.length > 80) return false;
  return GREETING_TERMS.test(msg) && SMALL_TALK_TERMS.test(msg);
}

function isLowInformationSocialFragment(msg: string): boolean {
  if (msg.length > 40) return false;
  const normalized = msg
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
  return normalized === "" || QUICK_FRAGMENT_PHRASES.has(normalized);
}

/**
 * Ordine di priorita:
 * 1. file allegato -> deep_analysis
 * 2. pattern navigazione -> navigation
 * 3. identita/small talk/app/language -> simple_qa
 * 4. pianificazione -> planning
 * 5. analisi profonda -> deep_analysis
 * 6. thread aperto -> conversation
 * 7. prima domanda su pagina strutturata -> simple_qa
 * 8. default -> conversation
 */
export function classifyIntent(input: ClassifyIntentInput): WendyIntent {
  const { userMessage, pageContext, compressedHistory, hasFileAttached } = input;
  const msg = userMessage.trim();
  const totalTurns = compressedHistory?.totalTurns ?? 0;

  if (hasFileAttached) return "deep_analysis";

  if (NAV_PATTERNS.test(msg)) return "navigation";

  if (
    isLocalWendyReplyMessage(msg) ||
    QUICK_IDENTITY_PATTERNS.test(msg) ||
    isCombinedSmallTalk(msg) ||
    isLowInformationSocialFragment(msg) ||
    APP_OR_LANGUAGE_PATTERNS.test(msg)
  ) {
    return "simple_qa";
  }

  if (PLANNING_PATTERNS.test(msg)) return "planning";

  if (DEEP_PATTERNS.test(msg)) return "deep_analysis";

  if (totalTurns >= 3) return "conversation";

  if (totalTurns === 0 && pageContext?.entityType && QA_PAGES.has(pageContext.page ?? "")) {
    return "simple_qa";
  }

  return "conversation";
}
