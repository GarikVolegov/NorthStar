/**
 * intent-classifier.ts — classifica l'intent di una richiesta Wendy.
 *
 * V1: heuristics rule-based puri (zero LLM call extra).
 * Firma stabile: sostituibile con classificatore LLM senza toccare i chiamanti.
 */
import type { WendyIntent, WendyPageContext, CompressedHistory } from "./types";
import { isLocalWendyReplyMessage } from "./local-reply";

// ── Pattern heuristici ────────────────────────────────────────────────────────

// Trigger di navigazione: l'utente vuole aprire/filtrare una vista
const NAV_PATTERNS = /\b(apri|vai a|portami|mostrami|torna|naviga|cerca in|filtra|apri la sezione|vai al|vai alla)\b/i;

// Trigger di pianificazione esplicita
const PLANNING_PATTERNS = /\b(roadmap|piano|percorso|obiettivo|obiettivi|come diventare|come imparare|in (\d+) mes|entro quando|step|fase|milestone|programma di studio|piano di apprendimento|dove iniziare)\b/i;

// Trigger di analisi profonda
const DEEP_PATTERNS = /\b(confronta|analizza|differenza tra|vantaggi e svantaggi|pro e contro|quale scelgo|dimmi tutto su|approfondisci|analisi completa)\b/i;

const QUICK_IDENTITY_PATTERNS = /^(ciao|hey|hei|ehi|salve|buongiorno|buonasera|hru|come stai\??|come va\??|tutto bene\??|grazie|ok|perfetto|va bene|chi sei\??|cosa sai fare\??|che cosa sai fare\??|come funziona wendy\??|presentati|aiutami a capire cosa puoi fare)$/i;

// Contesti di pagina che suggeriscono domanda rapida
const QA_PAGES = new Set(["settore", "ruolo", "professione", "sector", "profession"]);

// ── Classificatore ────────────────────────────────────────────────────────────

export interface ClassifyIntentInput {
  userMessage:      string;
  pageContext?:     WendyPageContext | undefined;
  compressedHistory?: CompressedHistory | undefined;
  hasFileAttached?: boolean | undefined;  // Phase 2: upload file
}

/**
 * Classifica l'intent di una richiesta Wendy con heuristics rule-based.
 *
 * Ordine di priorità (dal più specifico al più generico):
 * 1. file allegato             → deep_analysis
 * 2. pattern navigazione       → navigation
 * 3. pattern pianificazione    → planning
 * 4. pattern analisi profonda  → deep_analysis
 * 5. thread aperto + messaggio breve → conversation
 * 6. prima domanda + pagina strutturata → simple_qa
 * 7. default                   → conversation
 */
export function classifyIntent(input: ClassifyIntentInput): WendyIntent {
  const { userMessage, pageContext, compressedHistory, hasFileAttached } = input;
  const msg = userMessage.trim();
  const totalTurns = compressedHistory?.totalTurns ?? 0;

  // 1. File allegato → analisi documento (Phase 2)
  if (hasFileAttached) return "deep_analysis";

  // 2. Navigazione esplicita → zero risposta testuale
  if (NAV_PATTERNS.test(msg)) return "navigation";

  if (isLocalWendyReplyMessage(msg) || QUICK_IDENTITY_PATTERNS.test(msg)) return "simple_qa";

  // 3. Pianificazione esplicita
  if (PLANNING_PATTERNS.test(msg)) return "planning";

  // 4. Analisi profonda esplicita
  if (DEEP_PATTERNS.test(msg)) return "deep_analysis";

  // 5. Thread lungo → conversation (ha contesto accumulato)
  if (totalTurns >= 3) return "conversation";

  // 6. Prima domanda su una pagina strutturata → simple_qa
  if (totalTurns === 0 && pageContext?.entityType && QA_PAGES.has(pageContext.page ?? "")) {
    return "simple_qa";
  }

  // 7. Default: conversazione
  return "conversation";
}
