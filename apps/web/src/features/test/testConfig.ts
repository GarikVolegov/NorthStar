import { apiFetch } from "@/lib/api-fetch";
import { readDraft, type TestDraft } from "@/pages/test-draft";

const BASE = import.meta.env.BASE_URL || "/";
const DRAFT_KEY = "northstar_test_draft";
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const ADVANCE_DELAY_MS = 320;
export const MUTE_STORAGE_KEY = "northstar_audio_muted";

export const PHASE_LABELS = ["Attitudini e Competenze", "Dimensioni Motivazionali", "Contesto e Obiettivi"] as const;

export const SPIRIT_DISPLAY: Record<string, { emoji: string; name: string; desc: string }> = {
  presence:  { emoji: "ðŸ§ ", name: "Intelligenza Emotiva",    desc: "Autoconsapevolezza" },
  vision:    { emoji: "ðŸŽ¯", name: "Orientamento Strategico", desc: "Visione a lungo termine" },
  instinct:  { emoji: "âš¡", name: "Motivazione e Impulso",   desc: "Energia e iniziativa" },
  focus:     { emoji: "ðŸ“Š", name: "Pensiero Analitico",      desc: "Precisione e metodo" },
  tenacity:  { emoji: "ðŸ›¡", name: "Resilienza",              desc: "Perseveranza" },
};

export const JOURNEY_CTX1_DEFAULTS: Record<string, number> = {
  autonomo: 5, azienda: 4, investitore: 4, dipendente: 1, indeciso: 3,
};

const BASE_RIASEC_IDS = ["q1","q2","q3","q4","q5","q6","q7","q8","q9","q10","q11","q12"] as const;
const SPIRIT_QUESTION_IDS = [
  "shen_1","shen_2","shen_3",
  "hun_1","hun_2","hun_3",
  "po_1","po_2","po_3",
  "yi_1","yi_2","yi_3",
  "zhi_1","zhi_2","zhi_3",
] as const;

/** Sostituisce alcune domande RIASEC in base al percorso dell'utente */
export function getRiasecIds(journeyType?: string | null): string[] {
  const ids: string[] = [...BASE_RIASEC_IDS];
  switch (journeyType) {
    case "dipendente":
      ids[4]  = "q5_dipendente";  // sostituisce q5 (E) con variante collaborativa
      ids[10] = "q11_dipendente"; // sostituisce q11 (E) con variante collaborativa
      break;
    case "autonomo":
      ids[4]  = "q5_autonomo";   // sostituisce q5 con variante autonomia
      ids[5]  = "q6_autonomo";   // sostituisce q6 con variante autonomia
      break;
    case "azienda":
      ids[4]  = "q5_azienda";    // sostituisce q5 con variante leadership
      ids[10] = "q11_azienda";   // sostituisce q11 con variante leadership
      break;
    case "investitore":
      ids[1]  = "q2_investitore"; // sostituisce q2 con variante analisi finanziaria
      ids[7]  = "q8_investitore"; // sostituisce q8 con variante economia/mercati
      break;
  }
  return ids;
}

/** Restituisce le domande CTX specifiche per il percorso */
export function getCtxIds(journeyType?: string | null): string[] {
  switch (journeyType) {
    case "dipendente":   return ["ctx_dipendente_1", "ctx_dipendente_2"];
    case "autonomo":     return ["ctx_autonomo_1",   "ctx_autonomo_2"];
    case "azienda":      return ["ctx_azienda_1",    "ctx_azienda_2"];
    case "investitore":  return ["ctx_investitore_1","ctx_investitore_2"];
    case "indeciso":     return ["ctx_indeciso_1",   "ctx_indeciso_2"];
    default:             return ["ctx_1", "ctx_2"];
  }
}

// Questi vengono usati solo come fallback statici e per le costanti di lunghezza
const RIASEC_QUESTION_IDS = BASE_RIASEC_IDS;
const CTX_QUESTION_IDS = ["ctx_1","ctx_2"] as const;

