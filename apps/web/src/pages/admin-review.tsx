import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  AgentsSection,
  AffiliationSection,
  BusinessMetricsSection,
  ConfidenceBadge,
  EntityBadge,
  HomeSection,
  MessagesSection,
  PersistenceWarningBanner,
  PromptsSection,
  QualitySection,
  StatusSection,
  SubscriptionsSection,
  StatusBadge,
  agentStatusClass,
  agentStatusLabel,
  auditActionLabel,
  fmtDate,
  fmtDuration,
  fmtPct,
  fmtScore,
  fmtShortDate,
  fmtUsd,
  formatLastUpdated,
  formatValue,
  humanizeKey,
  payloadDiffs,
  payloadEntries,
  type AgentRun,
  type AgentPrompt,
  type AffiliationInboxResponse,
  type AffiliationLeadItem,
  type AdminOverview,
  type AdminOpsAction,
  type AdminOpsStatus,
  type AdminSubscriptionDetail,
  type AdminSubscriptionItem,
  type AdminSubscriptionPlan,
  type AdminSubscriptionsResponse,
  type AgentsOverview,
  type AgentsTab,
  type AiModelPolicy,
  type BusinessStatusSnapshot,
  type ContactInboxResponse,
  type ContactMessageItem,
  type PersistenceMeta,
  type PromptEditorTab,
  type PromptPreview,
  type PromptValidation,
  type PromptVersion,
  type SidebarSection,
  type SuggestionStatus,
  type WendyQualityOverview,
} from "@/components/admin/console";
import {
  ShieldAlert,
  RefreshCw,
  LogOut,
  Search,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Archive,
  Clock,
  Eye,
  Bot,
  BarChart3,
  FileText,
  Briefcase,
  GraduationCap,
  Calendar,
  TrendingUp,
  Sparkles,
  ClipboardList,
  History,
  Settings,
  Filter,
  ChevronDown,
  Pencil,
  X,
  Play,
  RotateCcw,
  Code2,
  Save,
  ChevronUp,
  Terminal,
  BookOpen,
  Activity,
  Home,
  MessageCircle,
  Handshake,
  Shield,
  Menu,
  Network,
  CreditCard,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const BASE = import.meta.env.BASE_URL || "/";

type Suggestion = {
  id: number;
  agentRunId: number | null;
  entityType: string;
  entityName: string;
  payloadJson: Record<string, unknown> | null;
  confidenceScore: number | null;
  status: SuggestionStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  agentName?: string | null;
  queuePriority?: string | null;
  queueStatus?: string | null;
};

type AuditLogEntry = {
  id: number;
  userId: string | null;
  action: string;
  targetType: string;
  targetId: number | null;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
};

type DashboardStats = {
  pending: number;
  approved: number;
  rejected: number;
  applied?: number;
  archived: number;
  totalRuns: number;
};

type SuggestionDetail = {
  suggestion: Suggestion;
  agentRun: AgentRun | null;
  queueItem: { id: number; queueStatus: string; priority: string } | null;
  auditTrail?: Array<{
    id: number;
    actorId: number | null;
    action: string;
    category: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }>;
};

type MemoryGraphOverview = {
  generatedAt: string;
  health: {
    nodes: number;
    edges: number;
    candidates: number;
    lowConfidenceEdges: number;
    staleEmbeddings: number;
    orphanNodes: number;
  };
  sourceBreakdown: Array<{ sourceType: string; count: number }>;
  candidateRelations: Array<{
    id: number;
    userId: number;
    sourceId: number;
    targetId: number;
    label: string | null;
    relationType: string;
    confidence: number;
    reason: string | null;
    createdAt: string;
    source: { id: number; title: string; type: string; sourceType: string; confidence: number; status: string } | null;
    target: { id: number; title: string; type: string; sourceType: string; confidence: number; status: string } | null;
  }>;
  controls: Array<{ key: string; label: string; description: string }>;
};

type CatalogType = "sectors" | "professions" | "education_paths" | "growth_articles";

type CatalogOverviewItem = {
  type: CatalogType;
  label: string;
  total: number;
  active: number;
  archived: number;
  drafts: number;
};

type CatalogDraft = {
  id: number;
  catalogType: CatalogType;
  entityId: number | null;
  status: "draft" | "published" | "archived";
  payload: Record<string, unknown>;
  notes: string | null;
  createdBy: number | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CatalogPreview = {
  title: string;
  subtitle: string;
  description: string;
  url: string;
  badges: string[];
};

type CatalogResponse = {
  type: CatalogType;
  label: string;
  items: Array<Record<string, any>>;
  drafts: CatalogDraft[];
  persistenceUnavailable?: boolean;
  reason?: string | null;
  setupAction?: string | null;
};

type GrowthQueueStatus = "all" | "draft" | "pending" | "published" | "rejected";

type GrowthArticle = {
  id: number;
  title: string;
  slug: string;
  category: string;
  subcategory: string | null;
  description: string;
  content: string;
  tags: string[];
  difficulty: string;
  status: Exclude<GrowthQueueStatus, "all">;
  readTimeMinutes: number;
  viewCount?: number;
  createdAt: string;
  updatedAt: string;
};

type GrowthQueueResponse = {
  generatedAt?: string;
  queue: GrowthArticle[];
  stats: {
    draft: number;
    pending: number;
    published: number;
    rejected: number;
    total: number;
  };
};

type GrowthArticleDetail = {
  article: GrowthArticle;
  preview: Record<string, any>;
  auditTrail: Array<{
    id: number;
    actorId: number | null;
    action: string;
    category: string | null;
    metadata: Record<string, any> | null;
    createdAt: string;
  }>;
};

const CATALOG_TABS: Array<{ type: CatalogType; label: string; icon: typeof BookOpen }> = [
  { type: "sectors", label: "Settori", icon: BarChart3 },
  { type: "professions", label: "Professioni", icon: Briefcase },
  { type: "education_paths", label: "Percorsi", icon: GraduationCap },
  { type: "growth_articles", label: "Articoli", icon: FileText },
];

const GROWTH_STATUS_FILTERS: Array<{ value: GrowthQueueStatus; label: string }> = [
  { value: "all", label: "Tutti" },
  { value: "draft", label: "Bozze" },
  { value: "pending", label: "Pending" },
  { value: "published", label: "Pubblicati" },
  { value: "rejected", label: "Rifiutati" },
];

const GROWTH_STATUS_UI: Record<Exclude<GrowthQueueStatus, "all">, { label: string; className: string }> = {
  draft: { label: "Bozza", className: "bg-slate-100 text-slate-700 border-slate-200" },
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 border-amber-200" },
  published: { label: "Pubblicato", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  rejected: { label: "Rifiutato", className: "bg-red-100 text-red-800 border-red-200" },
};

const SECTION_BY_PATH: Record<string, SidebarSection> = {
  review: "queue",
  queue: "queue",
  suggestions: "suggestions",
  suggerimenti: "suggestions",
  runs: "agents",
  esecuzioni: "agents",
  logs: "logs",
  settings: "settings",
  impostazioni: "settings",
  agents: "agents",
  "lancia-agenti": "agents",
  prompts: "prompts",
  qualita: "qualita",
  quality: "qualita",
  cataloghi: "cataloghi",
  rag: "cataloghi",
  "agenti-salute": "agents",
  "agent-health": "agents",
  agenti: "agents",
  metriche: "metriche",
  abbonamenti: "abbonamenti",
  subscriptions: "abbonamenti",
  status: "status",
  messaggi: "messaggi",
  crescita: "crescita",
  affiliazione: "affiliazione",
  "cervello-wendy": "memory",
  "memory-graph": "memory",
};

const PATH_BY_SECTION: Record<SidebarSection, string> = {
  home: "/admin",
  queue: "/admin/review",
  suggestions: "/admin/suggestions",
  runs: "/admin/runs",
  logs: "/admin/logs",
  settings: "/admin/settings",
  agents: "/admin/agenti",
  prompts: "/admin/prompts",
  qualita: "/admin/qualita",
  cataloghi: "/admin/cataloghi",
  "agenti-salute": "/admin/agenti",
  metriche: "/admin/metriche",
  abbonamenti: "/admin/abbonamenti",
  status: "/admin/status",
  messaggi: "/admin/messaggi",
  crescita: "/admin/crescita",
  affiliazione: "/admin/affiliazione",
  memory: "/admin/cervello-wendy",
};

const TITLE_BY_SECTION: Record<SidebarSection, string> = {
  home: "Panoramica Admin",
  queue: "Queue Revisione",
  suggestions: "Tutti i Suggerimenti",
  runs: "Agenti",
  logs: "Audit Log",
  settings: "Impostazioni",
  agents: "Agenti",
  prompts: "Gestione Prompt AI",
  qualita: "Qualita Wendy",
  cataloghi: "Cataloghi",
  "agenti-salute": "Agenti",
  metriche: "Metriche Business",
  abbonamenti: "Abbonamenti Utenti",
  status: "Status & Setup",
  messaggi: "Messaggi",
  crescita: "Coda Crescita",
  affiliazione: "Partner & Affiliazioni",
  memory: "Cervello Wendy",
};

const ADMIN_NAV_GROUPS: Array<{
  label: string;
  items: Array<{
    key: SidebarSection;
    label: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    count?: (stats: DashboardStats | null) => number | undefined;
  }>;
}> = [
  {
    label: "Operativo",
    items: [
      { key: "home", label: "Panoramica", icon: Home },
      { key: "queue", label: "Queue Revisione", icon: ClipboardList, count: (stats) => stats?.pending },
      { key: "suggestions", label: "Suggerimenti", icon: Bot },
      { key: "messaggi", label: "Messaggi", icon: MessageCircle },
    ],
  },
  {
    label: "AI / Wendy",
    items: [
      { key: "agents", label: "Agenti", icon: Activity },
      { key: "memory", label: "Cervello Wendy", icon: Network },
      { key: "prompts", label: "Prompt Agenti", icon: Code2 },
      { key: "qualita", label: "Qualita Wendy", icon: BarChart3 },
    ],
  },
  {
    label: "Contenuti",
    items: [
      { key: "cataloghi", label: "Cataloghi", icon: BookOpen },
      { key: "crescita", label: "Coda Crescita", icon: Sparkles },
    ],
  },
  {
    label: "Business",
    items: [
      { key: "metriche", label: "Metriche Business", icon: BarChart3 },
      { key: "abbonamenti", label: "Abbonamenti", icon: CreditCard },
      { key: "affiliazione", label: "Partner", icon: Handshake },
    ],
  },
  {
    label: "Sistema",
    items: [
      { key: "status", label: "Status & Setup", icon: Settings },
      { key: "logs", label: "Audit Log", icon: FileText },
      { key: "settings", label: "Impostazioni", icon: Settings },
    ],
  },
];

function sectionFromLocation(pathname: string): SidebarSection {
  const segment = pathname.split("/").filter(Boolean)[1];
  return segment ? (SECTION_BY_PATH[segment] ?? "home") : "home";
}

function defaultCatalogPayload(type: CatalogType): Record<string, unknown> {
  if (type === "sectors") {
    return {
      name: "",
      description: "",
      riasecTypes: [],
      skills: [],
      avgSalaryMin: 25000,
      avgSalaryMax: 45000,
      growthRate: 5,
      automationRisk: "medium",
      scalability: "medium",
      trend: "stable",
      timeToAutonomy: "6-12 mesi",
      advantages: [],
      disadvantages: [],
      opportunities: [],
      icon: "briefcase",
      color: "#6366f1",
      isActive: true,
      workMode: ["dipendente", "ibrido"],
      autonomyScore: 5,
      stabilityScore: 5,
      clientAcquisitionRequired: false,
      freelanceSteps: [],
      dipendentiSteps: [],
      remoteFriendly: true,
    };
  }
  if (type === "professions") {
    return {
      title: "",
      sector: "",
      sectorId: null,
      description: "",
      riasecFit: [],
      skills: [],
      workModes: [],
      salaryRange: "",
      growthOutlook: "",
      autonomyScore: 5,
      stabilityScore: 5,
      isActive: true,
    };
  }
  if (type === "education_paths") {
    return {
      path: "",
      type: "online",
      duration: "",
      cost: "",
      steps: [],
      careerOutcomes: [],
      sectorFit: [],
      professionIds: [],
      isActive: true,
    };
  }
  return {
    title: "",
    slug: "",
    category: "",
    subcategory: "",
    description: "",
    content: "",
    tags: [],
    difficulty: "base",
    personalityMatches: [],
    sectorLinks: [],
    status: "draft",
    readTimeMinutes: 3,
  };
}

function catalogTitle(type: CatalogType, item: Record<string, any>) {
  if (type === "sectors") return item.name ?? `Settore #${item.id}`;
  if (type === "professions") return item.title ?? `Professione #${item.id}`;
  if (type === "education_paths") return item.path ?? `Percorso #${item.id}`;
  return item.title ?? `Articolo #${item.id}`;
}

function catalogDescription(type: CatalogType, item: Record<string, any>) {
  if (type === "education_paths") return `${item.type ?? "percorso"} · ${item.duration ?? "durata n/d"} · ${item.cost ?? "costo n/d"}`;
  if (type === "growth_articles") return `${item.category ?? "categoria"} · ${item.status ?? "draft"} · ${item.readTimeMinutes ?? 0} min`;
  return item.description ?? item.sector ?? "";
}

function isCatalogArchived(type: CatalogType, item: Record<string, any>) {
  if (type === "growth_articles") return item.status === "archived";
  return item.isActive === false;
}

function growthArticleToForm(article: GrowthArticle | null): Record<string, any> {
  return {
    title: article?.title ?? "",
    slug: article?.slug ?? "",
    category: article?.category ?? "",
    subcategory: article?.subcategory ?? "",
    description: article?.description ?? "",
    content: article?.content ?? "",
    tags: article?.tags ?? [],
    difficulty: article?.difficulty ?? "base",
    readTimeMinutes: article?.readTimeMinutes ?? 3,
  };
}

function growthStatusBadge(status: GrowthArticle["status"]) {
  const cfg = GROWTH_STATUS_UI[status] ?? GROWTH_STATUS_UI.draft;
  return <Badge variant="outline" className={cn("capitalize", cfg.className)}>{cfg.label}</Badge>;
}

export default function AdminReview() {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    document.title = "Admin Console - NorthStar";
  }, []);

  const { token, isLoggedIn, logout, user } = useAuth();

  const [section, setSection] = useState<SidebarSection>(() =>
    sectionFromLocation(location),
  );
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsTotal, setSuggestionsTotal] = useState(0);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminForbidden, setAdminForbidden] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [detail, setDetail] = useState<SuggestionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterEntity, setFilterEntity] = useState<string>("all");
  const [filterConfidence, setFilterConfidence] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [showEditNotes, setShowEditNotes] = useState(false);
  const [showTechnicalData, setShowTechnicalData] = useState(false);

  const [agentsRunning, setAgentsRunning] = useState<Set<string>>(new Set());
  const [agentsResult, setAgentsResult] = useState<
    Record<string, { ok: boolean; data: Record<string, unknown> }>
  >({});
  const [newsSectorInput, setNewsSectorInput] = useState("");
  const [agentsOverviewData, setAgentsOverviewData] = useState<AgentsOverview | null>(null);
  const [agentsOverviewLoading, setAgentsOverviewLoading] = useState(false);
  const [agentsTab, setAgentsTab] = useState<AgentsTab>("overview");
  const [agentFilter, setAgentFilter] = useState("all");
  const [agentStatusFilter, setAgentStatusFilter] = useState("all");
  const [agentDays, setAgentDays] = useState("30");

  const [prompts, setPrompts] = useState<AgentPrompt[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [promptExpandedKey, setPromptExpandedKey] = useState<string | null>(
    null,
  );
  const [promptTab, setPromptTab] = useState<PromptEditorTab>("editor");
  const [promptEditValues, setPromptEditValues] = useState<
    Record<string, string>
  >({});
  const [promptNotes, setPromptNotes] = useState<Record<string, string>>({});
  const [promptVersions, setPromptVersions] = useState<Record<string, PromptVersion[]>>({});
  const [promptPreview, setPromptPreview] = useState<Record<string, PromptPreview>>({});
  const [promptVersionPersistence, setPromptVersionPersistence] = useState<Record<string, PersistenceMeta>>({});
  const [promptSaving, setPromptSaving] = useState<Set<string>>(new Set());
  const [aiModelPolicy, setAiModelPolicy] = useState<AiModelPolicy | null>(null);

// Qualita section
const [qualitaData, setQualitaData] = useState<WendyQualityOverview | null>(null);
const [qualitaLoading, setQualitaLoading] = useState(false);
const [qualitaDays, setQualitaDays] = useState("30");

// Cataloghi section
const [cataloghiOverview, setCataloghiOverview] = useState<CatalogOverviewItem[]>([]);
const [cataloghiData, setCataloghiData] = useState<CatalogResponse | null>(null);
const [cataloghiLoading, setCataloghiLoading] = useState(false);
const [catalogType, setCatalogType] = useState<CatalogType>("sectors");
const [catalogSearch, setCatalogSearch] = useState("");
const [catalogStatus, setCatalogStatus] = useState("all");
const [catalogSelected, setCatalogSelected] = useState<Record<string, any> | null>(null);
const [catalogDraftId, setCatalogDraftId] = useState<number | null>(null);
const [catalogPayloadText, setCatalogPayloadText] = useState(
  JSON.stringify(defaultCatalogPayload("sectors"), null, 2),
);
const [catalogNotes, setCatalogNotes] = useState("");
const [catalogPreview, setCatalogPreview] = useState<CatalogPreview | null>(null);
const [catalogFields, setCatalogFields] = useState<Record<string, string>>({});
const [catalogActionLoading, setCatalogActionLoading] = useState<string | null>(null);
const [catalogAuditTrail, setCatalogAuditTrail] = useState<any[]>([]);
const [catalogPersistence, setCatalogPersistence] = useState<PersistenceMeta>({});

// Agenti salute section
const [agentiSaluteData, setAgentiSaluteData] = useState<any | null>(null);
const [agentiSaluteLoading, setAgentiSaluteLoading] = useState(false);

// Metriche section
const [metricheData, setMetricheData] = useState<BusinessStatusSnapshot | null>(null);
const [metricheLoading, setMetricheLoading] = useState(false);

// Abbonamenti section
const [abbonamentiData, setAbbonamentiData] = useState<AdminSubscriptionsResponse | null>(null);
const [abbonamentiDetail, setAbbonamentiDetail] = useState<AdminSubscriptionDetail | null>(null);
const [abbonamentiLoading, setAbbonamentiLoading] = useState(false);
const [abbonamentiDetailLoading, setAbbonamentiDetailLoading] = useState(false);
const [abbonamentiActionLoading, setAbbonamentiActionLoading] = useState(false);
const [abbonamentiSearch, setAbbonamentiSearch] = useState("");
const [abbonamentiPlan, setAbbonamentiPlan] = useState("all");
const [abbonamentiStatus, setAbbonamentiStatus] = useState("all");
const [abbonamentiFields, setAbbonamentiFields] = useState<Record<string, string>>({});
const [abbonamentiForm, setAbbonamentiForm] = useState<{
  plan: AdminSubscriptionPlan;
  validUntil: string;
  reason: string;
}>({ plan: "free", validUntil: "", reason: "" });

// Home section
const [homeData, setHomeData] = useState<AdminOverview | null>(null);
const [homeLoading, setHomeLoading] = useState(false);

// Status section
const [statusData, setStatusData] = useState<BusinessStatusSnapshot | null>(null);
const [statusLoading, setStatusLoading] = useState(false);
const [opsData, setOpsData] = useState<AdminOpsStatus | null>(null);
const [opsLoading, setOpsLoading] = useState(false);
const [opsActionLoading, setOpsActionLoading] = useState<string | null>(null);
const [opsError, setOpsError] = useState<string | null>(null);

// Messaggi section
const [messaggiData, setMessaggiData] = useState<ContactInboxResponse | null>(null);
const [messaggiLoading, setMessaggiLoading] = useState(false);
const [messaggiStatus, setMessaggiStatus] = useState("all");
const [messaggiRead, setMessaggiRead] = useState("all");
const [messaggiAssignedTo, setMessaggiAssignedTo] = useState("all");
const [messaggiSearch, setMessaggiSearch] = useState("");
const [messaggioSelected, setMessaggioSelected] = useState<ContactMessageItem | null>(null);
const [messaggioNotes, setMessaggioNotes] = useState("");
const [messaggioActionLoading, setMessaggioActionLoading] = useState<string | null>(null);

// Crescita section
const [crescitaData, setCrescitaData] = useState<GrowthQueueResponse | null>(null);
const [crescitaLoading, setCrescitaLoading] = useState(false);
const [crescitaStatus, setCrescitaStatus] = useState<GrowthQueueStatus>("all");
const [crescitaSearch, setCrescitaSearch] = useState("");
const [crescitaSelected, setCrescitaSelected] = useState<GrowthArticleDetail | null>(null);
const [crescitaForm, setCrescitaForm] = useState<Record<string, any>>(growthArticleToForm(null));
const [crescitaFields, setCrescitaFields] = useState<Record<string, string>>({});
const [crescitaActionLoading, setCrescitaActionLoading] = useState<string | null>(null);
const [crescitaRejectReason, setCrescitaRejectReason] = useState("");
const [crescitaPreview, setCrescitaPreview] = useState<Record<string, any> | null>(null);

// Affiliazione section
const [affiliazioneData, setAffiliazioneData] = useState<AffiliationInboxResponse | null>(null);
const [affiliazioneLoading, setAffiliazioneLoading] = useState(false);
const [affiliazioneStatus, setAffiliazioneStatus] = useState("all");
const [affiliazioneRead, setAffiliazioneRead] = useState("all");
const [affiliazioneSource, setAffiliazioneSource] = useState("all");
const [affiliazioneAssignedTo, setAffiliazioneAssignedTo] = useState("all");
const [affiliazioneSearch, setAffiliazioneSearch] = useState("");
const [affiliazioneSelected, setAffiliazioneSelected] = useState<AffiliationLeadItem | null>(null);
const [affiliazioneNotes, setAffiliazioneNotes] = useState("");
const [affiliazioneActionLoading, setAffiliazioneActionLoading] = useState<string | null>(null);

// Cervello Wendy / memory graph
const [memoryData, setMemoryData] = useState<MemoryGraphOverview | null>(null);
const [memoryLoading, setMemoryLoading] = useState(false);
const [memoryBackfillUserId, setMemoryBackfillUserId] = useState("");
const [memoryActionLoading, setMemoryActionLoading] = useState<string | null>(null);

  const apiFetch = useCallback(
    async (path: string, options?: RequestInit) => {
      if (!token || adminForbidden) {
        throw new Error("auth");
      }

      const res = await fetch(`${BASE}api${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(options?.headers || {}),
        },
      });
      if (res.status === 401) {
        logout();
        throw new Error("auth");
      }
      if (res.status === 403) {
        setAdminForbidden(true);
        setAdminError("Accesso non autorizzato: il tuo account non ha il ruolo admin.");
        throw new Error("forbidden");
      }
      if (!res.ok) {
        let errorBody: any = null;
        try {
          errorBody = await res.json();
        } catch {
          errorBody = null;
        }
        const message =
          errorBody?.error ?? `Errore ${res.status} durante il caricamento della console admin.`;
        setAdminError(message);
        const error = new Error(message) as Error & { fields?: Record<string, string> };
        error.fields = errorBody?.fields;
        throw error;
      }
      const data = await res.json();
      setAdminError(null);
      setLastUpdatedAt(new Date().toISOString());
      return data;
    },
    [adminForbidden, logout, token],
  );

  const openStatusSetup = useCallback(() => {
    setSection("status");
    setLocation("/admin/status");
  }, [setLocation]);

  const loadStats = useCallback(async () => {
    try {
      const data = await apiFetch("/admin/stats");
      setStats(data);

    } catch {
      /* handled by apiFetch */
    }
  }, [apiFetch]);

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (section === "queue") params.set("status", "pending_review");
      else if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterEntity !== "all") params.set("entity_type", filterEntity);
      if (filterConfidence !== "all") params.set("confidence_min", filterConfidence);
      if (searchTerm) params.set("search", searchTerm);
      params.set("limit", "100");
      const data = await apiFetch(`/admin/suggestions?${params}`);
      setSuggestions(data.items);
      setSuggestionsTotal(data.total);

    } catch {
      /* handled */
    }
    setLoading(false);
  }, [apiFetch, filterStatus, filterEntity, filterConfidence, searchTerm, section]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/admin/logs?limit=100");
      setLogs(data);

    } catch {
      /* handled */
    }
    setLoading(false);
  }, [apiFetch]);

  const loadDetail = useCallback(
    async (id: number) => {
      setDetailLoading(true);
      try {
      const data = await apiFetch(`/admin/suggestions/${id}`);
      setDetail(data);
      setShowTechnicalData(false);
      } catch {
        /* handled */
      }
      setDetailLoading(false);
    },
    [apiFetch],
  );

  const loadPrompts = useCallback(async () => {
    setPromptsLoading(true);
    try {
      const [data, policyData] = await Promise.all([
        apiFetch("/admin/prompts"),
        apiFetch("/admin/ai/model-policy"),
      ]);
      setPrompts(data as AgentPrompt[]);
      setAiModelPolicy((policyData as { policy?: AiModelPolicy | null }).policy ?? null);
      const vals: Record<string, string> = {};
      const notes: Record<string, string> = {};
      for (const p of data as AgentPrompt[]) {
        vals[p.key] = p.draftValue ?? p.currentValue;
        notes[p.key] = "";
      }
      setPromptEditValues(vals);
      setPromptNotes(notes);

    } catch {
      /* handled */
    }
    setPromptsLoading(false);
  }, [apiFetch]);

  const loadPromptVersions = useCallback(
    async (key: string) => {
      try {
        const data = await apiFetch(`/admin/prompts/${key}/versions`) as {
          versions?: PromptVersion[];
        } & PersistenceMeta;
        setPromptVersions((prev) => ({
          ...prev,
          [key]: (data.versions ?? []) as PromptVersion[],
        }));
        setPromptVersionPersistence((prev) => ({
          ...prev,
          [key]: {
            persistenceUnavailable: data.persistenceUnavailable,
            reason: data.reason,
            setupAction: data.setupAction,
          },
        }));
      } catch {
        /* handled */
      }
    },
    [apiFetch],
  );

  const loadPromptPreview = useCallback(
    async (key: string) => {
      setPromptSaving((prev) => new Set(prev).add(`${key}:preview`));
      try {
        const data = await apiFetch(`/admin/prompts/${key}/preview`, {
          method: "POST",
          body: JSON.stringify({ value: promptEditValues[key] ?? "" }),
        });
        setPromptPreview((prev) => ({
          ...prev,
          [key]: data as PromptPreview,
        }));
      } catch {
        /* handled */
      }
      setPromptSaving((prev) => {
        const s = new Set(prev);
        s.delete(`${key}:preview`);
        return s;
      });
    },
    [apiFetch, promptEditValues],
  );

  const loadAgentsOverview = useCallback(async () => {
    setAgentsOverviewLoading(true);
    try {
      const data = await apiFetch(`/admin/agents/overview?days=${agentDays}&limit=100`);
      setAgentsOverviewData(data as AgentsOverview);

    } catch {
      /* handled */
    }
    setAgentsOverviewLoading(false);
  }, [agentDays, apiFetch]);

  const loadMemoryGraph = useCallback(async () => {
    setMemoryLoading(true);
    try {
      const data = await apiFetch("/admin/memory-graph/overview");
      setMemoryData(data as MemoryGraphOverview);
    } catch {
      /* handled */
    }
    setMemoryLoading(false);
  }, [apiFetch]);

  const loadQualita = useCallback(async () => {
    setQualitaLoading(true);
    try {
      const data = await apiFetch(`/admin/quality/overview?days=${qualitaDays}&limit=50`);
      setQualitaData(data as WendyQualityOverview);

    } catch {
      /* handled */
    }
    setQualitaLoading(false);
  }, [apiFetch, qualitaDays]);

  const loadCataloghi = useCallback(async () => {
    setCataloghiLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (catalogSearch.trim()) params.set("search", catalogSearch.trim());
      if (catalogStatus !== "all") params.set("status", catalogStatus);
      const [overview, data] = await Promise.all([
        apiFetch("/admin/catalogs/overview"),
        apiFetch(`/admin/catalogs/${catalogType}?${params}`),
      ]);
      setCataloghiOverview((overview.items ?? []) as CatalogOverviewItem[]);
      setCataloghiData(data as CatalogResponse);
      setCatalogPersistence({
        persistenceUnavailable: Boolean(overview.persistenceUnavailable || data.persistenceUnavailable),
        reason: overview.reason ?? data.reason ?? null,
        setupAction: overview.setupAction ?? data.setupAction ?? null,
      });

    } catch {
      /* handled */
    }
    setCataloghiLoading(false);
  }, [apiFetch, catalogSearch, catalogStatus, catalogType]);

  const openCatalogDraft = useCallback((type: CatalogType) => {
    setCatalogType(type);
    setCatalogSelected(null);
    setCatalogDraftId(null);
    setCatalogFields({});
    setCatalogPreview(null);
    setCatalogAuditTrail([]);
    setCatalogNotes("");
    setCatalogPayloadText(JSON.stringify(defaultCatalogPayload(type), null, 2));
  }, []);

  const openCatalogItem = useCallback(
    async (item: Record<string, any>) => {
      setCatalogSelected(item);
      setCatalogDraftId(null);
      setCatalogFields({});
      setCatalogPreview(null);
      setCatalogNotes("");
      setCatalogPayloadText(JSON.stringify(item, null, 2));
      setCatalogActionLoading(`detail:${item.id}`);
      try {
        const detailData = await apiFetch(`/admin/catalogs/${catalogType}/${item.id}`);
        const entity = (detailData.entity ?? item) as Record<string, any>;
        setCatalogSelected(entity);
        setCatalogPayloadText(JSON.stringify(entity, null, 2));
        setCatalogAuditTrail(detailData.auditTrail ?? []);
      } catch {
        /* handled */
      }
      setCatalogActionLoading(null);
    },
    [apiFetch, catalogType],
  );

  const parseCatalogPayload = useCallback(() => {
    try {
      const parsed = JSON.parse(catalogPayloadText);
      setCatalogFields({});
      return parsed as Record<string, unknown>;
    } catch {
      setCatalogFields({ json: "JSON non valido: correggi la sintassi prima di continuare." });
      return null;
    }
  }, [catalogPayloadText]);

  const runCatalogAction = useCallback(
    async (action: "preview" | "draft" | "publish" | "archive" | "restore") => {
      const selectedId = Number(catalogSelected?.id);
      const payload = parseCatalogPayload();
      if ((action === "preview" || action === "draft") && !payload) return;
      if ((action === "archive" || action === "restore") && !selectedId) {
        setCatalogFields({ item: "Seleziona un elemento gia pubblicato." });
        return;
      }
      if (action === "publish" && !catalogDraftId && !selectedId) {
        setCatalogFields({ draft: "Salva una bozza prima di pubblicare un nuovo elemento." });
        return;
      }

      setCatalogActionLoading(action);
      try {
        let data: any;
        if (action === "preview") {
          data = await apiFetch(`/admin/catalogs/${catalogType}/preview`, {
            method: "POST",
            body: JSON.stringify({ payload }),
          });
          setCatalogPreview(data.preview as CatalogPreview);
        } else if (action === "draft") {
          const path = selectedId
            ? `/admin/catalogs/${catalogType}/${selectedId}/draft`
            : `/admin/catalogs/${catalogType}/draft`;
          data = await apiFetch(path, {
            method: "POST",
            body: JSON.stringify({ payload, notes: catalogNotes }),
          });
          setCatalogDraftId(data.draft?.id ?? null);
          setCatalogPreview(data.preview as CatalogPreview);
          await loadCataloghi();
        } else if (action === "publish") {
          const publishId = catalogDraftId ?? selectedId;
          data = await apiFetch(`/admin/catalogs/${catalogType}/${publishId}/publish`, {
            method: "POST",
            body: JSON.stringify({ notes: catalogNotes }),
          });
          setCatalogSelected(data.entity ?? null);
          setCatalogDraftId(null);
          setCatalogPayloadText(JSON.stringify(data.entity ?? payload, null, 2));
          await loadCataloghi();
        } else {
          data = await apiFetch(`/admin/catalogs/${catalogType}/${selectedId}/${action}`, {
            method: "POST",
            body: JSON.stringify({ notes: catalogNotes }),
          });
          setCatalogSelected(data.entity ?? null);
          setCatalogPayloadText(JSON.stringify(data.entity ?? payload, null, 2));
          await loadCataloghi();
        }
        setCatalogFields({});
      } catch (err) {
        const error = err as Error & { fields?: Record<string, string> };
        setCatalogFields(error.fields ?? { general: error.message });
      }
      setCatalogActionLoading(null);
    },
    [
      apiFetch,
      catalogDraftId,
      catalogNotes,
      catalogPayloadText,
      catalogSelected,
      catalogType,
      loadCataloghi,
      parseCatalogPayload,
    ],
  );

  const loadAgentiSalute = useCallback(async () => {
    setAgentiSaluteLoading(true);
    try {
      const data = await apiFetch("/admin/agent-health");
      setAgentiSaluteData(data);

    } catch {
      /* handled */
    }
    setAgentiSaluteLoading(false);
  }, [apiFetch]);

  const loadMetriche = useCallback(async () => {
    setMetricheLoading(true);
    try {
      const data = await apiFetch("/admin/business-status?days=30");
      setMetricheData(data);

    } catch {
      /* handled */
    }
    setMetricheLoading(false);
  }, [apiFetch]);

  const loadAbbonamenti = useCallback(async () => {
    setAbbonamentiLoading(true);
    try {
      const params = new URLSearchParams();
      if (abbonamentiSearch.trim()) params.set("search", abbonamentiSearch.trim());
      if (abbonamentiPlan !== "all") params.set("plan", abbonamentiPlan);
      if (abbonamentiStatus !== "all") params.set("status", abbonamentiStatus);
      const query = params.toString();
      const data = await apiFetch(`/admin/subscriptions${query ? `?${query}` : ""}`);
      setAbbonamentiData(data as AdminSubscriptionsResponse);

    } catch {
      /* handled */
    }
    setAbbonamentiLoading(false);
  }, [abbonamentiPlan, abbonamentiSearch, abbonamentiStatus, apiFetch]);

  const loadAbbonamentiDetail = useCallback(
    async (userId: number) => {
      setAbbonamentiDetailLoading(true);
      setAbbonamentiFields({});
      try {
        const data = await apiFetch(`/admin/subscriptions/${userId}`) as AdminSubscriptionDetail;
        setAbbonamentiDetail(data);
        setAbbonamentiForm({
          plan: data.current.plan,
          validUntil: data.current.validUntil ? new Date(data.current.validUntil).toISOString().slice(0, 10) : "",
          reason: "",
        });
      } catch {
        /* handled */
      }
      setAbbonamentiDetailLoading(false);
    },
    [apiFetch],
  );

  const saveAbbonamento = useCallback(async () => {
    if (!abbonamentiDetail?.user?.id) return;
    setAbbonamentiActionLoading(true);
    setAbbonamentiFields({});
    try {
      const data = await apiFetch(`/admin/subscriptions/${abbonamentiDetail.user.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          plan: abbonamentiForm.plan,
          validUntil: abbonamentiForm.plan === "free" || !abbonamentiForm.validUntil
            ? null
            : new Date(`${abbonamentiForm.validUntil}T23:59:59`).toISOString(),
          reason: abbonamentiForm.reason,
        }),
      }) as { detail?: AdminSubscriptionDetail };
      if (data.detail) {
        setAbbonamentiDetail(data.detail);
        setAbbonamentiForm({
          plan: data.detail.current.plan,
          validUntil: data.detail.current.validUntil ? new Date(data.detail.current.validUntil).toISOString().slice(0, 10) : "",
          reason: "",
        });
      }
      await loadAbbonamenti();
    } catch (error: any) {
      setAbbonamentiFields(error?.fields ?? { general: error?.message ?? "Salvataggio non riuscito." });
    }
    setAbbonamentiActionLoading(false);
  }, [abbonamentiDetail, abbonamentiForm, apiFetch, loadAbbonamenti]);

  const loadHome = useCallback(async () => {
    setHomeLoading(true);
    try {
      const data = await apiFetch("/admin/overview");
      setHomeData(data);

    } catch {
      /* handled */
    }
    setHomeLoading(false);
  }, [apiFetch]);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const data = await apiFetch("/admin/business-status?days=30");
      setStatusData(data);

    } catch {
      /* handled */
    }
    setStatusLoading(false);
  }, [apiFetch]);

  const loadOpsStatus = useCallback(async () => {
    setOpsLoading(true);
    setOpsError(null);
    try {
      const data = await apiFetch("/admin/ops/status") as AdminOpsStatus;
      setOpsData(data);
    } catch (error: any) {
      setOpsError(error?.message ?? "Stato operativo non disponibile.");
    }
    setOpsLoading(false);
  }, [apiFetch]);

  const runOpsAction = useCallback(async (action: AdminOpsAction, confirmation: string) => {
    const endpointByAction: Record<AdminOpsAction, string> = {
      "server-start": "/admin/ops/server/start",
      "server-stop": "/admin/ops/server/stop",
      "server-restart": "/admin/ops/server/restart",
      "database-restart": "/admin/ops/database/restart",
    };
    setOpsActionLoading(action);
    setOpsError(null);
    try {
      await apiFetch(endpointByAction[action], {
        method: "POST",
        body: JSON.stringify({ confirmation }),
      });
      await loadOpsStatus();
    } catch (error: any) {
      setOpsError(error?.message ?? "Operazione non riuscita.");
    }
    setOpsActionLoading(null);
  }, [apiFetch, loadOpsStatus]);

  const toggleMaintenanceMode = useCallback(async (enabled: boolean) => {
    setOpsActionLoading("database-maintenance");
    setOpsError(null);
    try {
      await apiFetch("/admin/ops/database/maintenance", {
        method: "POST",
        body: JSON.stringify({
          enabled,
          reason: enabled ? "Attivata dalla console Admin" : "Disattivata dalla console Admin",
        }),
      });
      await loadOpsStatus();
    } catch (error: any) {
      setOpsError(error?.message ?? "Maintenance mode non aggiornata.");
    }
    setOpsActionLoading(null);
  }, [apiFetch, loadOpsStatus]);

  const loadMessaggi = useCallback(async () => {
    setMessaggiLoading(true);
    try {
      const params = new URLSearchParams();
      if (messaggiStatus !== "all") params.set("status", messaggiStatus);
      if (messaggiRead !== "all") params.set("read", messaggiRead);
      if (messaggiAssignedTo !== "all") params.set("assignedTo", messaggiAssignedTo);
      if (messaggiSearch.trim()) params.set("search", messaggiSearch.trim());
      const data = await apiFetch(`/contact/messages?${params.toString()}`);
      setMessaggiData(data);

    } catch {
      /* handled */
    }
    setMessaggiLoading(false);
  }, [apiFetch, messaggiAssignedTo, messaggiRead, messaggiSearch, messaggiStatus]);

  const loadCrescita = useCallback(async () => {
    setCrescitaLoading(true);
    try {
      const params = new URLSearchParams();
      if (crescitaStatus !== "all") params.set("status", crescitaStatus);
      if (crescitaSearch.trim()) params.set("search", crescitaSearch.trim());
      const query = params.toString();
      const data = await apiFetch(`/admin/growth-queue${query ? `?${query}` : ""}`);
      setCrescitaData(data);

    } catch {
      /* handled */
    }
    setCrescitaLoading(false);
  }, [apiFetch, crescitaSearch, crescitaStatus]);

  const loadCrescitaDetail = useCallback(
    async (id: number) => {
      setCrescitaActionLoading("detail");
      setCrescitaFields({});
      try {
        const data = await apiFetch(`/admin/growth-queue/${id}`);
        setCrescitaSelected(data);
        setCrescitaForm(growthArticleToForm(data.article));
        setCrescitaPreview(data.preview ?? null);
        setCrescitaRejectReason("");
      } catch {
        /* handled */
      }
      setCrescitaActionLoading(null);
    },
    [apiFetch],
  );

  const handleCrescitaAction = useCallback(
    async (action: "save" | "preview" | "publish" | "reject") => {
      if (!crescitaSelected?.article?.id) return;
      const id = crescitaSelected.article.id;
      setCrescitaActionLoading(action);
      setCrescitaFields({});
      try {
        const payload = {
          ...crescitaForm,
          tags: Array.isArray(crescitaForm.tags)
            ? crescitaForm.tags
            : String(crescitaForm.tags ?? "")
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
          readTimeMinutes: Number(crescitaForm.readTimeMinutes) || 1,
        };
        let data: any;
        if (action === "save") {
          data = await apiFetch(`/admin/growth-queue/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ payload }),
          });
        } else if (action === "preview") {
          data = await apiFetch(`/admin/growth-queue/${id}/preview`, {
            method: "POST",
            body: JSON.stringify({ payload }),
          });
        } else if (action === "publish") {
          data = await apiFetch(`/admin/growth-queue/${id}/publish`, { method: "POST" });
        } else {
          data = await apiFetch(`/admin/growth-queue/${id}/reject`, {
            method: "POST",
            body: JSON.stringify({ reason: crescitaRejectReason }),
          });
        }
        if (data.preview) setCrescitaPreview(data.preview);
        if (data.article) {
          await loadCrescita();
          await loadCrescitaDetail(data.article.id);
        }
      } catch (error: any) {
        setCrescitaFields(error?.fields ?? {});
      }
      setCrescitaActionLoading(null);
    },
    [apiFetch, crescitaForm, crescitaRejectReason, crescitaSelected, loadCrescita, loadCrescitaDetail],
  );

  const loadAffiliazione = useCallback(async () => {
    setAffiliazioneLoading(true);
    try {
      const params = new URLSearchParams();
      if (affiliazioneStatus !== "all") params.set("status", affiliazioneStatus);
      if (affiliazioneRead !== "all") params.set("read", affiliazioneRead);
      if (affiliazioneSource !== "all") params.set("source", affiliazioneSource);
      if (affiliazioneAssignedTo !== "all") params.set("assignedTo", affiliazioneAssignedTo);
      if (affiliazioneSearch.trim()) params.set("search", affiliazioneSearch.trim());
      const data = await apiFetch(`/affiliazione/leads?${params.toString()}`);
      setAffiliazioneData(data);

    } catch {
      /* handled */
    }
    setAffiliazioneLoading(false);
  }, [affiliazioneAssignedTo, affiliazioneRead, affiliazioneSearch, affiliazioneSource, affiliazioneStatus, apiFetch]);

  const updateMessaggio = useCallback(
    async (id: number, path: "read" | "status" | "notes" | "assign", body: Record<string, unknown>) => {
      setMessaggioActionLoading(path);
      try {
        const updated = await apiFetch(`/contact/messages/${id}/${path}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setMessaggioSelected(updated);
        setMessaggioNotes(updated.internalNotes ?? "");
        await loadMessaggi();
      } catch {
        /* handled */
      }
      setMessaggioActionLoading(null);
    },
    [apiFetch, loadMessaggi],
  );

  const updateAffiliazione = useCallback(
    async (id: number, path: "read" | "status" | "notes" | "assign", body: Record<string, unknown>) => {
      setAffiliazioneActionLoading(path);
      try {
        const updated = await apiFetch(`/affiliazione/leads/${id}/${path}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setAffiliazioneSelected(updated);
        setAffiliazioneNotes(updated.internalNotes ?? "");
        await loadAffiliazione();
      } catch {
        /* handled */
      }
      setAffiliazioneActionLoading(null);
    },
    [apiFetch, loadAffiliazione],
  );

  const triggerAgent = useCallback(
    async (agentKey: string, path: string, body?: Record<string, unknown>) => {
      if (agentsRunning.has(agentKey)) return;
      setAgentsRunning((prev) => new Set(prev).add(agentKey));
      setAgentsResult((prev) => ({
        ...prev,
        [agentKey]: { ok: false, data: { status: "running..." } },
      }));
      try {
        const data = await apiFetch(path, {
          method: "POST",
          body: JSON.stringify(body ?? {}),
        });
        setAgentsResult((prev) => ({
          ...prev,
          [agentKey]: { ok: true, data },
        }));
      } catch (err) {
        setAgentsResult((prev) => ({
          ...prev,
          [agentKey]: { ok: false, data: { error: String(err) } },
        }));
      }
      setAgentsRunning((prev) => {
        const s = new Set(prev);
        s.delete(agentKey);
        return s;
      });
      void loadAgentsOverview();
    },
    [agentsRunning, apiFetch, loadAgentsOverview],
  );

  const runMemoryBackfill = useCallback(async () => {
    const userId = Number(memoryBackfillUserId);
    if (!Number.isInteger(userId) || userId <= 0) {
      setAdminError("Inserisci un userId valido per il backfill memoria.");
      return;
    }
    setMemoryActionLoading("backfill");
    try {
      await apiFetch("/admin/memory-graph/backfill-user", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      await loadMemoryGraph();
    } catch {
      /* handled */
    }
    setMemoryActionLoading(null);
  }, [apiFetch, loadMemoryGraph, memoryBackfillUserId]);

  const updateMemoryRelation = useCallback(async (id: number, action: "approve" | "reject") => {
    setMemoryActionLoading(`${action}:${id}`);
    try {
      await apiFetch(`/admin/memory-graph/relations/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ reason: action === "reject" ? "Rifiutata da admin" : undefined }),
      });
      await loadMemoryGraph();
    } catch {
      /* handled */
    }
    setMemoryActionLoading(null);
  }, [apiFetch, loadMemoryGraph]);

  const savePrompt = useCallback(
    async (key: string) => {
      setPromptSaving((prev) => new Set(prev).add(`${key}:draft`));
      try {
        await apiFetch(`/admin/prompts/${key}/draft`, {
          method: "POST",
          body: JSON.stringify({
            value: promptEditValues[key],
            notes: promptNotes[key] || undefined,
          }),
        });
        await loadPrompts();
        await loadPromptVersions(key);
      } catch {
        /* handled */
      }
      setPromptSaving((prev) => {
        const s = new Set(prev);
        s.delete(`${key}:draft`);
        return s;
      });
    },
    [apiFetch, promptEditValues, promptNotes, loadPrompts, loadPromptVersions],
  );

  const publishPrompt = useCallback(
    async (key: string) => {
      setPromptSaving((prev) => new Set(prev).add(`${key}:publish`));
      try {
        await apiFetch(`/admin/prompts/${key}/publish`, { method: "POST" });
        await loadPrompts();
        await loadPromptVersions(key);
      } catch {
        /* handled */
      }
      setPromptSaving((prev) => {
        const s = new Set(prev);
        s.delete(`${key}:publish`);
        return s;
      });
    },
    [apiFetch, loadPrompts, loadPromptVersions],
  );

  const resetPrompt = useCallback(
    async (key: string) => {
      setPromptSaving((prev) => new Set(prev).add(`${key}:reset`));
      try {
        await apiFetch(`/admin/prompts/${key}/reset`, { method: "POST" });
        await loadPrompts();
        await loadPromptVersions(key);
      } catch {
        /* handled */
      }
      setPromptSaving((prev) => {
        const s = new Set(prev);
        s.delete(`${key}:reset`);
        return s;
      });
    },
    [apiFetch, loadPrompts, loadPromptVersions],
  );

  const rollbackPrompt = useCallback(
    async (key: string, versionId: number) => {
      setPromptSaving((prev) => new Set(prev).add(`${key}:rollback:${versionId}`));
      try {
        await apiFetch(`/admin/prompts/${key}/rollback`, {
          method: "POST",
          body: JSON.stringify({ versionId }),
        });
        await loadPrompts();
        await loadPromptVersions(key);
      } catch {
        /* handled */
      }
      setPromptSaving((prev) => {
        const s = new Set(prev);
        s.delete(`${key}:rollback:${versionId}`);
        return s;
      });
    },
    [apiFetch, loadPrompts, loadPromptVersions],
  );

  useEffect(() => {
    if (!token || adminForbidden) return;
    loadStats();
  }, [adminForbidden, loadStats, token]);

  useEffect(() => {
    if (!isLoggedIn || !token || adminForbidden) return;
    if (section === "suggestions" || section === "queue") loadSuggestions();
    else if (section === "runs") loadAgentsOverview();
    else if (section === "logs") loadLogs();
    else if (section === "prompts") loadPrompts();
    else if (section === "agents") loadAgentsOverview();
    else if (section === "memory") loadMemoryGraph();
    else if (section === "qualita") loadQualita();
    else if (section === "cataloghi") loadCataloghi();
    else if (section === "agenti-salute") loadAgentsOverview();
    else if (section === "metriche") loadMetriche();
    else if (section === "abbonamenti") loadAbbonamenti();
    else if (section === "home") loadHome();
    else if (section === "status") {
      loadStatus();
      loadOpsStatus();
    }
    else if (section === "messaggi") loadMessaggi();
    else if (section === "crescita") loadCrescita();
    else if (section === "affiliazione") loadAffiliazione();
  }, [
    isLoggedIn,
    section,
    loadSuggestions,
    loadAgentsOverview,
    loadMemoryGraph,
    loadLogs,
    loadPrompts,
    loadQualita,
    loadCataloghi,
    loadAgentiSalute,
    loadMetriche,
    loadAbbonamenti,
    loadHome,
    loadStatus,
    loadOpsStatus,
    loadMessaggi,
    loadCrescita,
    loadAffiliazione,
    adminForbidden,
    token,
  ]);

  useEffect(() => {
    if (section !== "home" || !isLoggedIn || !token || adminForbidden) return;

    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadHome();
      }
    }, 60_000);

    return () => window.clearInterval(id);
  }, [adminForbidden, isLoggedIn, loadHome, section, token]);

  function handleLogout() {
    logout();
    setStats(null);
    setSuggestions([]);
    setDetail(null);
    setAdminError(null);
    setAdminForbidden(false);
    setLastUpdatedAt(null);
    setMobileSidebarOpen(false);
    setQualitaData(null);
    setCataloghiOverview([]);
    setCataloghiData(null);
    setCatalogSelected(null);
    setCatalogPreview(null);
    setCatalogFields({});
    setAgentiSaluteData(null);
    setAgentsOverviewData(null);
    setMemoryData(null);
    setMetricheData(null);
    setAbbonamentiData(null);
    setAbbonamentiDetail(null);
    setAbbonamentiFields({});
    setHomeData(null);
    setStatusData(null);
    setMessaggiData(null);
    setMessaggioSelected(null);
    setMessaggioNotes("");
    setCrescitaData(null);
    setCrescitaSelected(null);
    setCrescitaPreview(null);
    setCrescitaFields({});
    setAffiliazioneData(null);
    setAffiliazioneSelected(null);
    setAffiliazioneNotes("");
  }

  async function handleApprove(id: number) {
    try {
      await apiFetch(`/admin/suggestions/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await refreshAfterDecision(id);
    } catch {
      /* handled */
    }
  }

  async function handleReject(id: number) {
    const notes = editNotes.trim() || undefined;
    try {
      await apiFetch(`/admin/suggestions/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ notes }),
      });
      setShowEditNotes(false);
      setEditNotes("");
      await refreshAfterDecision(id);
    } catch {
      /* handled */
    }
  }

  async function handleArchive(id: number) {
    try {
      await apiFetch(`/admin/suggestions/${id}/archive`, {
        method: "POST",
        body: JSON.stringify({ notes: "Archiviato" }),
      });
      await refreshAfterDecision(id);
    } catch {
      /* handled */
    }
  }

  async function handleApply(id: number) {
    try {
      await apiFetch(`/admin/suggestions/${id}/apply`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await refreshAfterDecision(id);
    } catch {
      /* handled */
    }
  }

  async function refreshAfterDecision(id: number) {
    await Promise.all([loadSuggestions(), loadStats(), homeData ? loadHome() : Promise.resolve()]);
    if (detail?.suggestion.id === id) await loadDetail(id);
  }

  const navigateToSection = useCallback(
    (nextSection: SidebarSection) => {
      setLocation(PATH_BY_SECTION[nextSection]);
      setDetail(null);
      setMobileSidebarOpen(false);
    },
    [setLocation],
  );

  const refreshCurrentSection = useCallback(() => {
    if (!token || adminForbidden) return;
    setAdminError(null);
    void loadStats();
    if (section === "suggestions" || section === "queue") void loadSuggestions();
    else if (section === "runs") void loadAgentsOverview();
    else if (section === "logs") void loadLogs();
    else if (section === "prompts") void loadPrompts();
    else if (section === "agents") void loadAgentsOverview();
    else if (section === "memory") void loadMemoryGraph();
    else if (section === "qualita") void loadQualita();
    else if (section === "cataloghi") void loadCataloghi();
    else if (section === "agenti-salute") void loadAgentsOverview();
    else if (section === "metriche") void loadMetriche();
    else if (section === "abbonamenti") void loadAbbonamenti();
    else if (section === "home") void loadHome();
    else if (section === "status") {
      void loadStatus();
      void loadOpsStatus();
    }
    else if (section === "messaggi") void loadMessaggi();
    else if (section === "crescita") void loadCrescita();
    else if (section === "affiliazione") void loadAffiliazione();
  }, [
    adminForbidden,
    loadAgentiSalute,
    loadAgentsOverview,
    loadAffiliazione,
    loadCataloghi,
    loadCrescita,
    loadHome,
    loadLogs,
    loadAbbonamenti,
    loadMemoryGraph,
    loadMetriche,
    loadPrompts,
    loadQualita,
    loadStats,
    loadStatus,
    loadOpsStatus,
    loadSuggestions,
    loadMessaggi,
    section,
    token,
  ]);

  const isRefreshing =
    loading ||
    detailLoading ||
    agentsOverviewLoading ||
    memoryLoading ||
    promptsLoading ||
    qualitaLoading ||
    cataloghiLoading ||
    agentiSaluteLoading ||
    metricheLoading ||
    abbonamentiLoading ||
    abbonamentiDetailLoading ||
    abbonamentiActionLoading ||
    homeLoading ||
    statusLoading ||
    opsLoading ||
    Boolean(opsActionLoading) ||
    messaggiLoading ||
    crescitaLoading ||
    affiliazioneLoading;

  const pendingCount = stats?.pending ?? 0;
  const queueSuggestions =
    section === "queue"
      ? suggestions.filter((s) => s.status === "pending_review")
      : suggestions;
  const promptsPersistence = prompts.find((prompt) => prompt.persistenceUnavailable);
  const promptsPersistenceMeta: PersistenceMeta = promptsPersistence
    ? {
        persistenceUnavailable: true,
        reason: promptsPersistence.reason,
        setupAction: promptsPersistence.setupAction,
      }
    : {};

  useEffect(() => {
    setSection(sectionFromLocation(location));
    setDetail(null);
  }, [location]);

  const catalogOverviewByType = useMemo(
    () => new Map(cataloghiOverview.map((item) => [item.type, item])),
    [cataloghiOverview],
  );

  const sidebarContent = (
    <>
      <div className="p-5 border-b">
        <div className="flex items-center gap-2 mb-1">
          <Bot className="w-5 h-5 text-primary" />
          <h1 className="font-serif font-bold text-lg">Admin Console</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Controllo operativo NorthStar
        </p>
      </div>

      {stats && (
        <div className="p-4 border-b">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-amber-700">{stats.pending}</div>
              <div className="text-[10px] text-amber-600 uppercase tracking-wider">In Attesa</div>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-emerald-700">{stats.approved}</div>
              <div className="text-[10px] text-emerald-600 uppercase tracking-wider">Approvati</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-red-700">{stats.rejected}</div>
              <div className="text-[10px] text-red-600 uppercase tracking-wider">Rifiutati</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-slate-700">{stats.totalRuns}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Esecuzioni</div>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto p-3 space-y-4">
        {ADMIN_NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const count = item.count?.(stats);
                return (
                  <button
                    key={item.key}
                    onClick={() => navigateToSection(item.key)}
                    className={cn(
                      "min-h-11 w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                      section === item.key
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                    aria-current={section === item.key ? "page" : undefined}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {count != null && count > 0 && (
                      <span className="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded-full min-w-5 text-center">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="min-h-11 w-full justify-start text-muted-foreground"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" /> Esci
        </Button>
      </div>
    </>
  );

  if (adminForbidden) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
          <ShieldAlert className="w-10 h-10 mx-auto mb-4 text-destructive" />
          <h1 className="text-xl font-serif font-bold text-foreground">
            Accesso non autorizzato
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Il tuo account e autenticato, ma non ha il ruolo admin necessario
            per aprire la console NorthStar.
          </p>
          <Button className="mt-5 min-h-11" onClick={handleLogout}>
            Esci
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background flex overflow-hidden">
        <aside className="hidden md:flex w-72 border-r bg-card flex-col shrink-0">
          {sidebarContent}
        </aside>

        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Chiudi menu admin"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <aside className="relative h-full w-[min(22rem,88vw)] bg-card border-r shadow-xl flex flex-col">
              {sidebarContent}
            </aside>
          </div>
        )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="min-h-16 border-b bg-card flex items-center justify-between gap-3 px-4 sm:px-6 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden min-h-11 min-w-11 shrink-0"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Apri menu admin"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              <h2 className="font-semibold text-foreground truncate">
                {TITLE_BY_SECTION[section]}
                {section === "queue" && pendingCount > 0 ? ` (${pendingCount})` : ""}
                {section === "suggestions" ? ` (${suggestionsTotal})` : ""}
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                {lastUpdatedAt
                  ? `Ultimo aggiornamento: ${formatLastUpdated(lastUpdatedAt)}`
                  : "Pronta per il primo aggiornamento"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={refreshCurrentSection}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("w-4 h-4 sm:mr-2", isRefreshing && "animate-spin")} />
              <span className="hidden sm:inline">Aggiorna</span>
            </Button>
          </div>
        </header>

        {adminError && (
          <div className="border-b bg-destructive/10 px-4 sm:px-6 py-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-start gap-2 text-sm text-destructive min-w-0 flex-1">
                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="break-words">{adminError}</span>
              </div>
              <div className="flex items-center gap-2 sm:shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-11 bg-background"
                  onClick={refreshCurrentSection}
                  disabled={isRefreshing}
                >
                  Riprova
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-11 min-w-11"
                  aria-label="Nascondi errore"
                  onClick={() => setAdminError(null)}
                >
                  <XCircle className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          {/* List Panel */}
          <div
            className={cn(
              "flex-1 overflow-y-auto",
              detail && "hidden lg:block lg:w-1/2 lg:border-r",
            )}
          >
            {(section === "queue" || section === "suggestions") && (
              <>
                {/* Filters */}
                <div className="p-4 border-b bg-muted/30">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Cerca per nome..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-9"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFilters(!showFilters)}
                      className="shrink-0"
                    >
                      <Filter className="w-4 h-4 mr-1" />
                      Filtri
                      <ChevronDown
                        className={cn(
                          "w-3 h-3 ml-1 transition-transform",
                          showFilters && "rotate-180",
                        )}
                      />
                    </Button>
                  </div>
                  {showFilters && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {section === "suggestions" ? (
                        <select
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value)}
                          className="min-h-11 text-sm border rounded-lg px-3 py-1.5 bg-background"
                          aria-label="Filtra per stato"
                        >
                          <option value="all">Tutti gli stati</option>
                          <option value="pending_review">In Revisione</option>
                          <option value="approved">Approvati</option>
                          <option value="applied">Applicati</option>
                          <option value="rejected">Rifiutati</option>
                          <option value="archived">Archiviati</option>
                          <option value="draft">Bozze</option>
                        </select>
                      ) : (
                        <div className="min-h-11 inline-flex items-center rounded-lg border bg-background px-3 text-sm text-muted-foreground">
                          Solo in revisione
                        </div>
                      )}
                      <select
                        value={filterEntity}
                        onChange={(e) => setFilterEntity(e.target.value)}
                        className="min-h-11 text-sm border rounded-lg px-3 py-1.5 bg-background"
                        aria-label="Filtra per tipo"
                      >
                        <option value="all">Tutti i tipi</option>
                        <option value="sector">Settori</option>
                        <option value="role">Ruoli</option>
                        <option value="education_path">Percorsi</option>
                        <option value="calendar_plan">Calendari</option>
                        <option value="growth_content">Crescita</option>
                        <option value="work_mode">Work Mode</option>
                      </select>
                      <select
                        value={filterConfidence}
                        onChange={(e) => setFilterConfidence(e.target.value)}
                        className="min-h-11 text-sm border rounded-lg px-3 py-1.5 bg-background"
                        aria-label="Filtra per confidence minima"
                      >
                        <option value="all">Tutte le confidence</option>
                        <option value="0.5">Confidence 50%+</option>
                        <option value="0.7">Confidence 70%+</option>
                        <option value="0.85">Confidence 85%+</option>
                      </select>
                    </div>
                  )}
                </div>

                {loading ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Caricamento...
                  </div>
                ) : queueSuggestions.length === 0 ? (
                  <div className="p-12 text-center">
                    <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium">
                      {section === "queue"
                        ? "Nessun elemento in attesa di revisione"
                        : "Nessun suggerimento trovato"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {queueSuggestions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => loadDetail(s.id)}
                        className={cn(
                          "w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-center gap-4",
                          detail?.suggestion.id === s.id &&
                            "bg-primary/5 border-l-2 border-primary",
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-foreground truncate">
                              {s.entityName}
                            </span>
                            <ConfidenceBadge score={s.confidenceScore} />
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <EntityBadge type={s.entityType} />
                            <StatusBadge status={s.status} />
                            {s.queuePriority && (
                              <Badge variant="outline" className="text-xs capitalize">
                                {s.queuePriority}
                              </Badge>
                            )}
                            {s.agentName && (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Bot className="w-3 h-3" />
                                {s.agentName}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {fmtShortDate(s.createdAt)}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {section === "memory" && (
              <div className="p-4 sm:p-6 space-y-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-lg font-serif font-bold flex items-center gap-2">
                      <Network className="w-5 h-5 text-primary" />
                      Cervello Wendy
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Governance del memory graph: salute, relazioni candidate, backfill e provenance.
                    </p>
                    {memoryData?.generatedAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Snapshot: {fmtShortDate(memoryData.generatedAt)}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    onClick={loadMemoryGraph}
                    disabled={memoryLoading}
                    className="min-h-11"
                  >
                    <RefreshCw className={cn("w-4 h-4 mr-2", memoryLoading && "animate-spin")} />
                    Aggiorna
                  </Button>
                </div>

                {memoryLoading && !memoryData ? (
                  <div className="p-12 text-center text-muted-foreground">
                    Caricamento cervello Wendy...
                  </div>
                ) : !memoryData ? (
                  <div className="p-12 text-center border rounded-xl bg-muted/20">
                    <Network className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="font-medium">Memory graph non disponibile</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Controlla migration, DB e stato servizi in Status & Setup.
                    </p>
                    <Button className="mt-4 min-h-11" variant="outline" onClick={loadMemoryGraph}>
                      Riprova
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                      {[
                        ["Nodi", memoryData.health.nodes],
                        ["Relazioni", memoryData.health.edges],
                        ["Candidate", memoryData.health.candidates],
                        ["Low confidence", memoryData.health.lowConfidenceEdges],
                        ["Embedding mancanti", memoryData.health.staleEmbeddings],
                        ["Nodi orfani", memoryData.health.orphanNodes],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="rounded-xl border bg-card p-4">
                          <p className="text-2xl font-bold">{String(value)}</p>
                          <p className="text-xs text-muted-foreground">{String(label)}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
                      <div className="rounded-xl border bg-card p-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div>
                            <h4 className="font-semibold">Relazioni da governare</h4>
                            <p className="text-xs text-muted-foreground">
                              Wendy e gli agenti propongono, l'admin approva o rifiuta.
                            </p>
                          </div>
                          <Badge variant="outline">{memoryData.candidateRelations.length}</Badge>
                        </div>
                        {memoryData.candidateRelations.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-8 text-center">
                            Nessuna relazione candidata. Il grafo non richiede decisioni ora.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {memoryData.candidateRelations.map((relation) => (
                              <div key={relation.id} className="rounded-lg border bg-background p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium">
                                      {relation.source?.title ?? `Nodo ${relation.sourceId}`} → {relation.target?.title ?? `Nodo ${relation.targetId}`}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {relation.label ?? relation.relationType} · confidence {Math.round(relation.confidence * 100)}%
                                    </p>
                                    {relation.reason && (
                                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                        {relation.reason}
                                      </p>
                                    )}
                                  </div>
                                  <Badge variant="outline">user {relation.userId}</Badge>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-3">
                                  <Button
                                    size="sm"
                                    className="min-h-11"
                                    disabled={memoryActionLoading === `approve:${relation.id}`}
                                    onClick={() => void updateMemoryRelation(relation.id, "approve")}
                                  >
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Approva
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="min-h-11"
                                    disabled={memoryActionLoading === `reject:${relation.id}`}
                                    onClick={() => void updateMemoryRelation(relation.id, "reject")}
                                  >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Rifiuta
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-xl border bg-card p-4">
                          <h4 className="font-semibold mb-2">Backfill utente</h4>
                          <p className="text-xs text-muted-foreground mb-3">
                            Crea/aggiorna nodi da idee, obiettivi, calendario, profilo e memoria Wendy.
                          </p>
                          <div className="flex gap-2">
                            <Input
                              value={memoryBackfillUserId}
                              onChange={(e) => setMemoryBackfillUserId(e.target.value)}
                              placeholder="userId"
                              inputMode="numeric"
                              className="min-h-11"
                            />
                            <Button
                              className="min-h-11"
                              disabled={memoryActionLoading === "backfill"}
                              onClick={() => void runMemoryBackfill()}
                            >
                              {memoryActionLoading === "backfill" ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        <div className="rounded-xl border bg-card p-4">
                          <h4 className="font-semibold mb-3">Fonti memoria</h4>
                          {memoryData.sourceBreakdown.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nessuna fonte indicizzata.</p>
                          ) : (
                            <div className="space-y-2">
                              {memoryData.sourceBreakdown.map((source) => (
                                <div key={source.sourceType} className="flex items-center justify-between gap-3 text-sm">
                                  <span className="truncate">{source.sourceType}</span>
                                  <Badge variant="outline">{source.count}</Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="rounded-xl border bg-amber-50 border-amber-200 p-4 text-amber-900">
                          <h4 className="font-semibold mb-1">Regola di sicurezza</h4>
                          <p className="text-xs">
                            Wendy puo proporre memoria e relazioni, ma modifiche globali e relazioni dubbie passano dalla governance.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {section === "agents" && (
              <AgentsSection
                data={agentsOverviewData}
                loading={agentsOverviewLoading}
                tab={agentsTab}
                onTabChange={setAgentsTab}
                agentDays={agentDays}
                onAgentDaysChange={setAgentDays}
                agentFilter={agentFilter}
                onAgentFilterChange={setAgentFilter}
                agentStatusFilter={agentStatusFilter}
                onAgentStatusFilterChange={setAgentStatusFilter}
                newsSectorInput={newsSectorInput}
                onNewsSectorInputChange={setNewsSectorInput}
                agentsRunning={agentsRunning}
                agentsResult={agentsResult}
                onRefresh={loadAgentsOverview}
                onOpenStatus={openStatusSetup}
                onLaunch={triggerAgent}
              />
            )}

            {section === "logs" && (
              <div className="divide-y">
                {logs.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    Nessun log registrato
                  </div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="p-4 flex items-center gap-3">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                          log.action === "approve" && "bg-emerald-100",
                          log.action === "reject" && "bg-red-100",
                          log.action === "archive" && "bg-slate-100",
                          log.action === "edit" && "bg-blue-100",
                        )}
                      >
                        {log.action === "approve" && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        )}
                        {log.action === "reject" && (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                        {log.action === "archive" && (
                          <Archive className="w-4 h-4 text-slate-500" />
                        )}
                        {log.action === "edit" && (
                          <Pencil className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium capitalize">
                          {log.action} - {log.targetType} #{log.targetId}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {fmtDate(log.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

             {section === "prompts" && (
               <PromptsSection
                 aiModelPolicy={aiModelPolicy}
                 promptsPersistenceMeta={promptsPersistenceMeta}
                 promptsLoading={promptsLoading}
                 prompts={prompts}
                 promptExpandedKey={promptExpandedKey}
                 promptTab={promptTab}
                 promptEditValues={promptEditValues}
                 promptNotes={promptNotes}
                 promptVersions={promptVersions}
                 promptPreview={promptPreview}
                 promptVersionPersistence={promptVersionPersistence}
                 promptSaving={promptSaving}
                 onOpenStatus={openStatusSetup}
                 onLoadPrompts={loadPrompts}
                 onLoadPromptVersions={loadPromptVersions}
                 onLoadPromptPreview={loadPromptPreview}
                 onExpandedKeyChange={setPromptExpandedKey}
                 onPromptTabChange={setPromptTab}
                 onPromptEditValuesChange={setPromptEditValues}
                 onPromptNotesChange={setPromptNotes}
                 onSavePrompt={savePrompt}
                 onPublishPrompt={publishPrompt}
                 onResetPrompt={resetPrompt}
                 onRollbackPrompt={rollbackPrompt}
               />
             )}
             {section === "qualita" && (
               <QualitySection
                 data={qualitaData}
                 loading={qualitaLoading}
                 days={qualitaDays}
                 onDaysChange={setQualitaDays}
                 onRefresh={loadQualita}
                 onOpenStatus={openStatusSetup}
               />
             )}
             {section === "settings" && (
              <div className="p-8">
                <h3 className="text-lg font-serif font-bold mb-4">
                  Impostazioni
                </h3>
                <div className="space-y-4">
                  <div className="bg-card border rounded-2xl p-6">
                    <h4 className="font-semibold mb-2">Stato del Sistema</h4>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>
                        Suggerimenti totali:{" "}
                        <strong className="text-foreground">
                          {suggestionsTotal}
                        </strong>
                      </p>
                      <p>
                        In attesa:{" "}
                        <strong className="text-amber-600">
                          {stats?.pending ?? 0}
                        </strong>
                      </p>
                      <p>
                        Approvati:{" "}
                        <strong className="text-emerald-600">
                          {stats?.approved ?? 0}
                        </strong>
                      </p>
                      <p>
                        Rifiutati:{" "}
                        <strong className="text-red-600">
                          {stats?.rejected ?? 0}
                        </strong>
                      </p>
                      <p>
                        Esecuzioni agenti:{" "}
                        <strong className="text-foreground">
                          {stats?.totalRuns ?? 0}
                        </strong>
                      </p>
                    </div>
                  </div>
                  <div className="bg-card border rounded-2xl p-6">
                    <h4 className="font-semibold mb-2">Agenti Attivi</h4>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "Sector",
                        "Role",
                        "Education",
                        "Calendar",
                        "Growth",
                        "WorkMode",
                        "Validator",
                      ].map((name) => (
                        <Badge key={name} variant="secondary">
                          {name}Agent
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Home Admin ── */}
            {section === "home" && (
              <HomeSection
                data={homeData}
                loading={homeLoading}
                onRefresh={loadHome}
                onNavigateSection={navigateToSection}
              />
            )}

            {/* ── Cataloghi ── */}
            {section === "cataloghi" && (
              <div className="p-4 md:p-8 space-y-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-lg font-serif font-bold flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-primary" />
                      Cataloghi core
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Editing controllato con bozze, preview utente, pubblicazione e audit.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => openCatalogDraft(catalogType)}
                    >
                      <FileText size={14} className="mr-1.5" />
                      Nuova bozza
                    </Button>
                    <Button size="sm" variant="outline" className="min-h-11" onClick={loadCataloghi} disabled={cataloghiLoading}>
                      {cataloghiLoading ? <RefreshCw size={13} className="animate-spin mr-1" /> : <RefreshCw size={13} className="mr-1" />}
                      Aggiorna
                    </Button>
                  </div>
                </div>

                <PersistenceWarningBanner
                  meta={catalogPersistence}
                  title="Cataloghi non affidabili"
                  onRetry={loadCataloghi}
                  onOpenStatus={openStatusSetup}
                />

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {CATALOG_TABS.map(({ type, label, icon: Icon }) => {
                    const overview = catalogOverviewByType.get(type);
                    const active = catalogType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setCatalogType(type);
                          setCatalogSelected(null);
                          setCatalogDraftId(null);
                          setCatalogPreview(null);
                          setCatalogFields({});
                          setCatalogPayloadText(JSON.stringify(defaultCatalogPayload(type), null, 2));
                        }}
                        className={cn(
                          "min-h-24 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                          active ? "border-primary/50 bg-primary/5" : "bg-card hover:bg-muted/40",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <Icon className={cn("w-5 h-5", active ? "text-primary" : "text-muted-foreground")} />
                          {overview && overview.drafts > 0 && (
                            <Badge variant="outline">{overview.drafts} bozze</Badge>
                          )}
                        </div>
                        <p className="mt-3 font-semibold text-sm">{label}</p>
                        <p className="text-xs text-muted-foreground">
                          {overview ? `${overview.active} attivi · ${overview.archived} archiviati` : "Caricamento"}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-3 lg:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      className="min-h-11 pl-9"
                      value={catalogSearch}
                      onChange={(event) => setCatalogSearch(event.target.value)}
                      placeholder="Cerca per titolo, nome o descrizione"
                    />
                  </div>
                  <select
                    className="min-h-11 rounded-md border bg-background px-3 text-sm"
                    value={catalogStatus}
                    onChange={(event) => setCatalogStatus(event.target.value)}
                    aria-label="Filtra stato catalogo"
                  >
                    <option value="all">Tutti gli stati</option>
                    <option value="active">Attivi</option>
                    <option value="archived">Archiviati</option>
                    {catalogType === "growth_articles" && <option value="draft">Draft articoli</option>}
                    {catalogType === "growth_articles" && <option value="published">Pubblicati</option>}
                  </select>
                  <Button className="min-h-11" variant="outline" onClick={loadCataloghi} disabled={cataloghiLoading}>
                    <Filter size={14} className="mr-1.5" />
                    Filtra
                  </Button>
                </div>

                {Object.keys(catalogFields).length > 0 && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
                    <p className="font-semibold">Correggi questi problemi prima di continuare:</p>
                    <ul className="mt-1 list-disc pl-5">
                      {Object.entries(catalogFields).map(([field, message]) => (
                        <li key={field}>
                          <span className="font-medium">{field}</span>: {message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <div className="rounded-md border bg-card">
                    <div className="border-b px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{cataloghiData?.label ?? "Catalogo"}</p>
                        <p className="text-xs text-muted-foreground">
                          {(cataloghiData?.items?.length ?? 0)} elementi · {(cataloghiData?.drafts?.length ?? 0)} bozze aperte
                        </p>
                      </div>
                      {cataloghiLoading && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
                    </div>
                    <div className="divide-y max-h-[620px] overflow-y-auto">
                      {cataloghiLoading ? (
                        <p className="p-6 text-sm text-muted-foreground">Caricamento catalogo...</p>
                      ) : cataloghiData && cataloghiData.items.length > 0 ? (
                        cataloghiData.items.map((item) => {
                          const archived = isCatalogArchived(catalogType, item);
                          const active = catalogSelected?.id === item.id;
                          return (
                            <button
                              key={`${catalogType}:${item.id}`}
                              type="button"
                              onClick={() => void openCatalogItem(item)}
                              className={cn(
                                "w-full min-h-20 p-4 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                                active && "bg-primary/5",
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">{catalogTitle(catalogType, item)}</p>
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {catalogDescription(catalogType, item)}
                                  </p>
                                </div>
                                <Badge variant="outline" className={archived ? "text-slate-500" : "text-emerald-700"}>
                                  {archived ? "Archiviato" : catalogType === "growth_articles" ? item.status : "Attivo"}
                                </Badge>
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                          {catalogPersistence.persistenceUnavailable
                            ? "Catalogo non leggibile: controlla setup o migration prima di interpretare questo vuoto."
                            : "Nessun elemento trovato. Crea una bozza o cambia filtro."}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-md border bg-card">
                      <div className="border-b px-4 py-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-sm font-semibold">
                            {catalogSelected ? catalogTitle(catalogType, catalogSelected) : "Nuova bozza"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {catalogDraftId ? `Bozza #${catalogDraftId} pronta per pubblicazione` : "Salva una bozza prima di pubblicare un nuovo contenuto."}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" className="min-h-11" onClick={() => void runCatalogAction("preview")} disabled={catalogActionLoading === "preview"}>
                            <Eye size={14} className="mr-1.5" />
                            Preview
                          </Button>
                          <Button size="sm" className="min-h-11" onClick={() => void runCatalogAction("draft")} disabled={catalogActionLoading === "draft"}>
                            <Save size={14} className="mr-1.5" />
                            Salva bozza
                          </Button>
                          <Button size="sm" className="min-h-11" onClick={() => void runCatalogAction("publish")} disabled={catalogActionLoading === "publish"}>
                            <CheckCircle2 size={14} className="mr-1.5" />
                            Pubblica
                          </Button>
                        </div>
                      </div>
                      <div className="p-4 space-y-3">
                        <label className="block text-sm font-medium" htmlFor="catalog-notes">Note decisione</label>
                        <Input
                          id="catalog-notes"
                          className="min-h-11"
                          value={catalogNotes}
                          onChange={(event) => setCatalogNotes(event.target.value)}
                          placeholder="Motivo modifica, fonte dati o contesto editoriale"
                        />
                        <label className="block text-sm font-medium" htmlFor="catalog-payload">Payload validato</label>
                        <textarea
                          id="catalog-payload"
                          className="min-h-[360px] w-full resize-y rounded-md border bg-background p-3 font-mono text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                          value={catalogPayloadText}
                          onChange={(event) => setCatalogPayloadText(event.target.value)}
                          spellCheck={false}
                        />
                      </div>
                      {catalogSelected?.id && (
                        <div className="border-t px-4 py-3 flex flex-wrap gap-2">
                          {isCatalogArchived(catalogType, catalogSelected) ? (
                            <Button size="sm" variant="outline" className="min-h-11" onClick={() => void runCatalogAction("restore")} disabled={catalogActionLoading === "restore"}>
                              <RotateCcw size={14} className="mr-1.5" />
                              Ripristina
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className="min-h-11 text-red-700" onClick={() => void runCatalogAction("archive")} disabled={catalogActionLoading === "archive"}>
                              <Archive size={14} className="mr-1.5" />
                              Archivia
                            </Button>
                          )}
                          <a
                            className="inline-flex min-h-11 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted/40"
                            href={
                              catalogType === "growth_articles" && catalogSelected.slug
                                ? `/crescita/articolo/${catalogSelected.slug}`
                                : catalogType === "sectors"
                                  ? `/settore/${catalogSelected.id}`
                                  : catalogType === "professions"
                                    ? `/ruolo/${catalogSelected.id}`
                                    : "/percorso"
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Eye size={14} className="mr-1.5" />
                            Apri vista utente
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-md border bg-card p-4">
                        <p className="text-sm font-semibold mb-3">Preview utente</p>
                        {catalogPreview ? (
                          <div className="rounded-md border bg-background p-4">
                            <p className="text-xs text-muted-foreground">{catalogPreview.subtitle}</p>
                            <h4 className="mt-1 font-serif text-lg font-bold">{catalogPreview.title}</h4>
                            <p className="mt-2 text-sm text-muted-foreground">{catalogPreview.description}</p>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {catalogPreview.badges?.slice(0, 6).map((badge) => (
                                <Badge key={badge} variant="outline">{badge}</Badge>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Genera una preview per vedere come apparira agli utenti prima della pubblicazione.</p>
                        )}
                      </div>

                      <div className="rounded-md border bg-card p-4">
                        <p className="text-sm font-semibold mb-3">Audit recente</p>
                        {catalogAuditTrail.length > 0 ? (
                          <div className="space-y-2">
                            {catalogAuditTrail.slice(0, 5).map((entry) => (
                              <div key={entry.id} className="rounded-md border bg-background p-3">
                                <p className="text-xs font-mono">{entry.action}</p>
                                <p className="text-xs text-muted-foreground">
                                  {entry.createdAt ? new Date(entry.createdAt).toLocaleString("it-IT") : "Data non disponibile"}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Le decisioni su questo elemento appariranno qui.</p>
                        )}
                      </div>
                    </div>

                    {cataloghiData?.drafts && cataloghiData.drafts.length > 0 && (
                      <div className="rounded-md border bg-card p-4">
                        <p className="text-sm font-semibold mb-3">Bozze aperte</p>
                        <div className="grid gap-2">
                          {cataloghiData.drafts.slice(0, 6).map((draft) => (
                            <button
                              key={draft.id}
                              type="button"
                              onClick={() => {
                                setCatalogDraftId(draft.id);
                                setCatalogSelected(draft.entityId ? { id: draft.entityId, ...draft.payload } : null);
                                setCatalogPayloadText(JSON.stringify(draft.payload, null, 2));
                                setCatalogPreview(null);
                                setCatalogFields({});
                              }}
                              className="min-h-14 rounded-md border bg-background p-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                            >
                              <p className="text-sm font-medium">
                                Bozza #{draft.id} {draft.entityId ? `· elemento #${draft.entityId}` : "· nuovo elemento"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Aggiornata {new Date(draft.updatedAt).toLocaleString("it-IT")}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Agent Health ── */}
            {section === "agenti-salute" && (
              <div className="p-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-serif font-bold">
                    <Activity className="w-5 h-5 inline mr-2 text-primary" />
                    Salute Agenti
                  </h3>
                  <Button size="sm" variant="outline" onClick={loadAgentiSalute} disabled={agentiSaluteLoading}>
                    {agentiSaluteLoading ? <RefreshCw size={13} className="animate-spin mr-1" /> : <RefreshCw size={13} className="mr-1" />}
                    Aggiorna
                  </Button>
                </div>
                {agentiSaluteLoading ? (
                  <p className="text-sm text-muted-foreground">Caricamento...</p>
                ) : agentiSaluteData?.agents ? (
                  <div className="space-y-3">
                    {agentiSaluteData.agents.map((agent: any) => (
                      <div key={agent.agentName} className="p-4 rounded-xl border bg-card">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Bot size={16} className="text-muted-foreground" />
                            <span className="font-semibold font-mono text-sm">{agent.agentName}</span>
                            <Badge className={
                              agent.status === "healthy" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                              agent.status === "degraded" ? "bg-amber-100 text-amber-700 border-amber-200" :
                              "bg-red-100 text-red-700 border-red-200"
                            }>
                              {agent.status === "healthy" ? "Sano" : agent.status === "degraded" ? "Degradato" : "Critico"}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">{agent.totalCalls30d} chiamate / 30g</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center p-2 rounded-lg bg-muted/40">
                            <p className={`text-lg font-bold ${agent.successRate30d >= 95 ? "text-emerald-600" : agent.successRate30d >= 80 ? "text-amber-500" : "text-red-500"}`}>{agent.successRate30d}%</p>
                            <p className="text-xs text-muted-foreground">Successo 30g</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-muted/40">
                            <p className="text-lg font-bold text-red-500">{agent.errorCount30d}</p>
                            <p className="text-xs text-muted-foreground">Errori 30g</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-muted/40">
                            <p className="text-lg font-bold">{agent.avgDurationMs ? `${agent.avgDurationMs}ms` : "—"}</p>
                            <p className="text-xs text-muted-foreground">Latenza media</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Nessun dato disponibile.</p>
                )}
              </div>
            )}

            {/* ── Metriche Business ── */}
            {section === "metriche" && (
              <BusinessMetricsSection
                data={metricheData}
                loading={metricheLoading}
                onRefresh={loadMetriche}
                onNavigateSection={navigateToSection}
              />
            )}

            {/* ── Abbonamenti ── */}
            {section === "abbonamenti" && (
              <SubscriptionsSection
                data={abbonamentiData}
                detail={abbonamentiDetail}
                loading={abbonamentiLoading}
                detailLoading={abbonamentiDetailLoading}
                actionLoading={abbonamentiActionLoading}
                search={abbonamentiSearch}
                planFilter={abbonamentiPlan}
                statusFilter={abbonamentiStatus}
                form={abbonamentiForm}
                fields={abbonamentiFields}
                onSearchChange={setAbbonamentiSearch}
                onPlanFilterChange={setAbbonamentiPlan}
                onStatusFilterChange={setAbbonamentiStatus}
                onFormChange={setAbbonamentiForm}
                onRefresh={loadAbbonamenti}
                onSelectUser={(item: AdminSubscriptionItem) => void loadAbbonamentiDetail(item.user.id)}
                onSave={saveAbbonamento}
              />
            )}

            {/* ── Status & Setup ── */}
            {section === "status" && (
              <StatusSection
                data={statusData}
                loading={statusLoading}
                opsData={opsData}
                opsLoading={opsLoading}
                opsActionLoading={opsActionLoading}
                opsError={opsError}
                onRefresh={loadStatus}
                onOpsRefresh={loadOpsStatus}
                onOpsAction={runOpsAction}
                onMaintenanceToggle={toggleMaintenanceMode}
                onNavigateSection={navigateToSection}
              />
            )}

            {/* ── Messaggi ── */}
            {section === "messaggi" && (
              <MessagesSection
                data={messaggiData}
                loading={messaggiLoading}
                search={messaggiSearch}
                readFilter={messaggiRead}
                statusFilter={messaggiStatus}
                assignedToFilter={messaggiAssignedTo}
                selectedMessage={messaggioSelected}
                notes={messaggioNotes}
                actionLoading={messaggioActionLoading}
                currentUserId={user?.id}
                onSearchChange={setMessaggiSearch}
                onReadFilterChange={setMessaggiRead}
                onStatusFilterChange={setMessaggiStatus}
                onAssignedToFilterChange={setMessaggiAssignedTo}
                onSelectMessage={(message) => {
                  setMessaggioSelected(message);
                  setMessaggioNotes(message.internalNotes ?? "");
                }}
                onNotesChange={setMessaggioNotes}
                onRefresh={loadMessaggi}
                onUpdateMessage={updateMessaggio}
              />
            )}

            {/* ── Coda Crescita ── */}
            {section === "crescita" && (
              <div className="p-4 md:p-8 space-y-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-lg font-serif font-bold">
                      <Sparkles className="w-5 h-5 inline mr-2 text-primary" />
                      Coda Crescita
                    </h3>
                    <p className="text-sm text-muted-foreground">Review editoriale per articoli generati o proposti.</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={loadCrescita} disabled={crescitaLoading} className="min-h-11">
                    {crescitaLoading ? <RefreshCw size={13} className="animate-spin mr-1" /> : <RefreshCw size={13} className="mr-1" />}
                    Aggiorna
                  </Button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  {GROWTH_STATUS_FILTERS.map((item) => {
                    const value = item.value === "all" ? crescitaData?.stats?.total : crescitaData?.stats?.[item.value];
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setCrescitaStatus(item.value)}
                        className={cn(
                          "min-h-11 rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          crescitaStatus === item.value ? "bg-primary/10 border-primary/40" : "bg-card hover:bg-muted/50",
                        )}
                      >
                        <p className="text-lg font-bold">{value ?? 0}</p>
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-9 min-h-11"
                    placeholder="Cerca titolo, slug, categoria o descrizione..."
                    value={crescitaSearch}
                    onChange={(event) => setCrescitaSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void loadCrescita();
                    }}
                  />
                </div>

                {crescitaLoading ? (
                  <p className="text-sm text-muted-foreground">Caricamento...</p>
                ) : crescitaData?.queue ? (
                  <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)] gap-4">
                    <div className="space-y-2 min-w-0">
                      {crescitaData.queue.map((article) => (
                        <button
                          key={article.id}
                          type="button"
                          onClick={() => void loadCrescitaDetail(article.id)}
                          className={cn(
                            "w-full min-h-11 text-left p-4 rounded-lg border bg-card hover:bg-muted/50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                            crescitaSelected?.article?.id === article.id && "border-primary/50 bg-primary/5",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className="font-semibold text-sm truncate">{article.title}</h4>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {article.slug} · {article.category}{article.subcategory ? ` / ${article.subcategory}` : ""} · {article.readTimeMinutes} min
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {growthStatusBadge(article.status)}
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{article.description}</p>
                          <p className="text-xs text-muted-foreground mt-2">Aggiornato {fmtShortDate(article.updatedAt)}</p>
                        </button>
                      ))}
                      {crescitaData.queue.length === 0 && (
                        <div className="rounded-lg border bg-card p-8 text-center">
                          <p className="font-medium">Nessun articolo trovato.</p>
                          <p className="text-sm text-muted-foreground mt-1">Cambia filtro o ricerca per vedere altre proposte.</p>
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border bg-card min-w-0">
                      {crescitaSelected ? (
                        <div className="p-4 md:p-5 space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className="font-semibold truncate">{crescitaSelected.article.title}</h4>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                {growthStatusBadge(crescitaSelected.article.status)}
                                <Badge variant="outline">{crescitaSelected.article.difficulty}</Badge>
                                <span className="text-xs text-muted-foreground">{crescitaSelected.article.readTimeMinutes} min</span>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setCrescitaSelected(null)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>

                          <div className="grid md:grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs font-medium mb-1">Titolo</p>
                              <Input value={crescitaForm.title ?? ""} onChange={(e) => setCrescitaForm((prev) => ({ ...prev, title: e.target.value }))} />
                              {crescitaFields.title && <p className="text-xs text-red-600 mt-1">{crescitaFields.title}</p>}
                            </div>
                            <div>
                              <p className="text-xs font-medium mb-1">Slug</p>
                              <Input value={crescitaForm.slug ?? ""} onChange={(e) => setCrescitaForm((prev) => ({ ...prev, slug: e.target.value }))} />
                              {crescitaFields.slug && <p className="text-xs text-red-600 mt-1">{crescitaFields.slug}</p>}
                            </div>
                            <div>
                              <p className="text-xs font-medium mb-1">Categoria</p>
                              <Input value={crescitaForm.category ?? ""} onChange={(e) => setCrescitaForm((prev) => ({ ...prev, category: e.target.value }))} />
                              {crescitaFields.category && <p className="text-xs text-red-600 mt-1">{crescitaFields.category}</p>}
                            </div>
                            <div>
                              <p className="text-xs font-medium mb-1">Sottocategoria</p>
                              <Input value={crescitaForm.subcategory ?? ""} onChange={(e) => setCrescitaForm((prev) => ({ ...prev, subcategory: e.target.value }))} />
                            </div>
                            <div>
                              <p className="text-xs font-medium mb-1">Difficoltà</p>
                              <select
                                className="w-full min-h-10 rounded-md border bg-background px-3 text-sm"
                                value={crescitaForm.difficulty ?? "base"}
                                onChange={(e) => setCrescitaForm((prev) => ({ ...prev, difficulty: e.target.value }))}
                              >
                                <option value="base">Base</option>
                                <option value="intermedio">Intermedio</option>
                                <option value="avanzato">Avanzato</option>
                              </select>
                            </div>
                            <div>
                              <p className="text-xs font-medium mb-1">Read time</p>
                              <Input type="number" min={1} value={crescitaForm.readTimeMinutes ?? 3} onChange={(e) => setCrescitaForm((prev) => ({ ...prev, readTimeMinutes: e.target.value }))} />
                            </div>
                          </div>

                          <div>
                            <p className="text-xs font-medium mb-1">Descrizione</p>
                            <Textarea value={crescitaForm.description ?? ""} onChange={(e) => setCrescitaForm((prev) => ({ ...prev, description: e.target.value }))} />
                            {crescitaFields.description && <p className="text-xs text-red-600 mt-1">{crescitaFields.description}</p>}
                          </div>
                          <div>
                            <p className="text-xs font-medium mb-1">Contenuto</p>
                            <Textarea className="min-h-40" value={crescitaForm.content ?? ""} onChange={(e) => setCrescitaForm((prev) => ({ ...prev, content: e.target.value }))} />
                            {crescitaFields.content && <p className="text-xs text-red-600 mt-1">{crescitaFields.content}</p>}
                          </div>
                          <div>
                            <p className="text-xs font-medium mb-1">Tag</p>
                            <Input value={Array.isArray(crescitaForm.tags) ? crescitaForm.tags.join(", ") : crescitaForm.tags ?? ""} onChange={(e) => setCrescitaForm((prev) => ({ ...prev, tags: e.target.value }))} />
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={() => void handleCrescitaAction("save")} disabled={!!crescitaActionLoading} className="min-h-11">
                              <Save className="w-4 h-4 mr-2" /> Salva modifiche
                            </Button>
                            <Button variant="outline" onClick={() => void handleCrescitaAction("preview")} disabled={!!crescitaActionLoading} className="min-h-11">
                              <Eye className="w-4 h-4 mr-2" /> Preview
                            </Button>
                            <Button onClick={() => void handleCrescitaAction("publish")} disabled={!!crescitaActionLoading} className="min-h-11">
                              <CheckCircle2 className="w-4 h-4 mr-2" /> Approva e pubblica
                            </Button>
                          </div>

                          <div className="rounded-lg border p-3 bg-muted/20">
                            <p className="text-sm font-medium mb-2">Rifiuta con motivo</p>
                            <Textarea value={crescitaRejectReason} onChange={(e) => setCrescitaRejectReason(e.target.value)} placeholder="Motivo visibile nella timeline audit..." />
                            {crescitaFields.reason && <p className="text-xs text-red-600 mt-1">{crescitaFields.reason}</p>}
                            <Button variant="outline" className="mt-2 min-h-11 text-red-700 border-red-200 hover:bg-red-50" onClick={() => void handleCrescitaAction("reject")} disabled={!!crescitaActionLoading}>
                              <XCircle className="w-4 h-4 mr-2" /> Rifiuta
                            </Button>
                          </div>

                          {crescitaPreview && (
                            <div className="rounded-lg border p-4 bg-background">
                              <p className="text-xs font-medium text-muted-foreground mb-2">Preview utente</p>
                              <h5 className="font-serif font-bold text-lg">{crescitaPreview.title}</h5>
                              <p className="text-sm text-muted-foreground mt-1">{crescitaPreview.description}</p>
                              <div className="flex gap-2 flex-wrap mt-3">
                                <Badge variant="outline">{crescitaPreview.category}</Badge>
                                <Badge variant="outline">{crescitaPreview.difficulty}</Badge>
                                <Badge variant="outline">{crescitaPreview.readTimeMinutes} min</Badge>
                              </div>
                              <p className="text-sm mt-4 whitespace-pre-wrap line-clamp-6">{crescitaPreview.content}</p>
                            </div>
                          )}

                          <div>
                            <p className="text-sm font-medium mb-2">Timeline audit</p>
                            {crescitaSelected.auditTrail?.length ? (
                              <div className="space-y-2">
                                {crescitaSelected.auditTrail.map((entry) => (
                                  <div key={entry.id} className="rounded-lg border p-3 text-sm">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                      <span className="font-medium">{auditActionLabel(entry.action)}</span>
                                      <span className="text-xs text-muted-foreground">{fmtShortDate(entry.createdAt)}</span>
                                    </div>
                                    {(entry.metadata?.reason || entry.metadata?.notes) && (
                                      <p className="text-xs text-muted-foreground mt-1">{String(entry.metadata.reason ?? entry.metadata.notes)}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">Nessuna decisione registrata.</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="p-8 text-center">
                          <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                          <p className="font-medium">Seleziona un articolo</p>
                          <p className="text-sm text-muted-foreground mt-1">Apri una proposta per modificarla, vedere la preview e decidere cosa pubblicare.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border bg-card p-8 text-center">
                    <p className="text-sm text-muted-foreground">Nessun dato disponibile.</p>
                    <Button variant="outline" className="mt-3 min-h-11" onClick={loadCrescita}>Riprova</Button>
                  </div>
                )}
              </div>
            )}

            {/* ── Partner / Affiliazione ── */}
            {section === "affiliazione" && (
              <AffiliationSection
                data={affiliazioneData}
                loading={affiliazioneLoading}
                search={affiliazioneSearch}
                readFilter={affiliazioneRead}
                statusFilter={affiliazioneStatus}
                sourceFilter={affiliazioneSource}
                assignedToFilter={affiliazioneAssignedTo}
                selectedLead={affiliazioneSelected}
                notes={affiliazioneNotes}
                actionLoading={affiliazioneActionLoading}
                currentUserId={user?.id}
                onSearchChange={setAffiliazioneSearch}
                onReadFilterChange={setAffiliazioneRead}
                onStatusFilterChange={setAffiliazioneStatus}
                onSourceFilterChange={setAffiliazioneSource}
                onAssignedToFilterChange={setAffiliazioneAssignedTo}
                onSelectLead={(lead) => {
                  setAffiliazioneSelected(lead);
                  setAffiliazioneNotes(lead.internalNotes ?? "");
                }}
                onNotesChange={setAffiliazioneNotes}
                onRefresh={loadAffiliazione}
                onUpdateLead={updateAffiliazione}
              />
            )}

          </div>
          {detail && (
            <div className="w-full lg:w-1/2 overflow-y-auto border-l bg-card">
              <div className="sticky top-0 bg-card border-b p-4 flex items-center justify-between z-10">
                <h3 className="font-semibold truncate flex-1">
                  {detail.suggestion.entityName}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDetail(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {detailLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Caricamento dettagli...
                </div>
              ) : (
                <div className="p-6 space-y-6">
                  {/* Status & Meta */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <StatusBadge status={detail.suggestion.status} />
                    <EntityBadge type={detail.suggestion.entityType} />
                    {detail.suggestion.confidenceScore != null && (
                      <span className="text-sm text-muted-foreground">
                        Confidence:{" "}
                        <ConfidenceBadge
                          score={detail.suggestion.confidenceScore}
                        />
                      </span>
                    )}
                  </div>

                  {/* Dates */}
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Creato: {fmtDate(detail.suggestion.createdAt)}</p>
                    <p>Aggiornato: {fmtDate(detail.suggestion.updatedAt)}</p>
                    {detail.suggestion.reviewedAt && (
                      <p>
                        Revisionato: {fmtDate(detail.suggestion.reviewedAt)} da{" "}
                        {detail.suggestion.reviewedBy}
                      </p>
                    )}
                  </div>

                  <Separator />

                  <div className="rounded-lg border bg-background p-4">
                    <h4 className="text-sm font-semibold mb-3">Proposta</h4>
                    {payloadEntries(detail.suggestion.payloadJson).length > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {payloadEntries(detail.suggestion.payloadJson).map(([key, value]) => (
                          <div key={key} className="rounded-md bg-muted/40 p-3 min-w-0">
                            <p className="text-xs font-medium text-muted-foreground">
                              {humanizeKey(key)}
                            </p>
                            <p className="text-sm mt-1 break-words line-clamp-3">
                              {formatValue(value)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Nessun campo sintetico disponibile. Apri i dati tecnici per vedere il payload completo.
                      </p>
                    )}
                  </div>

                  {payloadDiffs(detail.suggestion.payloadJson).length > 0 && (
                    <div className="rounded-lg border bg-background p-4">
                      <h4 className="text-sm font-semibold mb-3">Cambiamenti proposti</h4>
                      <div className="space-y-3">
                        {payloadDiffs(detail.suggestion.payloadJson).map((diff) => (
                          <div key={diff.key} className="rounded-md border p-3">
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                              {humanizeKey(diff.key)}
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div className="rounded-md bg-red-50 p-2">
                                <p className="text-[10px] font-semibold uppercase text-red-700">Prima</p>
                                <p className="text-xs text-red-900 break-words">{formatValue(diff.before)}</p>
                              </div>
                              <div className="rounded-md bg-emerald-50 p-2">
                                <p className="text-[10px] font-semibold uppercase text-emerald-700">Dopo</p>
                                <p className="text-xs text-emerald-900 break-words">{formatValue(diff.after)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Agent Run Info */}
                  {detail.agentRun && (
                    <div className="bg-muted/30 rounded-xl p-4">
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <Bot className="w-4 h-4 text-primary" /> Agente:{" "}
                        {detail.agentRun.agentName}
                      </h4>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>Stato: {detail.agentRun.status}</p>
                        {detail.agentRun.durationMs && (
                          <p>Durata: {detail.agentRun.durationMs}ms</p>
                        )}
                        {detail.agentRun.inputSummary && (
                          <p>Input: {detail.agentRun.inputSummary}</p>
                        )}
                        {detail.agentRun.errorMessage && (
                          <p className="text-red-600">
                            Errore: {detail.agentRun.errorMessage}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Payload */}
                  {detail.suggestion.payloadJson && (
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-11"
                        onClick={() => setShowTechnicalData((value) => !value)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        {showTechnicalData ? "Nascondi dati tecnici" : "Mostra dati tecnici"}
                      </Button>
                      {showTechnicalData && (
                        <pre className="mt-3 bg-muted/50 rounded-xl p-4 text-xs overflow-x-auto max-h-80 whitespace-pre-wrap font-mono">
                          {JSON.stringify(detail.suggestion.payloadJson, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {detail.suggestion.notes && (
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                      <h4 className="text-sm font-semibold text-amber-800 mb-1">
                        Note
                      </h4>
                      <p className="text-sm text-amber-700">
                        {detail.suggestion.notes}
                      </p>
                    </div>
                  )}

                  <Separator />

                  {/* Actions */}
                  {detail.suggestion.status === "pending_review" && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold">Azioni</h4>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
                          onClick={() => handleApprove(detail.suggestion.id)}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" /> Approva
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1"
                          onClick={() => {
                            if (showEditNotes) {
                              handleReject(detail.suggestion.id);
                            } else {
                              setShowEditNotes(true);
                            }
                          }}
                        >
                          <XCircle className="w-4 h-4 mr-1" /> Rifiuta
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleArchive(detail.suggestion.id)}
                        >
                          <Archive className="w-4 h-4" />
                        </Button>
                      </div>
                      {showEditNotes && (
                        <div className="space-y-2">
                          <Input
                            placeholder="Motivo del rifiuto (opzionale)..."
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              className="flex-1"
                              onClick={() => handleReject(detail.suggestion.id)}
                            >
                              Conferma Rifiuto
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setShowEditNotes(false);
                                setEditNotes("");
                              }}
                            >
                              Annulla
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {detail.suggestion.status === "approved" && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold">Azioni</h4>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
                          onClick={() => handleApply(detail.suggestion.id)}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" /> Applica
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleArchive(detail.suggestion.id)}
                        >
                          <Archive className="w-4 h-4 mr-1" /> Archivia
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        In questo step Applica chiude il workflow senza modificare i dati finali.
                      </p>
                    </div>
                  )}

                  {detail.suggestion.status === "applied" && (
                    <div className="rounded-lg border bg-blue-50 p-4 text-blue-800">
                      <p className="text-sm font-semibold">Suggerimento applicato</p>
                      <p className="text-xs mt-1">
                        Workflow completato. Nessuna modifica automatica ai cataloghi e stata eseguita in questo step.
                      </p>
                    </div>
                  )}

                  {(detail.suggestion.status === "rejected" || detail.suggestion.status === "archived") && (
                    <div className="rounded-lg border bg-muted/40 p-4">
                      <p className="text-sm font-semibold">
                        {detail.suggestion.status === "archived" ? "Suggerimento archiviato" : "Suggerimento rifiutato"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        La decisione resta nello storico audit della proposta.
                      </p>
                    </div>
                  )}

                  {detail.auditTrail && detail.auditTrail.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <History className="w-4 h-4" /> Audit decisioni
                      </h4>
                      <div className="space-y-2">
                        {detail.auditTrail.slice(0, 5).map((event) => (
                          <div key={event.id} className="rounded-md border p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium">
                                {humanizeKey(event.action.replace("admin_suggestion_", ""))}
                              </p>
                              <p className="text-xs text-muted-foreground shrink-0">
                                {fmtShortDate(event.createdAt)}
                              </p>
                            </div>
                            {event.metadata?.notes != null && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Note: {formatValue(event.metadata.notes)}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
    </>
  );
}
