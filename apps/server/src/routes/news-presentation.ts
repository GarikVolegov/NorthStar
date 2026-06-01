import { newsArticlesTable } from "@workspace/db";
import { mapNewsCategoryForUi } from "../lib/news-category";

export type NewsArticleRow = typeof newsArticlesTable.$inferSelect;
export type NewsLocale = "it" | "en" | "es" | "fr" | "de";

export const FALLBACK_IMAGE_THEMES: Record<string, { from: string; to: string; icon: string }> = {
  technology: { from: "2563eb", to: "0891b2", icon: "TECH" },
  business: { from: "047857", to: "65a30d", icon: "BIZ" },
  science: { from: "7c3aed", to: "0f766e", icon: "SCI" },
  health: { from: "be123c", to: "db2777", icon: "CARE" },
  finance: { from: "b45309", to: "15803d", icon: "FIN" },
  education: { from: "4338ca", to: "0369a1", icon: "LEARN" },
  general: { from: "334155", to: "0f766e", icon: "NEWS" },
};

type MeaningCopy = {
  audience: (sector: string) => string;
  happened: (summary: string) => string;
  why: (sector: string) => string;
  practical: string;
  signal: string;
  headings: {
    audience: string;
    happened: string;
    why: string;
    practical: string;
  };
  detailWhy: (sectors: string) => string;
};

const MEANING_COPY: Record<NewsLocale, MeaningCopy> = {
  it: {
    audience: (sector) => `Per chi sta valutando o seguendo ${sector}, competenze collegate e prossime scelte professionali.`,
    happened: (summary) => summary,
    why: (sector) => `Questa notizia ti aiuta a leggere cosa cambia in ${sector} e quali decisioni professionali potrebbero diventare più importanti per te.`,
    practical: "Confronta il segnale con il tuo percorso: scegli una competenza da verificare questa settimana e decidi se aggiornare una priorità concreta.",
    signal: "Segnale per il tuo percorso",
    headings: {
      audience: "Per chi è",
      happened: "Cosa è successo",
      why: "Perché conta per l'utente",
      practical: "Cosa fare adesso",
    },
    detailWhy: (sectors) => `Questa notizia conta se stai osservando ${sectors}: ti aiuta a capire quali competenze, ruoli o decisioni potrebbero pesare nelle tue prossime scelte.`,
  },
  en: {
    audience: (sector) => `For people tracking ${sector}, related skills, and upcoming career choices.`,
    happened: (summary) => summary,
    why: (sector) => `This story helps you understand what is changing in ${sector} and which career decisions may become more important.`,
    practical: "Compare the signal with your path, pick one skill to investigate, and check whether it changes your next priority.",
    signal: "Signal for your path",
    headings: {
      audience: "Who it's for",
      happened: "What happened",
      why: "Why it matters to you",
      practical: "What to do now",
    },
    detailWhy: (sectors) => `This story matters if you are tracking ${sectors}: it helps you understand which skills, roles, or decisions may affect your next choices.`,
  },
  es: {
    audience: (sector) => `Para quien sigue ${sector}, competencias relacionadas y próximas decisiones profesionales.`,
    happened: (summary) => summary,
    why: (sector) => `Esta noticia te ayuda a entender qué cambia en ${sector} y qué decisiones profesionales pueden volverse más importantes.`,
    practical: "Compara la señal con tu camino, elige una competencia para investigar y revisa si cambia tu próxima prioridad.",
    signal: "Señal para tu camino",
    headings: {
      audience: "Para quién es",
      happened: "Qué pasó",
      why: "Por qué te importa",
      practical: "Qué hacer ahora",
    },
    detailWhy: (sectors) => `Esta noticia importa si estás siguiendo ${sectors}: te ayuda a entender qué competencias, roles o decisiones pueden influir en tus próximas elecciones.`,
  },
  fr: {
    audience: (sector) => `Pour les personnes qui suivent ${sector}, les compétences liées et les prochains choix professionnels.`,
    happened: (summary) => summary,
    why: (sector) => `Cette actualité vous aide à comprendre ce qui change dans ${sector} et quelles décisions professionnelles peuvent devenir plus importantes.`,
    practical: "Comparez ce signal à votre parcours, choisissez une compétence à explorer et vérifiez si votre prochaine priorité change.",
    signal: "Signal pour votre parcours",
    headings: {
      audience: "Pour qui",
      happened: "Ce qui s'est passé",
      why: "Pourquoi cela compte pour vous",
      practical: "Que faire maintenant",
    },
    detailWhy: (sectors) => `Cette actualité compte si vous suivez ${sectors}: elle vous aide à comprendre quelles compétences, quels rôles ou quelles décisions peuvent peser dans vos prochains choix.`,
  },
  de: {
    audience: (sector) => `Für alle, die ${sector}, verwandte Skills und nächste berufliche Entscheidungen verfolgen.`,
    happened: (summary) => summary,
    why: (sector) => `Diese Nachricht hilft dir zu verstehen, was sich in ${sector} verändert und welche beruflichen Entscheidungen wichtiger werden können.`,
    practical: "Vergleiche das Signal mit deinem Weg, wähle einen Skill zur Prüfung und entscheide, ob sich deine nächste Priorität ändert.",
    signal: "Signal für deinen Weg",
    headings: {
      audience: "Für wen",
      happened: "Was passiert ist",
      why: "Warum es für dich zählt",
      practical: "Was du jetzt tun kannst",
    },
    detailWhy: (sectors) => `Diese Nachricht zählt, wenn du ${sectors} beobachtest: Sie hilft dir zu verstehen, welche Skills, Rollen oder Entscheidungen deine nächsten Schritte beeinflussen können.`,
  },
};

