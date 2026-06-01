export interface ItalianLaborNewsQuery {
  q: string;
  type: "news";
  sector: string;
  category: string;
}

type SectorClassifierRule = {
  sector: string;
  keywords: string[];
};

const ITALIAN_NEWS_HOST_HINTS = [
  ".it/",
  "ansa.it",
  "ilsole24ore.com",
  "repubblica.it",
  "wired.it",
  "ninjamarketing.it",
  "corriere.it",
  "lastampa.it",
  "fanpage.it",
  "startupitalia.eu",
];

const ITALIAN_TEXT_HINTS = [
  "lavoro",
  "lavoratori",
  "occupazione",
  "professioni",
  "professionale",
  "competenze",
  "formazione",
  "carriere",
  "aziende",
  "imprese",
  "mercato",
  "settore",
  "italia",
  "italiano",
  "italiana",
  "digitale",
  "sanita",
  "sostenibilita",
];

const ENGLISH_TEXT_HINTS = [
  "workforce",
  "workers",
  "skills",
  "companies",
  "leaders",
  "employment",
  "career",
  "training",
  "market",
];

const SECTOR_CLASSIFIER_RULES: SectorClassifierRule[] = [
  {
    sector: "Tecnologia & Software",
    keywords: ["software", "digitale", "digitali", "programmat", "developer", "svilupp", "cloud", "dati", "server", "data center", "semiconductor", "chip"],
  },
  {
    sector: "AI & Automazione",
    keywords: ["intelligenza artificiale", "openai", "automazione", "robot", "algoritm", "machine learning", "generativa", "chatbot"],
  },
  {
    sector: "Sanita & Life Sciences",
    keywords: ["sanita", "sanitario", "ospedal", "medic", "farmaceutic", "life science", "biotech", "salute", "infermier"],
  },
  {
    sector: "Energia & Sostenibilita",
    keywords: ["energia", "rinnovabil", "sostenibil", "green", "clima", "ambient", "fotovoltaic", "eolic", "transizione"],
  },
  {
    sector: "Finanza & Fintech",
    keywords: ["banca", "banche", "finanza", "fintech", "borsa", "credito", "pagamenti", "assicur", "investiment"],
  },
  {
    sector: "Marketing & Comunicazione",
    keywords: ["marketing", "comunicazione", "pubblicit", "brand", "social media", "media", "creator", "advertising"],
  },
  {
    sector: "Design & UX",
    keywords: ["design", "ux", "prodotto digitale", "interfac", "user experience", "creativ"],
  },
  {
    sector: "Educazione & Formazione",
    keywords: ["formazione", "scuola", "universit", "competenze", "upskilling", "reskilling", "student", "academy", "corso"],
  },
  {
    sector: "Logistica & Supply Chain",
    keywords: ["logistica", "trasport", "supply chain", "spedizion", "magazzin", "ferrov", "intercity"],
  },
  {
    sector: "Turismo & Hospitality",
    keywords: ["turismo", "hotel", "hospitality", "ristor", "viaggi", "stagione", "parchi acquatici", "accoglienza"],
  },
  {
    sector: "Cybersecurity",
    keywords: ["cyber", "sicurezza informatica", "hacker", "ransomware", "data breach", "privacy"],
  },
  {
    sector: "Media & Intrattenimento",
    keywords: ["intrattenimento", "cinema", "streaming", "musica", "editoria", "giornal", "contenut"],
  },
];

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyItalianLaborSectors(input: { title?: string; summary?: string; fallbackSector?: string }): string[] {
  const rawText = `${input.title ?? ""} ${input.summary ?? ""}`;
  const text = ` ${normalizeSearchText(rawText)} `;
  const keywordMatches = (keyword: string) => {
    const normalizedKeyword = normalizeSearchText(keyword);
    if (normalizedKeyword.length <= 2) return new RegExp(`\\b${normalizedKeyword}\\b`).test(text);
    return text.includes(normalizedKeyword);
  };
  const matches = SECTOR_CLASSIFIER_RULES
    .map((rule) => ({
      sector: rule.sector,
      score: rule.keywords.reduce((score, keyword) => score + (keywordMatches(keyword) ? 1 : 0), 0)
        + (rule.sector === "AI & Automazione" && /\bAI\b/.test(rawText) ? 1 : 0),
    }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((match) => match.sector);

  if (matches.length > 0) return matches;
  const fallbackMap: Record<string, string> = {
    Technology: "Tecnologia & Software",
    Finanza: "Finanza & Fintech",
    "Digital Marketing": "Marketing & Comunicazione",
    "Economia Italia": "Mercato del Lavoro",
  };
  const fallback = input.fallbackSector ? (fallbackMap[input.fallbackSector] ?? input.fallbackSector) : "Mercato del Lavoro";
  return [fallback];
}

export function isItalianLaborNewsText(input: { title?: string; summary?: string; url?: string }): boolean {
  const url = String(input.url ?? "").toLowerCase();
  const rawText = `${input.title ?? ""} ${input.summary ?? ""}`;
  const text = normalizeSearchText(rawText);
  const hostScore = ITALIAN_NEWS_HOST_HINTS.some((hint) => url.includes(hint)) ? 2 : 0;
  const accentScore = /[\u00e0\u00e8\u00e9\u00ec\u00f2\u00f9]/i.test(rawText) ? 1 : 0;
  const italianScore = ITALIAN_TEXT_HINTS.reduce((score, hint) => score + (text.includes(hint) ? 1 : 0), 0);
  const englishScore = ENGLISH_TEXT_HINTS.reduce((score, hint) => score + (text.includes(hint) ? 1 : 0), 0);

  return hostScore + accentScore + italianScore >= 3 && italianScore >= Math.max(1, englishScore - 2);
}

export function getItalianLaborNewsQueries(): ItalianLaborNewsQuery[] {
  return [
    { q: "lavoro tecnologia software competenze digitali Italia", type: "news", sector: "Tecnologia & Software", category: "tech_lavoro" },
    { q: "lavoro intelligenza artificiale professioni competenze Italia", type: "news", sector: "AI & Automazione", category: "ai_lavoro" },
    { q: "lavoro sanita life sciences professioni Italia", type: "news", sector: "Sanita & Life Sciences", category: "sanita_lavoro" },
    { q: "lavoro energia sostenibilita green jobs Italia", type: "news", sector: "Energia & Sostenibilita", category: "energia_lavoro" },
    { q: "lavoro finanza fintech banche competenze Italia", type: "news", sector: "Finanza & Fintech", category: "finanza_lavoro" },
    { q: "lavoro marketing comunicazione digitale Italia", type: "news", sector: "Marketing & Comunicazione", category: "marketing_lavoro" },
    { q: "lavoro design UX prodotto digitale Italia", type: "news", sector: "Design & UX", category: "design_lavoro" },
    { q: "lavoro formazione education competenze professionali Italia", type: "news", sector: "Educazione & Formazione", category: "education_lavoro" },
    { q: "lavoro logistica supply chain professioni Italia", type: "news", sector: "Logistica & Supply Chain", category: "logistica_lavoro" },
    { q: "lavoro turismo hospitality professioni Italia", type: "news", sector: "Turismo & Hospitality", category: "turismo_lavoro" },
    { q: "lavoro cybersecurity sicurezza informatica competenze Italia", type: "news", sector: "Cybersecurity", category: "cybersecurity_lavoro" },
    { q: "lavoro media intrattenimento creator economy Italia", type: "news", sector: "Media & Intrattenimento", category: "media_lavoro" },
  ];
}
