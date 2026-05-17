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

// ── API Endpoints ──
export const API_ENDPOINTS = {
  auth: {
    login: "/api/auth/login",
    register: "/api/auth/register",
    logout: "/api/auth/logout",
    refresh: "/api/auth/refresh",
    me: "/api/auth/me",
  },
  user: {
    profile: "/api/user/profile",
    updateProfile: "/api/user/profile",
    preferences: "/api/user/preferences",
  },
  test: {
    list: "/api/tests",
    start: "/api/tests/:id/start",
    submit: "/api/tests/:id/submit",
    results: "/api/tests/:id/results",
    saveProgress: "/api/tests/:id/progress",
  },
  roadmap: {
    generate: "/api/roadmap/generate",
    get: "/api/roadmap/:id",
    list: "/api/roadmap",
    update: "/api/roadmap/:id",
    delete: "/api/roadmap/:id",
  },
  graph: {
    nodes: "/api/graph/nodes",
    node: "/api/graph/nodes/:id",
    edges: "/api/graph/edges",
    createNode: "/api/graph/nodes",
    deleteNode: "/api/graph/nodes/:id",
  },
  sector: {
    list: "/api/sectors",
    detail: "/api/sectors/:id",
    roles: "/api/sectors/:id/roles",
  },
  subscription: {
    current: "/api/subscription/current",
    upgrade: "/api/subscription/upgrade",
    cancel: "/api/subscription/cancel",
    webhooks: "/api/subscription/webhooks",
  },
  ai: {
    chat: "/api/ai/chat",
    analyze: "/api/ai/analyze",
    suggest: "/api/ai/suggest",
  },
  notification: {
    list: "/api/notifications",
    markRead: "/api/notifications/:id/read",
    markAllRead: "/api/notifications/read-all",
  },
} as const;

// ── Route Paths ──
export const ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  dashboard: "/dashboard",
  test: "/test",
  testResults: "/test/:id/results",
  roadmap: "/roadmap",
  roadmapDetail: "/roadmap/:id",
  graph: "/graph",
  graphNode: "/graph/node/:id",
  sectors: "/sectors",
  sectorDetail: "/sectors/:id",
  profile: "/profile",
  settings: "/settings",
  subscription: "/subscription",
  pricing: "/pricing",
  wiki: "/wiki",
  wikiArticle: "/wiki/:slug",
  news: "/news",
  newsArticle: "/news/:slug",
  partner: "/partner",
  about: "/about",
  howItWorks: "/how-it-works",
  growth: "/growth",
  idea: "/idea",
  coach: "/coach",
  offers: "/offers",
  offerDetail: "/offers/:id",
  certificates: "/certificates",
  certificateDetail: "/certificates/:id",
  comparison: "/comparison",
  sitemap: "/sitemap",
  agents: "/agents",
  agentDetail: "/agents/:id",
  notFound: "/404",
} as const;

// ── Pagination & Limits ──
export const PAGINATION = {
  defaultPageSize: 20,
  maxPageSize: 100,
  graphNodesPerPage: 50,
  roadmapNodesPerPage: 30,
  offersPerPage: 15,
  newsPerPage: 10,
} as const;

export const LIMITS = {
  freeUser: {
    testsPerDay: 3,
    roadmapGenerationsPerMonth: 5,
    aiMessagesPerDay: 10,
    graphNodes: 50,
    certificates: 10,
  },
  premiumUser: {
    testsPerDay: -1,
    roadmapGenerationsPerMonth: -1,
    aiMessagesPerDay: 100,
    graphNodes: -1,
    certificates: -1,
  },
} as const;

// ── Cache & Timeout ──
export const CACHE_DURATIONS = {
  sectors: 1000 * 60 * 30, // 30 min
  roles: 1000 * 60 * 30,
  graphNodes: 1000 * 60 * 5, // 5 min
  userProfile: 1000 * 60 * 10, // 10 min
  subscription: 1000 * 60 * 5,
  news: 1000 * 60 * 15,
  offers: 1000 * 60 * 10,
} as const;

export const TIMEOUTS = {
  apiRequest: 15000, // 15s
  aiResponse: 30000, // 30s
  aiStream: 60000, // 60s
  fileUpload: 30000,
  websocketReconnect: 5000,
} as const;

// ── Form Validation ──
export const VALIDATION_RULES = {
  email: {
    minLength: 5,
    maxLength: 254,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecial: true,
  },
  name: {
    minLength: 2,
    maxLength: 100,
  },
  bio: {
    maxLength: 500,
  },
  roadmapTitle: {
    minLength: 3,
    maxLength: 200,
  },
  nodeTitle: {
    minLength: 1,
    maxLength: 150,
  },
  nodeDescription: {
    maxLength: 2000,
  },
} as const;

// ── File Upload ──
export const FILE_LIMITS = {
  avatar: { maxSizeMB: 5, allowedTypes: ["image/jpeg", "image/png", "image/webp"] },
  certificate: { maxSizeMB: 10, allowedTypes: ["application/pdf", "image/jpeg", "image/png"] },
  document: { maxSizeMB: 20, allowedTypes: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] },
} as const;

// ── WebSocket ──
export const WS_CONFIG = {
  url: "/ws",
  reconnectAttempts: 5,
  reconnectDelayMs: 3000,
  heartbeatIntervalMs: 30000,
  pongTimeoutMs: 10000,
} as const;

// ── Date & Time ──
export const DATE_FORMATS = {
  short: "DD/MM/YYYY",
  long: "D MMMM YYYY",
  time: "HH:mm",
  dateTime: "D MMM YYYY, HH:mm",
  relative: "relative",
} as const;

export const LOCALE = "it-IT";
export const TIMEZONE = "Europe/Rome";

// ── Pricing ──
export const PRICING = {
  free: {
    name: "Free",
    priceMonthly: 0,
    priceYearly: 0,
    currency: "EUR",
  },
  premium: {
    name: "Premium",
    priceMonthly: 9.99,
    priceYearly: 99.99,
    currency: "EUR",
    discountYearly: 17,
  },
  enterprise: {
    name: "Enterprise",
    priceMonthly: null,
    currency: "EUR",
  },
} as const;

// ── AI Models ──
export const AI_MODELS = {
  default: "gpt-4o-mini",
  advanced: "gpt-4o",
  embedding: "text-embedding-3-small",
} as const;

// ── Graph ──
export const GRAPH_CONFIG = {
  minZoom: 0.1,
  maxZoom: 3,
  defaultZoom: 1,
  nodeWidth: 200,
  nodeHeight: 80,
  edgeAnimationDuration: 1000,
  layoutPadding: 50,
} as const;

// ── Test ──
export const TEST_CONFIG = {
  timePerQuestionSec: 60,
  maxRetries: 3,
  passThreshold: 65,
  questionTypes: ["multiple_choice", "true_false", "open_ended", "ranking"],
} as const;

// ── Animations ──
export const ANIMATION_DURATIONS = {
  fast: 150,
  normal: 300,
  slow: 500,
  pageTransition: 400,
} as const;

export const ANIMATION_EASING = {
  default: "cubic-bezier(0.4, 0, 0.2, 1)",
  bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  smooth: "cubic-bezier(0.25, 0.1, 0.25, 1)",
} as const;
