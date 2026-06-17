/**
 * news-fallback.ts — set statico mostrato quando la tabella `news_articles` non
 * ha ancora righe (es. DB fresco prima che l'agente di discovery abbia girato,
 * o DB momentaneamente irraggiungibile). Evita che /news resti una pagina bianca.
 *
 * Sono contenuti EVERGREEN scritti da NorthStar (source "NorthStar"), non notizie
 * esterne inventate: i link puntano a sezioni reali dell'app. Le news vere
 * sostituiscono questo set non appena `news_articles` viene popolata.
 *
 * Le funzioni qui sono pure (nessun DB) → testabili in isolamento.
 */

export interface NewsListItem {
  id: string;
  title: string;
  preview: string | null;
  description: string | null;
  source: string;
  sourceUrl: string;
  url: string;
  detailUrl: string;
  publishedAt: string;
  image: string | null;
  category: string;
  sector: string | null;
  tags: string[];
  relevance: number | null;
  plan: "free";
}

export interface NewsDetailItem extends NewsListItem {
  content: string;
}

type StaticArticle = Omit<NewsDetailItem, "publishedAt"> & {
  /** ore fa: la data viene calcolata a runtime così il "pubblicato X fa" resta fresco. */
  hoursAgo: number;
};

const STATIC_ARTICLES: StaticArticle[] = [
  {
    id: "sample-1",
    title: "Il mercato IT italiano premia chi unisce competenze tecniche e soft skill",
    preview:
      "Le aziende cercano sempre più profili capaci di comunicare e collaborare, non solo di scrivere codice.",
    description:
      "Le aziende cercano sempre più profili capaci di comunicare e collaborare, non solo di scrivere codice.",
    source: "NorthStar",
    sourceUrl: "/crescita",
    url: "/crescita",
    detailUrl: "/news/sample-1",
    image: null,
    category: "technology",
    sector: "Tecnologia",
    tags: ["Tecnologia", "Soft skill"],
    relevance: 82,
    plan: "free",
    hoursAgo: 3,
    content: [
      "### Cosa sta succedendo",
      "Nel mercato del lavoro IT italiano cresce la domanda di figure che sappiano unire solide competenze tecniche a capacità relazionali: comunicazione, lavoro in team e problem solving.",
      "",
      "### Perché conta",
      "Sempre più selezioni valutano, oltre allo stack tecnico, la capacità di spiegare le proprie scelte e collaborare con team non tecnici.",
      "",
      "### Cosa puoi fare",
      "Allena le soft skill insieme a quelle tecniche: usa il test di orientamento e la roadmap di NorthStar per capire dove rafforzarti.",
    ].join("\n"),
  },
  {
    id: "sample-2",
    title: "Cloud, dati e AI restano le aree con più offerte di lavoro",
    preview:
      "Le competenze su cloud, data engineering e intelligenza artificiale guidano le assunzioni del settore.",
    description:
      "Le competenze su cloud, data engineering e intelligenza artificiale guidano le assunzioni del settore.",
    source: "NorthStar",
    sourceUrl: "/mercato",
    url: "/mercato",
    detailUrl: "/news/sample-2",
    image: null,
    category: "technology",
    sector: "Tecnologia",
    tags: ["Cloud", "Dati", "AI"],
    relevance: 88,
    plan: "free",
    hoursAgo: 8,
    content: [
      "### Cosa sta succedendo",
      "Cloud, data engineering e intelligenza artificiale continuano a essere le aree con la maggiore domanda di professionisti nel settore tecnologico.",
      "",
      "### Perché conta",
      "Investire su queste competenze aumenta le possibilità di trovare ruoli ben retribuiti e in crescita.",
      "",
      "### Cosa puoi fare",
      "Esplora l'analisi di mercato di NorthStar per vedere quali settori crescono e quali skill sono più richieste.",
    ].join("\n"),
  },
  {
    id: "sample-3",
    title: "Formazione continua: come restare aggiornati senza perdersi",
    preview:
      "Con tecnologie che cambiano in fretta, scegliere cosa imparare conta più di imparare tutto.",
    description:
      "Con tecnologie che cambiano in fretta, scegliere cosa imparare conta più di imparare tutto.",
    source: "NorthStar",
    sourceUrl: "/crescita",
    url: "/crescita",
    detailUrl: "/news/sample-3",
    image: null,
    category: "education",
    sector: "Formazione",
    tags: ["Formazione", "Carriera"],
    relevance: 75,
    plan: "free",
    hoursAgo: 20,
    content: [
      "### Cosa sta succedendo",
      "La velocità con cui cambiano gli strumenti tecnologici rende impossibile imparare tutto: la differenza la fa scegliere bene su cosa concentrarsi.",
      "",
      "### Perché conta",
      "Una formazione mirata, allineata ai tuoi obiettivi, rende più efficace il tempo che dedichi all'apprendimento.",
      "",
      "### Cosa puoi fare",
      "Definisci una roadmap personale con NorthStar e concentra l'energia sulle competenze che contano per il tuo percorso.",
    ].join("\n"),
  },
  {
    id: "sample-4",
    title: "Stipendi tech in Italia: cosa influenza davvero la retribuzione",
    preview:
      "Seniority, specializzazione e settore pesano più del semplice titolo del ruolo.",
    description:
      "Seniority, specializzazione e settore pesano più del semplice titolo del ruolo.",
    source: "NorthStar",
    sourceUrl: "/mercato",
    url: "/mercato",
    detailUrl: "/news/sample-4",
    image: null,
    category: "finance",
    sector: "Tecnologia",
    tags: ["Stipendi", "Carriera"],
    relevance: 79,
    plan: "free",
    hoursAgo: 30,
    content: [
      "### Cosa sta succedendo",
      "La retribuzione nel tech dipende da più fattori: livello di seniority, specializzazione, settore dell'azienda e zona geografica.",
      "",
      "### Perché conta",
      "Capire cosa muove gli stipendi aiuta a orientare scelte di carriera e percorsi di crescita.",
      "",
      "### Cosa puoi fare",
      "Confronta settori e ruoli nell'area mercato di NorthStar per posizionarti meglio.",
    ].join("\n"),
  },
  {
    id: "sample-5",
    title: "Lavoro ibrido e remoto: come cambia l'organizzazione delle aziende",
    preview:
      "Molte realtà consolidano modelli flessibili, con effetti su collaborazione e produttività.",
    description:
      "Molte realtà consolidano modelli flessibili, con effetti su collaborazione e produttività.",
    source: "NorthStar",
    sourceUrl: "/crescita",
    url: "/crescita",
    detailUrl: "/news/sample-5",
    image: null,
    category: "business",
    sector: "Lavoro",
    tags: ["Lavoro ibrido", "Organizzazione"],
    relevance: 72,
    plan: "free",
    hoursAgo: 45,
    content: [
      "### Cosa sta succedendo",
      "Il lavoro ibrido e remoto si sta consolidando in molte aziende, che ridisegnano processi e strumenti di collaborazione.",
      "",
      "### Perché conta",
      "Saper lavorare bene a distanza è ormai una competenza richiesta, oltre che un criterio di scelta del posto di lavoro.",
      "",
      "### Cosa puoi fare",
      "Valuta quali modelli di lavoro si adattano ai tuoi obiettivi con il percorso di orientamento NorthStar.",
    ].join("\n"),
  },
  {
    id: "sample-6",
    title: "Orientarsi nel lavoro: partire dai propri punti di forza",
    preview:
      "Conoscere attitudini e interessi rende più solide le scelte di carriera.",
    description:
      "Conoscere attitudini e interessi rende più solide le scelte di carriera.",
    source: "NorthStar",
    sourceUrl: "/test",
    url: "/test",
    detailUrl: "/news/sample-6",
    image: null,
    category: "general",
    sector: "Orientamento",
    tags: ["Orientamento", "Carriera"],
    relevance: 70,
    plan: "free",
    hoursAgo: 60,
    content: [
      "### Cosa sta succedendo",
      "Sempre più persone affrontano scelte di carriera partendo dalla conoscenza di sé: attitudini, interessi e valori.",
      "",
      "### Perché conta",
      "Decisioni allineate ai propri punti di forza sono più sostenibili e soddisfacenti nel tempo.",
      "",
      "### Cosa puoi fare",
      "Inizia dal test di orientamento di NorthStar per mappare i tuoi punti di forza e ricevere un percorso su misura.",
    ].join("\n"),
  },
];