export const SPIRIT_META: Record<string, { key: string; emoji: string; transKey: string }> = {
  shen_1:{ key:"shen", emoji:"*", transKey:"presence" },
  shen_2:{ key:"shen", emoji:"*", transKey:"presence" },
  shen_3:{ key:"shen", emoji:"*", transKey:"presence" },
  hun_1:{ key:"hun", emoji:"moon", transKey:"vision" },
  hun_2:{ key:"hun", emoji:"moon", transKey:"vision" },
  hun_3:{ key:"hun", emoji:"moon", transKey:"vision" },
  po_1:{ key:"po", emoji:"!", transKey:"instinct" },
  po_2:{ key:"po", emoji:"!", transKey:"instinct" },
  po_3:{ key:"po", emoji:"!", transKey:"instinct" },
  yi_1:{ key:"yi", emoji:"focus", transKey:"focus" },
  yi_2:{ key:"yi", emoji:"focus", transKey:"focus" },
  yi_3:{ key:"yi", emoji:"focus", transKey:"focus" },
  zhi_1:{ key:"zhi", emoji:"fire", transKey:"tenacity" },
  zhi_2:{ key:"zhi", emoji:"fire", transKey:"tenacity" },
  zhi_3:{ key:"zhi", emoji:"fire", transKey:"tenacity" },
};

export const ALL_RIASEC_IDS = [...RIASEC_QUESTION_IDS];
export const ALL_SPIRIT_IDS = [...SPIRIT_QUESTION_IDS];
export const ALL_CTX_IDS   = [...CTX_QUESTION_IDS];
export const ALL_IDS       = [...ALL_RIASEC_IDS, ...ALL_SPIRIT_IDS, ...ALL_CTX_IDS];
export const SPIRITS_START = ALL_RIASEC_IDS.length;
export const SPIRITS_END   = ALL_RIASEC_IDS.length + ALL_SPIRIT_IDS.length;

export const PHASE_BG = [
  "bg-blue-50 dark:bg-blue-950/40",
  "bg-violet-50 dark:bg-violet-950/40",
  "bg-amber-50 dark:bg-amber-950/40",
] as const;

export const PHASE_PROGRESS_COLOR = [
  "bg-blue-500 dark:bg-blue-400",
  "bg-violet-500 dark:bg-violet-400",
  "bg-amber-500 dark:bg-amber-400",
] as const;

export const PHASE_OVERLAY_BG = [
  "from-blue-950/95 to-blue-900/90",
  "from-violet-950/95 to-violet-900/90",
  "from-amber-950/95 to-amber-900/90",
] as const;

export const PHASE_OVERLAY_ACCENT = [
  "bg-blue-400/20 border-blue-400/30",
  "bg-violet-400/20 border-violet-400/30",
  "bg-amber-400/20 border-amber-400/30",
] as const;

export const WELCOME_EXIT_DURATION = 0.42;
export const TEST_ENTER_DURATION   = 0.38;
export const SLIDE_EASE_IN  = [0.4, 0, 1, 1] as const;
export const SLIDE_EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const PHASE_OVERLAY_MS = 1600;

export function loadDraft(): TestDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = readDraft(JSON.parse(raw) as unknown);
    if (!d) return null;
    if (Date.now() - d.savedAt > DRAFT_TTL_MS) { localStorage.removeItem(DRAFT_KEY); return null; }
    return d;
  } catch { return null; }
}
export function saveDraft(d: TestDraft) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* ignore storage write failures */ } }
export function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore storage write failures */ } }
export async function assignUserToSession(sessionId: number, userId: number): Promise<void> {
  try {
    await apiFetch(`${BASE}api/test-sessions/${sessionId}/assign-user`, {
      method: "POST", body: JSON.stringify({ userId }),
    });
  } catch { /* best effort session association */ }
}
