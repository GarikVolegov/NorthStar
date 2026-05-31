export type WendyDetectedLanguage = "it" | "en" | "es" | "fr";

const ITALIAN_MARKERS = [
  "ciao",
  "ei",
  "ehi",
  "hei",
  "italiano",
  "parlami",
  "rispondi",
  "chi",
  "sei",
  "come",
  "funziona",
  "cosa",
  "dovrei",
  "fare",
  "oggi",
  "analizza",
  "profilo",
  "prossima",
  "mossa",
  "quali",
  "settori",
  "adatti",
  "progressi",
  "obiettivi",
  "perche",
  "perchè",
  "qual",
  "grazie",
  "gia",
  "lho",
  "l ho",
  "buongiorno",
  "buonasera",
  "serve",
] as const;

const ENGLISH_MARKERS = [
  "hello",
  "hi",
  "how",
  "what",
  "who",
  "why",
  "today",
  "profile",
  "sectors",
  "objectives",
  "goals",
  "progress",
  "next",
  "move",
  "work",
  "app",
] as const;

function normalizeText(message: string): string {
  return message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countMarkers(message: string, markers: readonly string[]): number {
  const padded = ` ${normalizeText(message)} `;
  return markers.reduce((score, marker) => (
    padded.includes(` ${normalizeText(marker)} `) ? score + 1 : score
  ), 0);
}

function normalizeRequestedLocale(locale: string | undefined): WendyDetectedLanguage {
  const normalized = locale?.slice(0, 2).toLowerCase();
  if (normalized === "en" || normalized === "es" || normalized === "fr" || normalized === "it") {
    return normalized;
  }
  return "it";
}

export function isLikelyItalianWendyMessage(message: string): boolean {
  const italianScore = countMarkers(message, ITALIAN_MARKERS);
  const englishScore = countMarkers(message, ENGLISH_MARKERS);
  if (italianScore === 0) return false;
  return italianScore >= englishScore;
}

export function detectWendyLanguage(input: {
  requestedLocale?: string | undefined;
  message: string;
}): WendyDetectedLanguage {
  if (isLikelyItalianWendyMessage(input.message)) return "it";
  return normalizeRequestedLocale(input.requestedLocale);
}