function toListItem(a: StaticArticle): NewsListItem {
  const { hoursAgo, content: _content, ...rest } = a;
  void _content;
  return {
    ...rest,
    publishedAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
  };
}

function matchesCategory(a: StaticArticle, category: string): boolean {
  return a.category.toLowerCase() === category.toLowerCase();
}

function matchesSector(a: StaticArticle, sector: string): boolean {
  const needle = sector.toLowerCase();
  return (
    (a.sector?.toLowerCase().includes(needle) ?? false) ||
    a.tags.some((t) => t.toLowerCase().includes(needle)) ||
    a.category.toLowerCase() === needle
  );
}

/**
 * Item statici per le liste. Filtra per categoria/settore quando forniti, ma se
 * il filtro non lascia nulla ricade sull'intero set: /news non resta MAI vuota.
 */
export function getStaticNewsItems(opts?: {
  category?: string | undefined;
  sector?: string | undefined;
  limit?: number | undefined;
}): NewsListItem[] {
  const limit = Math.min(50, Math.max(1, opts?.limit ?? 12));
  let pool = STATIC_ARTICLES;
  if (opts?.category) {
    const filtered = pool.filter((a) => matchesCategory(a, opts.category!));
    if (filtered.length > 0) pool = filtered;
  } else if (opts?.sector) {
    const filtered = pool.filter((a) => matchesSector(a, opts.sector!));
    if (filtered.length > 0) pool = filtered;
  }
  return pool.slice(0, limit).map(toListItem);
}

/** Dettaglio statico per gli id `sample-*` (serve la pagina /news/:id). */
export function getStaticNewsDetail(id: string): NewsDetailItem | null {
  const a = STATIC_ARTICLES.find((x) => x.id === id);
  if (!a) return null;
  return { ...toListItem(a), content: a.content };
}

/** Un id appartiene al set statico di fallback? */
export function isStaticNewsId(id: string): boolean {
  return id.startsWith("sample-");
}
