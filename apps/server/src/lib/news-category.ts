export type NewsUiCategory =
  | "general"
  | "technology"
  | "business"
  | "science"
  | "health"
  | "finance"
  | "education";

type NewsCategoryFilter = {
  categories: string[];
  sectors: string[];
};

const CATEGORY_FILTERS: Record<NewsUiCategory, NewsCategoryFilter> = {
  general: {
    categories: [],
    sectors: [],
  },
  technology: {
    categories: ["tech_news", "tech_lavoro", "ai_lavoro", "cybersecurity_lavoro"],
    sectors: ["Tecnologia & Software", "AI & Automazione", "Cybersecurity", "Technology"],
  },
  business: {
    categories: ["economia", "business", "startup_italia", "marketing_lavoro", "logistica_lavoro", "turismo_lavoro"],
    sectors: ["Mercato del Lavoro", "Economia Italia", "Marketing & Comunicazione", "Logistica & Supply Chain", "Turismo & Hospitality"],
  },
  science: {
    categories: ["science", "sanita_lavoro", "energia_lavoro"],
    sectors: ["Sanita & Life Sciences", "Energia & Sostenibilita"],
  },
  health: {
    categories: ["health", "sanita_lavoro"],
    sectors: ["Sanita & Life Sciences"],
  },
  finance: {
    categories: ["finance", "finanza", "finanza_lavoro"],
    sectors: ["Finanza & Fintech", "Finanza"],
  },
  education: {
    categories: ["education", "education_lavoro", "formation", "formazione"],
    sectors: ["Educazione & Formazione", "Career Development"],
  },
};

const RAW_TO_UI_CATEGORY: Array<{ ui: NewsUiCategory; categories: string[]; sectors: string[] }> = [
  { ui: "technology", ...CATEGORY_FILTERS.technology },
  { ui: "finance", ...CATEGORY_FILTERS.finance },
  { ui: "education", ...CATEGORY_FILTERS.education },
  { ui: "health", ...CATEGORY_FILTERS.health },
  { ui: "science", ...CATEGORY_FILTERS.science },
  { ui: "business", ...CATEGORY_FILTERS.business },
];

export function resolveNewsCategoryFilter(category: string | null | undefined): NewsCategoryFilter | null {
  const normalized = String(category ?? "").trim().toLowerCase();
  if (!normalized || normalized === "all" || normalized === "general") return null;
  return CATEGORY_FILTERS[normalized as NewsUiCategory] ?? {
    categories: [normalized],
    sectors: [String(category ?? "").trim()].filter(Boolean),
  };
}

export function mapNewsCategoryForUi(category: string | null | undefined, sectors: string[] | null | undefined): NewsUiCategory {
  const normalized = String(category ?? "").trim().toLowerCase();
  const sectorSet = new Set((sectors ?? []).map((sector) => sector.trim()));

  for (const mapping of RAW_TO_UI_CATEGORY) {
    if (mapping.categories.some((candidate) => candidate.toLowerCase() === normalized)) return mapping.ui;
    if (mapping.sectors.some((candidate) => sectorSet.has(candidate))) return mapping.ui;
  }

  return "general";
}
