import { colors } from "@workspace/design-tokens/tokens";

export const SCORE_THRESHOLD = {
  excellent: { min: 85, color: colors.chart2, tailwind: "text-emerald-400" },
  good: { min: 65, color: colors.chart2, tailwind: "text-emerald-400" },
  average: { min: 45, color: colors.chart1, tailwind: "text-amber-400" },
  low: { min: 25, color: colors.chart1, tailwind: "text-orange-400" },
  poor: { min: 0, color: colors.mutedFg, tailwind: "text-rose-400" },
} as const;

export function getScoreColor(score: number): string {
  if (score >= 85) return SCORE_THRESHOLD.excellent.color;
  if (score >= 65) return SCORE_THRESHOLD.good.color;
  if (score >= 45) return SCORE_THRESHOLD.average.color;
  if (score >= 25) return SCORE_THRESHOLD.low.color;
  return SCORE_THRESHOLD.poor.color;
}

export const NODE_CATEGORY_META: Record<string, { color: string; bg: string; border: string }> = {
  note:          { color: colors.chart3, bg: `hsl(var(--chart-3) / 0.1)`, border: `hsl(var(--chart-3) / 0.4)` },
  skill:         { color: colors.chart2, bg: `hsl(var(--chart-2) / 0.1)`, border: `hsl(var(--chart-2) / 0.4)` },
  document:      { color: colors.chart1, bg: `hsl(var(--chart-1) / 0.1)`, border: `hsl(var(--chart-1) / 0.4)` },
  sector:        { color: colors.growthDark, bg: `hsl(var(--chart-2) / 0.08)`, border: colors.growth },
  role:          { color: colors.chart4, bg: `hsl(var(--chart-4) / 0.1)`, border: `hsl(var(--chart-4) / 0.4)` },
  tool:          { color: colors.chart1, bg: `hsl(var(--chart-1) / 0.08)`, border: `hsl(var(--chart-1) / 0.4)` },
  certification: { color: colors.chart4, bg: `hsl(var(--chart-4) / 0.1)`, border: `hsl(var(--chart-4) / 0.4)` },
  concept:       { color: colors.chart5, bg: `hsl(var(--chart-5) / 0.08)`, border: `hsl(var(--chart-5) / 0.4)` },
  link:          { color: colors.chart3, bg: `hsl(var(--chart-3) / 0.08)`, border: `hsl(var(--chart-3) / 0.4)` },
} as const;

export const CERTIFICATE_CATEGORY_COLORS: Record<string, { accent: string; bg: string }> = {
  carriera:   { accent: colors.primary, bg: `hsl(var(--chart-1) / 0.08)` },
  formazione: { accent: colors.chart3, bg: `hsl(var(--chart-3) / 0.08)` },
  salute:     { accent: colors.chart2, bg: `hsl(var(--chart-2) / 0.08)` },
  finanza:    { accent: colors.chart1, bg: `hsl(var(--chart-1) / 0.08)` },
  relazioni:  { accent: colors.chart4, bg: `hsl(var(--chart-4) / 0.08)` },
  progetto:   { accent: colors.chart5, bg: `hsl(var(--chart-5) / 0.08)` },
  abitudine:  { accent: colors.chart2, bg: `hsl(var(--chart-2) / 0.08)` },
  altro:      { accent: colors.primary, bg: `hsl(var(--chart-1) / 0.08)` },
} as const;

export const SITEMAP_GROUP_COLORS: Record<string, { color: string; bg: string }> = {
  navigation:  { color: colors.chart4, bg: `hsl(var(--chart-4) / 0.1)` },
  sectors:     { color: colors.chart1, bg: `hsl(var(--chart-1) / 0.1)` },
  brand:       { color: colors.chart2, bg: `hsl(var(--chart-2) / 0.1)` },
  wiki:        { color: colors.chart4, bg: `hsl(var(--chart-4) / 0.1)` },
  roadmap:     { color: colors.chart3, bg: `hsl(var(--chart-3) / 0.1)` },
  graph:       { color: colors.chart5, bg: `hsl(var(--chart-5) / 0.1)` },
} as const;

export const AGENT_STATUS_COLORS = [
  colors.chart1,
  colors.chart3,
  colors.chart1,
  colors.chart2,
  colors.destructive,
  colors.chart4,
  colors.chart5,
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  carriera: "Carriera", formazione: "Formazione", salute: "Salute",
  finanza: "Finanza", relazioni: "Relazioni", progetto: "Progetto",
  abitudine: "Abitudine", altro: "Traguardo",
};

