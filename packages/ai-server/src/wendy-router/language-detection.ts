export type WendyDetectedLanguage = "it" | "en" | "es" | "fr";

/**
 * Rilevamento lingua basato su parole funzionali ad alta frequenza (articoli,
 * preposizioni, pronomi, ausiliari): a differenza di una lista di keyword di
 * dominio, queste parole compaiono in quasi ogni frase reale, quindi una frase
 * italiana complessa viene riconosciuta come italiana anche se non contiene
 * termini "tema" come settori/profilo/obiettivi.
 *
 * Regola: vince la lingua con più hit. Il `requestedLocale` del browser è solo
 * un tie-break quando il messaggio non porta segnale (es. "ok", "👍") — NON deve
 * mai sovrascrivere una frase chiaramente italiana, che era il bug per cui Wendy
 * rispondeva/suggeriva in inglese a utenti che scrivevano in italiano.
 */

// Parole funzionali distintive. Volutamente includono forme che raramente
// collidono tra lingue, per rendere il punteggio robusto.
const ITALIAN_MARKERS = [
  "di", "che", "e", "il", "la", "lo", "le", "gli", "un", "una", "uno", "del",
  "della", "dei", "degli", "delle", "per", "con", "non", "mi", "ti", "ci", "si",
  "ne", "sono", "sei", "ho", "hai", "ha", "abbiamo", "come", "cosa", "piu",
  "anche", "ma", "se", "da", "in", "su", "nel", "nella", "sul", "questo",
  "questa", "quello", "quella", "perche", "quando", "dove", "quale", "quali",
  "secondo", "quindi", "percio", "gia", "molto", "bene", "voglio", "vorrei",
  "posso", "devo", "dovrei", "fare", "essere", "mio", "mia", "miei", "tuo",
  "tua", "me", "te", "lavoro", "carriera", "settore", "settori", "professione",
] as const;

const ENGLISH_MARKERS = [
  "the", "is", "are", "was", "were", "a", "an", "of", "to", "and", "in", "for",
  "with", "my", "your", "you", "me", "i", "it", "that", "this", "these", "those",
  "what", "how", "why", "when", "where", "which", "who", "do", "does", "did",
  "be", "been", "can", "could", "should", "would", "will", "about", "want",
  "need", "tell", "help", "work", "career", "sector", "job", "should",
] as const;

const SPANISH_MARKERS = [
  "el", "los", "las", "un", "una", "que", "de", "y", "en", "por", "para", "con",
  "mi", "me", "tu", "te", "soy", "eres", "quiero", "puedo", "como", "cual",
  "donde", "cuando", "porque", "trabajo", "carrera", "sector", "esto", "esta",
  "muy", "tambien", "pero", "sus", "este",
] as const;

const FRENCH_MARKERS = [
  "le", "les", "un", "une", "que", "de", "et", "en", "pour", "avec", "mon", "ma",
  "je", "tu", "vous", "suis", "veux", "peux", "comment", "pourquoi", "quel",
  "quelle", "ou", "quand", "travail", "carriere", "secteur", "ce", "cette",
  "tres", "aussi", "mais", "mes", "dans",
] as const;

function normalizeText(message: string): string {
  return message
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countMarkers(padded: string, markers: readonly string[]): number {
  return markers.reduce(
    (score, marker) => (padded.includes(` ${marker} `) ? score + 1 : score),
    0,
  );
}

function normalizeRequestedLocale(locale: string | undefined): WendyDetectedLanguage {
  const normalized = locale?.slice(0, 2).toLowerCase();
  if (normalized === "en" || normalized === "es" || normalized === "fr" || normalized === "it") {
    return normalized;
  }
  return "it";
}

interface LanguageScores {
  it: number;
  en: number;
  es: number;
  fr: number;
}

function scoreLanguages(message: string): LanguageScores {
  const padded = ` ${normalizeText(message)} `;
  return {
    it: countMarkers(padded, ITALIAN_MARKERS),
    en: countMarkers(padded, ENGLISH_MARKERS),
    es: countMarkers(padded, SPANISH_MARKERS),
    fr: countMarkers(padded, FRENCH_MARKERS),
  };
}

export function isLikelyItalianWendyMessage(message: string): boolean {
  const scores = scoreLanguages(message);
  if (scores.it === 0) return false;
  // L'italiano vince anche in pareggio: l'app è italiana per default.
  return scores.it >= Math.max(scores.en, scores.es, scores.fr);
}

export function detectWendyLanguage(input: {
  requestedLocale?: string | undefined;
  message: string;
}): WendyDetectedLanguage {
  const scores = scoreLanguages(input.message);
  const max = Math.max(scores.it, scores.en, scores.es, scores.fr);

  // Nessun segnale linguistico (messaggio cortissimo / solo emoji): usa il
  // locale richiesto come tie-break.
  if (max === 0) return normalizeRequestedLocale(input.requestedLocale);

  // L'italiano vince ogni pareggio al vertice (app italiana per default).
  if (scores.it === max) return "it";

  // Tra lingue non-italiane: se una sola è in testa, è quella. In caso di
  // pareggio (parole funzionali condivise, es. "que" IT/ES/FR) ci si fida del
  // locale richiesto dal browser quando è una delle lingue in testa.
  const topLangs = (["en", "es", "fr"] as const).filter((lang) => scores[lang] === max);
  if (topLangs.length === 1) return topLangs[0] ?? normalizeRequestedLocale(input.requestedLocale);
  const requested = normalizeRequestedLocale(input.requestedLocale);
  if (topLangs.includes(requested as "en" | "es" | "fr")) return requested;
  return topLangs[0] ?? requested;
}