export function fallbackNewsImage(category: string, title: string): string {
  const mapped = mapNewsCategoryForUi(category, []);
  const theme = FALLBACK_IMAGE_THEMES[mapped] ?? FALLBACK_IMAGE_THEMES.general!;
  const slug = encodeURIComponent(`${mapped}-${title.slice(0, 48)}`);
  return `/api/news/fallback-image/${mapped}.svg?title=${slug}&from=${theme.from}&to=${theme.to}&icon=${theme.icon}`;
}

export function escapeSvgText(value: unknown): string {
  return String(value ?? "")
    .replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    }[char] ?? char))
    .slice(0, 96);
}

export function readHexColor(value: unknown, fallback: string): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && /^[0-9a-f]{6}$/i.test(raw) ? raw : fallback;
}

function newsMeaning(row: NewsArticleRow, locale: NewsLocale) {
  const sector = row.sectorNames?.[0] ?? (locale === "it" ? "mercato del lavoro" : "the job market");
  const summary = row.summary?.trim() || row.title;
  const copy = MEANING_COPY[locale];
  const audience = copy.audience(sector);
  const happened = copy.happened(summary);
  const whyItMatters = copy.why(sector);
  const practicalNextStep = copy.practical;
  const sections = [
    { key: "audience" as const, body: audience },
    { key: "happened" as const, body: happened },
    { key: "why" as const, body: whyItMatters },
    { key: "practical" as const, body: practicalNextStep },
  ];
  return {
    audience,
    happened,
    whyItMatters,
    practicalNextStep,
    action: practicalNextStep,
    signal: copy.signal,
    sections,
  };
}

function structuredContent(a: NewsArticleRow, locale: NewsLocale): string {
  const sectors = a.sectorNames?.length ? a.sectorNames.join(", ") : (locale === "it" ? "mercato del lavoro" : "the job market");
  const meaning = newsMeaning(a, locale);
  const copy = MEANING_COPY[locale];
  return [
    `### ${copy.headings.audience}`,
    meaning.audience,
    "",
    `### ${copy.headings.happened}`,
    meaning.happened,
    "",
    `### ${copy.headings.why}`,
    copy.detailWhy(sectors),
    "",
    `### ${copy.headings.practical}`,
    meaning.practicalNextStep,
  ].join("\n");
}

export function mapNewsItem(a: NewsArticleRow, locale: NewsLocale = "it") {
  const publishedAt = a.publishedAt instanceof Date
    ? a.publishedAt.toISOString()
    : (a.publishedAt ? String(a.publishedAt) : new Date().toISOString());
  return {
    id: String(a.id),
    title: a.title,
    preview: a.summary,
    description: a.summary,
    source: a.source,
    sourceUrl: a.url,
    url: a.url,
    detailUrl: `/news/${a.id}`,
    publishedAt,
    image: a.imageUrl?.trim() || fallbackNewsImage(a.category, a.title),
    language: locale,
    meaning: newsMeaning(a, locale),
    category: mapNewsCategoryForUi(a.category, a.sectorNames ?? []),
    sector: a.sectorNames?.[0] ?? null,
    tags: a.sectorNames ?? [],
    relevance: a.relevanceScore,
    plan: "free" as const,
  };
}

export function mapNewsDetail(a: NewsArticleRow, locale: NewsLocale = "it") {
  const item = mapNewsItem(a, locale);
  return {
    ...item,
    content: structuredContent(a, locale),
    sourceUrl: a.url,
    url: a.url,
  };
}