export const CONFRONTO_ACCENT = [
  `hsl(var(--primary))`,
  colors.chart4,
  colors.chart3,
] as const;

// Roadmap UI Text Constants
export const ROADMAP_TEXT = {
  // Header
  header: {
    title: "Roadmap personalizzata",
    premiumBadge: "Premium",
  },
  
  // Generate State
  generateState: {
    title: (sectorName: string) => `Tutti i percorsi verso ${sectorName}`,
    description: [
      "L'AI analizza il tuo profilo (test, preferenze, formazione) ed esplora i percorsi possibili",
      "— laurea, ITS, bootcamp, apprendistato, autodidatta — confrontando vantaggi, svantaggi e costi.",
    ],
    button: "Esplora i percorsi",
    error: {
      aiUnavailable: "Servizio AI non disponibile. Riprova più tardi.",
      invalidResponse: "Risposta dell'AI non valida. Riprova.",
      emptyResponse: "Risposta dell'AI vuota. Riprova.",
      networkError: "Errore di rete",
    },
  },
  
  // Loading State
  loadingState: {
    title: "Esplorando i percorsi possibili…",
    progressLabel: (progress: number) => `${Math.round(progress)}%`,
  },
  
  // Roadmap Content
  content: {
    // Profile Summary
    profileSummary: {
      title: "Il tuo profilo",
    },
    
    // Path Selector
    pathSelector: {
      title: "Confronta i percorsi possibili",
      alternativesCount: (count: number) => `${count} alternative analizzate`,
    },
    
    // Recommendation Reason
    recommendationReason: {
      title: "Perché ti consigliamo questo percorso",
    },
    
    // Selected Path Details
    selectedPath: {
      title: "Piano selezionato",
      recommendedBadge: "Consigliato",
      fitReason: {
        title: "Adatto a te perché",
        idealProfile: "Profilo ideale:",
      },
    },
    
    // Pros/Cons
    prosCons: {
      pros: "Vantaggi",
      cons: "Svantaggi",
    },
    
    // Phases
    phases: {
      title: "Le fasi di questo percorso",
    },
    
    // Comparison
    comparison: {
      title: "Confronto onesto",
    },
    
    // Alternative Formative Paths
    alternativeFormativePaths: {
      title: "Percorsi formativi laterali",
      description: "Esperienze formative che rafforzano il tuo profilo, indipendentemente dal percorso principale che scegli.",
    },
    
    // Salary Progression
    salaryProgression: {
      title: "Evoluzione salariale",
    },
    
    // Top Roles
    topRoles: {
      title: "Lavori a cui puoi aspirare",
    },
    
    // Key Tip
    keyTip: {
      title: "Consiglio chiave per te",
    },
    
    // Regenerate Button
    regenerateButton: "Rigenera la roadmap",
  },
  
  // Authentication
  auth: {
    title: "Accesso richiesto",
    description: "Registrati gratuitamente per generare la tua roadmap personalizzata.",
    button: "Registrati gratis",
  },
  
  // Phase Card
  phaseCard: {
    // Section Titles
    sectionTitles: {
      actions: "Azioni concrete",
      resources: "Risorse consigliate",
      milestone: "Traguardo",
    },
    
    // Buttons
    buttons: {
      save: "Salva",
      saving: "Salvataggio...",
      cancel: "Annulla",
    },
    
    // Phase Label
    phaseLabel: (phaseNumber: number) => `Fase ${phaseNumber}`,
  },
};

// Error Messages (can be used across the app)
export const ERROR_MESSAGES = {
  generic: {
    saveFailed: "Impossibile salvare le modifiche. Riprova.",
  },
};

// Navigation labels — vocabolario semplice e comprensibile
export const NAV_LABELS = {
  home: "Home",
  test: "Test",
  aree: "Aree",
  lavori: "Offerte",
  offerte: "Offerte",
  piano: "Piano",
  profilo: "Profilo",
  coach: "Coach AI",
  dashboard: "Dashboard",
  idea: "Idea",
  news: "News",
  partner: "Partner",
  mappa: "Mappa",
  chiSiamo: "Chi siamo",
  comeFunziona: "Come funziona",
  crescita: "Crescita",
} as const;
