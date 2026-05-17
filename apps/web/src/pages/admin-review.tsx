import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { API_ENDPOINTS } from "@/lib/constants";
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
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { AdminAuthGate } from "@/components/AdminAuthGate";

const BASE = import.meta.env.BASE_URL || "/";

type SuggestionStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "archived";
type EntityType =
  | "sector"
  | "role"
  | "education_path"
  | "calendar_plan"
  | "growth_content"
  | "work_mode";

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
};

type AgentRun = {
  id: number;
  agentName: string;
  userId: number | null;
  inputSummary: string | null;
  outputSummary: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
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
  archived: number;
  totalRuns: number;
};

type SuggestionDetail = {
  suggestion: Suggestion;
  agentRun: AgentRun | null;
  queueItem: { id: number; queueStatus: string; priority: string } | null;
};

const STATUS_CONFIG: Record<
  SuggestionStatus,
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  draft: {
    label: "Bozza",
    color: "bg-slate-100 text-slate-700",
    icon: FileText,
  },
  pending_review: {
    label: "In Revisione",
    color: "bg-amber-100 text-amber-700",
    icon: Clock,
  },
  approved: {
    label: "Approvato",
    color: "bg-emerald-100 text-emerald-700",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rifiutato",
    color: "bg-red-100 text-red-700",
    icon: XCircle,
  },
  archived: {
    label: "Archiviato",
    color: "bg-slate-100 text-slate-500",
    icon: Archive,
  },
};

const ENTITY_CONFIG: Record<string, { label: string; icon: typeof Briefcase }> =
  {
    sector: { label: "Settore", icon: BarChart3 },
    role: { label: "Ruolo", icon: Briefcase },
    education_path: { label: "Piano", icon: GraduationCap },
    calendar_plan: { label: "Calendario", icon: Calendar },
    growth_content: { label: "Crescita", icon: TrendingUp },
    work_mode: { label: "Work Mode", icon: Sparkles },
  };

type SidebarSection =
  | "queue"
  | "suggestions"
  | "runs"
  | "logs"
  | "settings"
  | "agents"
  | "prompts"
  | "qualita"
  | "cataloghi"
  | "agenti-salute"
  | "metriche"
  | "home"
  | "status"
  | "messaggi"
  | "crescita"
  | "affiliazione";

type AgentRunRecord = {
  id: string;
  agent: "news" | "growth";
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  status: "running" | "completed" | "failed";
  input: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
};

type AgentPrompt = {
  key: string;
  label: string;
  description: string;
  placeholders: string[];
  defaultValue: string;
  currentValue: string;
  isOverridden: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtShortDate(iso: string) {
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: SuggestionStatus }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        cfg.color,
      )}
    >
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

function EntityBadge({ type }: { type: string }) {
  const cfg = ENTITY_CONFIG[type] || { label: type, icon: FileText };
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  const pct = Math.round(score * 100);
  const color =
    pct >= 80
      ? "text-emerald-600"
      : pct >= 50
        ? "text-amber-600"
        : "text-red-600";
  return (
    <span className={cn("text-xs font-mono font-semibold", color)}>{pct}%</span>
  );
}

export default function AdminReview() {
  useEffect(() => {
    document.title = "Admin Review â€” NorthStar";
  }, []);

  const { key, isAuthenticated, authError, login, logout, setAuthError } = useAdminAuth();

  const [section, setSection] = useState<SidebarSection>("queue");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsTotal, setSuggestionsTotal] = useState(0);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<SuggestionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterEntity, setFilterEntity] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [showEditNotes, setShowEditNotes] = useState(false);

  const [agentsRunning, setAgentsRunning] = useState<Set<string>>(new Set());
  const [agentsResult, setAgentsResult] = useState<
    Record<string, { ok: boolean; data: Record<string, unknown> }>
  >({});
  const [newsSectorInput, setNewsSectorInput] = useState("");
  const [runHistory, setRunHistory] = useState<AgentRunRecord[]>([]);
  const [runHistoryLoading, setRunHistoryLoading] = useState(false);

  const [prompts, setPrompts] = useState<AgentPrompt[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [promptExpandedKey, setPromptExpandedKey] = useState<string | null>(
    null,
  );
  const [promptEditValues, setPromptEditValues] = useState<
    Record<string, string>
  >({});
  const [promptSaving, setPromptSaving] = useState<Set<string>>(new Set());

// Qualita section
const [qualitaData, setQualitaData] = useState<any | null>(null);
const [qualitaLoading, setQualitaLoading] = useState(false);

// Cataloghi section
const [cataloghiData, setCataloghiData] = useState<any>(null);
const [cataloghiLoading, setCataloghiLoading] = useState(false);

// Agenti salute section
const [agentiSaluteData, setAgentiSaluteData] = useState<any | null>(null);
const [agentiSaluteLoading, setAgentiSaluteLoading] = useState(false);

// Metriche section
const [metricheData, setMetricheData] = useState<any | null>(null);
const [wendyMetricsData, setWendyMetricsData] = useState<any | null>(null);
const [metricheLoading, setMetricheLoading] = useState(false);

// Home section
const [homeData, setHomeData] = useState<any>(null);
const [homeLoading, setHomeLoading] = useState(false);

// Status section
const [statusData, setStatusData] = useState<any | null>(null);
const [statusLoading, setStatusLoading] = useState(false);

// Messaggi section
const [messaggiData, setMessaggiData] = useState<any[]>([]);
const [messaggiLoading, setMessaggiLoading] = useState(false);

// Crescita section
const [crescitaData, setCrescitaData] = useState<any | null>(null);
const [crescitaLoading, setCrescitaLoading] = useState(false);

// Affiliazione section
const [affiliazioneData, setAffiliazioneData] = useState<any[]>([]);
const [affiliazioneLoading, setAffiliazioneLoading] = useState(false);

  const apiFetch = useCallback(
    async (path: string, options?: RequestInit) => {
      const res = await fetch(`${BASE}api${path}`, {
        ...options,
        headers: {
          "x-admin-key": key,
          "Content-Type": "application/json",
          ...(options?.headers || {}),
        },
      });
      if (res.status === 403) {
        setAuthError(true);
        setAuthError(true);
        throw new Error("auth");
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    [key],
  );

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
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterEntity !== "all") params.set("entity_type", filterEntity);
      if (searchTerm) params.set("search", searchTerm);
      params.set("limit", "100");
      const data = await apiFetch(`/admin/suggestions?${params}`);
      setSuggestions(data.items);
      setSuggestionsTotal(data.total);

    } catch {
      /* handled */
    }
    setLoading(false);
  }, [apiFetch, filterStatus, filterEntity, searchTerm]);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/admin/agent-runs?limit=100");
      setRuns(data);

    } catch {
      /* handled */
    }
    setLoading(false);
  }, [apiFetch]);

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
      const data = await apiFetch("/admin/prompts");
      setPrompts(data as AgentPrompt[]);
      const vals: Record<string, string> = {};
      for (const p of data as AgentPrompt[]) vals[p.key] = p.currentValue;
      setPromptEditValues(vals);

    } catch {
      /* handled */
    }
    setPromptsLoading(false);
  }, [apiFetch]);

  const loadRunHistory = useCallback(async () => {
    setRunHistoryLoading(true);
    try {
      const data = await apiFetch("/admin/research/runs");
      setRunHistory(data as AgentRunRecord[]);

    } catch {
      /* handled */
    }
    setRunHistoryLoading(false);
  }, [apiFetch]);

  const loadQualita = useCallback(async () => {
    setQualitaLoading(true);
    try {
      const data = await apiFetch("/admin/quality");
      setQualitaData(data);

    } catch {
      /* handled */
    }
    setQualitaLoading(false);
  }, [apiFetch]);

  const loadCataloghi = useCallback(async () => {
    setCataloghiLoading(true);
    try {
      // Since cataloghi uses different endpoints, we'll fetch the main data
      // For simplicity, we'll fetch sectors as representative data
      const data = await apiFetch("/admin/catalogs/sectors");
      setCataloghiData(data);

    } catch {
      /* handled */
    }
    setCataloghiLoading(false);
  }, [apiFetch]);

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
      const [metricsRes, wendyRes] = await Promise.all([
        apiFetch("/admin/metrics"),
        apiFetch("/admin/wendy-metrics")
      ]);
      setMetricheData(metricsRes);
      setWendyMetricsData(wendyRes);

    } catch {
      /* handled */
    }
    setMetricheLoading(false);
  }, [apiFetch]);

  const loadHome = useCallback(async () => {
    setHomeLoading(true);
    try {
      // Home page doesn't have a specific API endpoint, so we'll set a flag
      setHomeData({ loaded: true });

    } catch {
      /* handled */
    }
    setHomeLoading(false);
  }, [apiFetch]);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      // /api/health è pubblico (no admin-key) — usa fetch nativo bypassando apiFetch locale
      const healthRes = await fetch(API_ENDPOINTS.health);
      const data = healthRes.ok ? await healthRes.json() : {};
      setStatusData(data);

    } catch {
      /* handled */
    }
    setStatusLoading(false);
  }, [apiFetch]);

  const loadMessaggi = useCallback(async () => {
    setMessaggiLoading(true);
    try {
      const data = await apiFetch("/contact/messages");
      setMessaggiData(data);

    } catch {
      /* handled */
    }
    setMessaggiLoading(false);
  }, [apiFetch]);

  const loadCrescita = useCallback(async () => {
    setCrescitaLoading(true);
    try {
      const data = await apiFetch("/admin/growth-queue");
      setCrescitaData(data);

    } catch {
      /* handled */
    }
    setCrescitaLoading(false);
  }, [apiFetch]);

  const loadAffiliazione = useCallback(async () => {
    setAffiliazioneLoading(true);
    try {
      const data = await apiFetch("/affiliazione/leads");
      setAffiliazioneData(data);

    } catch {
      /* handled */
    }
    setAffiliazioneLoading(false);
  }, [apiFetch]);

  const triggerAgent = useCallback(
    async (agentKey: string, path: string, body?: Record<string, unknown>) => {
      if (agentsRunning.has(agentKey)) return;
      setAgentsRunning((prev) => new Set(prev).add(agentKey));
      setAgentsResult((prev) => ({
        ...prev,
        [agentKey]: { ok: false, data: { status: "runningâ€¦" } },
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
      loadRunHistory();
    },
    [agentsRunning, apiFetch, loadRunHistory],
  );

  const savePrompt = useCallback(
    async (key: string) => {
      setPromptSaving((prev) => new Set(prev).add(key));
      try {
        await apiFetch(`/admin/prompts/${key}`, {
          method: "PUT",
          body: JSON.stringify({ value: promptEditValues[key] }),
        });
        await loadPrompts();
      } catch {
        /* handled */
      }
      setPromptSaving((prev) => {
        const s = new Set(prev);
        s.delete(key);
        return s;
      });
    },
    [apiFetch, promptEditValues, loadPrompts],
  );

  const resetPrompt = useCallback(
    async (key: string) => {
      setPromptSaving((prev) => new Set(prev).add(key));
      try {
        await apiFetch(`/admin/prompts/${key}`, { method: "DELETE" });
        await loadPrompts();
      } catch {
        /* handled */
      }
      setPromptSaving((prev) => {
        const s = new Set(prev);
        s.delete(key);
        return s;
      });
    },
    [apiFetch, loadPrompts],
  );

  useEffect(() => {
    if (!key) return;
    loadStats();
  }, [key, loadStats]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (section === "suggestions" || section === "queue") loadSuggestions();
    else if (section === "runs") loadRuns();
    else if (section === "logs") loadLogs();
    else if (section === "prompts") loadPrompts();
    else if (section === "agents") loadRunHistory();
    else if (section === "qualita") loadQualita();
    else if (section === "cataloghi") loadCataloghi();
    else if (section === "agenti-salute") loadAgentiSalute();
    else if (section === "metriche") loadMetriche();
    else if (section === "home") loadHome();
    else if (section === "status") loadStatus();
    else if (section === "messaggi") loadMessaggi();
    else if (section === "crescita") loadCrescita();
    else if (section === "affiliazione") loadAffiliazione();
  }, [
    isAuthenticated,
    section,
    loadSuggestions,
    loadRuns,
    loadLogs,
    loadPrompts,
    loadRunHistory,
    loadQualita,
    loadCataloghi,
    loadAgentiSalute,
    loadMetriche,
    loadHome,
    loadStatus,
    loadMessaggi,
    loadCrescita,
    loadAffiliazione,
  ]);

  function handleLogout() {
    logout();
    setStats(null);
    setSuggestions([]);
    setDetail(null);
    setQualitaData(null);
    setCataloghiData(null);
    setAgentiSaluteData(null);
    setMetricheData(null);
    setWendyMetricsData(null);
    setHomeData(null);
    setStatusData(null);
    setMessaggiData([]);
    setCrescitaData(null);
    setAffiliazioneData([]);
  }

  async function handleApprove(id: number) {
    try {
      await apiFetch(`/admin/suggestions/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      loadSuggestions();
      loadStats();
      if (detail?.suggestion.id === id) loadDetail(id);
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
      loadSuggestions();
      loadStats();
      if (detail?.suggestion.id === id) loadDetail(id);
    } catch {
      /* handled */
    }
  }

  async function handleArchive(id: number) {
    try {
      await apiFetch(`/admin/suggestions/${id}/archive`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      loadSuggestions();
      loadStats();
      if (detail?.suggestion.id === id) loadDetail(id);
    } catch {
      /* handled */
    }
  }

  const sidebarItems: {
    key: SidebarSection;
    label: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    count?: number;
  }[] = [
    { key: "queue", label: "Queue Revisione", icon: ClipboardList, count: stats?.pending },
    { key: "suggestions", label: "Suggerimenti", icon: Bot },
    { key: "runs", label: "Esecuzioni Agenti", icon: History },
    { key: "logs", label: "Audit Log", icon: FileText },
    { key: "agents", label: "Lancia Agenti", icon: Terminal },
    { key: "prompts", label: "Prompt Agenti", icon: Code2 },
    { key: "qualita", label: "QualitÃ  Wendy", icon: BarChart3 },
    { key: "cataloghi", label: "Cataloghi", icon: BookOpen },
    { key: "agenti-salute", label: "Agent Health", icon: Activity },
    { key: "metriche", label: "Metriche Business", icon: BarChart3 },
    { key: "home", label: "Home Admin", icon: Home },
    { key: "status", label: "Status & Setup", icon: Settings },
    { key: "messaggi", label: "Messaggi", icon: MessageCircle },
    { key: "crescita", label: "Coda Crescita", icon: Sparkles },
    { key: "affiliazione", label: "Partner", icon: Handshake },
    { key: "settings", label: "Impostazioni", icon: Settings },
  ];

  const pendingCount = stats?.pending ?? 0;
  const queueSuggestions =
    section === "queue"
      ? suggestions.filter((s) => s.status === "pending_review")
      : suggestions;

  return (
    <AdminAuthGate title="Admin Review" description="Pannello di controllo per la revisione dei risultati AI">
      <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col shrink-0">
        <div className="p-6 border-b">
          <div className="flex items-center gap-2 mb-1">
            <Bot className="w-5 h-5 text-primary" />
            <h1 className="font-serif font-bold text-lg">Admin Review</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Pannello di controllo AI
          </p>
        </div>

        {stats && (
          <div className="p-4 border-b">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-amber-700">
                  {stats.pending}
                </div>
                <div className="text-[10px] text-amber-600 uppercase tracking-wider">
                  In Attesa
                </div>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-emerald-700">
                  {stats.approved}
                </div>
                <div className="text-[10px] text-emerald-600 uppercase tracking-wider">
                  Approvati
                </div>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-red-700">
                  {stats.rejected}
                </div>
                <div className="text-[10px] text-red-600 uppercase tracking-wider">
                  Rifiutati
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-slate-700">
                  {stats.totalRuns}
                </div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Esecuzioni
                </div>
              </div>
            </div>
          </div>
        )}

        <nav className="flex-1 p-3 space-y-1">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setSection(item.key);
                  setDetail(null);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                  section === item.key
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.count != null && item.count > 0 && (
                  <span className="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded-full min-w-5 text-center">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" /> Esci
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b bg-card flex items-center justify-between px-6 shrink-0">
          <h2 className="font-semibold text-foreground">
            {section === "queue" &&
              `Queue Revisione${pendingCount > 0 ? ` (${pendingCount})` : ""}`}
            {section === "suggestions" &&
              `Tutti i Suggerimenti (${suggestionsTotal})`}
            {section === "runs" && "Esecuzioni Agenti"}
            {section === "logs" && "Audit Log"}
            {section === "settings" && "Impostazioni"}
            {section === "agents" && "Lancia Agenti di Ricerca"}
            {section === "prompts" && "Gestione Prompt AI"}
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                loadStats();
                if (section === "suggestions" || section === "queue")
                  loadSuggestions();
                else if (section === "runs") loadRuns();
                else if (section === "logs") loadLogs();
                else if (section === "prompts") loadPrompts();
              }}
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
          </div>
        </header>

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
                        placeholder="Cerca per nomeâ€¦"
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
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="text-sm border rounded-lg px-3 py-1.5 bg-background"
                      >
                        <option value="all">Tutti gli stati</option>
                        <option value="pending_review">In Revisione</option>
                        <option value="approved">Approvati</option>
                        <option value="rejected">Rifiutati</option>
                        <option value="archived">Archiviati</option>
                        <option value="draft">Bozze</option>
                      </select>
                      <select
                        value={filterEntity}
                        onChange={(e) => setFilterEntity(e.target.value)}
                        className="text-sm border rounded-lg px-3 py-1.5 bg-background"
                      >
                        <option value="all">Tutti i tipi</option>
                        <option value="sector">Settori</option>
                        <option value="role">Ruoli</option>
                        <option value="education_path">Percorsi</option>
                        <option value="calendar_plan">Calendari</option>
                        <option value="growth_content">Crescita</option>
                        <option value="work_mode">Work Mode</option>
                      </select>
                    </div>
                  )}
                </div>

                {loading ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Caricamentoâ€¦
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

            {section === "runs" && (
              <div className="divide-y">
                {runs.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    Nessuna esecuzione registrata
                  </div>
                ) : (
                  runs.map((run) => (
                    <div key={run.id} className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-foreground">
                          {run.agentName}
                        </span>
                        <Badge
                          variant={
                            run.status === "completed"
                              ? "secondary"
                              : "destructive"
                          }
                          className="text-xs"
                        >
                          {run.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{fmtShortDate(run.startedAt)}</span>
                        {run.durationMs != null && (
                          <span>{run.durationMs}ms</span>
                        )}
                        {run.userId && <span>User #{run.userId}</span>}
                      </div>
                      {run.errorMessage && (
                        <p className="text-xs text-red-600 mt-1 truncate">
                          {run.errorMessage}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
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
                          {log.action} â€” {log.targetType} #{log.targetId}
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

            {section === "agents" && (
              <div className="p-6 space-y-6 max-w-2xl">
                <p className="text-sm text-muted-foreground">
                  Avvia manualmente una sessione di ricerca AI. Il processo puÃ²
                  richiedere 1-3 minuti.
                </p>

                {/* News Research */}
                <div className="bg-card border rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                      <Terminal className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold">News Research</h4>
                      <p className="text-xs text-muted-foreground">
                        Raccoglie notizie dal mercato del lavoro italiano
                        tramite Tavily
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Input
                      placeholder="Aree specifiche (opzionale, separati da virgola)"
                      value={newsSectorInput}
                      onChange={(e) => setNewsSectorInput(e.target.value)}
                      className="text-sm"
                    />
                    <Button
                      size="sm"
                      disabled={agentsRunning.has("news")}
                      onClick={() => {
                        const sectors = newsSectorInput.trim()
                          ? newsSectorInput
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean)
                          : [];
                        triggerAgent("news", "/admin/research/news/run", {
                          sectorNames: sectors,
                        });
                      }}
                      className="w-full"
                    >
                      {agentsRunning.has("news") ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> In
                          esecuzioneâ€¦
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" /> Avvia News Research
                        </>
                      )}
                    </Button>
                  </div>
                  {agentsResult["news"] && (
                    <div
                      className={cn(
                        "rounded-xl p-4 text-sm font-mono",
                        agentsResult["news"].ok
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-red-50 text-red-800",
                      )}
                    >
                      {agentsResult["news"].ok ? (
                        <p>
                          Completato â€” aggiunti:{" "}
                          <strong>
                            {String(agentsResult["news"].data.added ?? 0)}
                          </strong>
                          , controllati:{" "}
                          <strong>
                            {String(agentsResult["news"].data.checked ?? 0)}
                          </strong>
                        </p>
                      ) : (
                        <p>{JSON.stringify(agentsResult["news"].data)}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Growth Research */}
                <div className="bg-card border rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Growth Research</h4>
                      <p className="text-xs text-muted-foreground">
                        Genera articoli di crescita professionale tramite AI
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={agentsRunning.has("growth")}
                    onClick={() =>
                      triggerAgent("growth", "/admin/research/growth/run")
                    }
                    className="w-full"
                  >
                    {agentsRunning.has("growth") ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> In
                        esecuzioneâ€¦
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" /> Avvia Growth Research
                      </>
                    )}
                  </Button>
                  {agentsResult["growth"] && (
                    <div
                      className={cn(
                        "rounded-xl p-4 text-sm font-mono",
                        agentsResult["growth"].ok
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-red-50 text-red-800",
                      )}
                    >
                      {agentsResult["growth"].ok ? (
                        <p>
                          Completato â€” aggiunti:{" "}
                          <strong>
                            {String(agentsResult["growth"].data.added ?? 0)}
                          </strong>
                          , tentati:{" "}
                          <strong>
                            {String(agentsResult["growth"].data.attempted ?? 0)}
                          </strong>
                        </p>
                      ) : (
                        <p>{JSON.stringify(agentsResult["growth"].data)}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Run History */}
                <div className="bg-card border rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-muted-foreground" />
                      <h4 className="font-semibold text-sm">
                        Storico Esecuzioni
                      </h4>
                      <span className="text-xs text-muted-foreground">
                        ({runHistory.length} run in memoria)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={loadRunHistory}
                      disabled={runHistoryLoading}
                      className="h-7 px-2"
                    >
                      <RefreshCw
                        className={cn(
                          "w-3.5 h-3.5",
                          runHistoryLoading && "animate-spin",
                        )}
                      />
                    </Button>
                  </div>

                  {runHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nessuna esecuzione in questa sessione. Avvia un agente per
                      vedere la cronologia.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {runHistory.map((run) => {
                        const isNews = run.agent === "news";
                        const secs =
                          run.durationMs != null
                            ? (run.durationMs / 1000).toFixed(1)
                            : null;
                        const sectors = Array.isArray(
                          (run.input as { sectorNames?: string[] }).sectorNames,
                        )
                          ? (
                              run.input as { sectorNames: string[] }
                            ).sectorNames.join(", ")
                          : "";

                        return (
                          <div
                            key={run.id}
                            className={cn(
                              "flex items-start gap-3 rounded-xl p-3 text-sm border",
                              run.status === "completed" &&
                                "bg-emerald-50/60 border-emerald-100",
                              run.status === "failed" &&
                                "bg-red-50/60 border-red-100",
                              run.status === "running" &&
                                "bg-amber-50/60 border-amber-100",
                            )}
                          >
                            <div
                              className={cn(
                                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                                isNews ? "bg-blue-100" : "bg-emerald-100",
                              )}
                            >
                              {isNews ? (
                                <Terminal className="w-3.5 h-3.5 text-blue-600" />
                              ) : (
                                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium capitalize">
                                  {isNews ? "News Research" : "Growth Research"}
                                </span>
                                <span
                                  className={cn(
                                    "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                                    run.status === "completed" &&
                                      "bg-emerald-100 text-emerald-700",
                                    run.status === "failed" &&
                                      "bg-red-100 text-red-700",
                                    run.status === "running" &&
                                      "bg-amber-100 text-amber-700",
                                  )}
                                >
                                  {run.status === "completed"
                                    ? "Completato"
                                    : run.status === "failed"
                                      ? "Fallito"
                                      : "In esecuzioneâ€¦"}
                                </span>
                                {secs && (
                                  <span className="text-xs text-muted-foreground">
                                    {secs}s
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {fmtDate(run.startedAt)}
                                {sectors && (
                                  <span className="ml-2">
                                    Â· Aree: {sectors}
                                  </span>
                                )}
                              </div>
                              {run.status === "completed" && run.result && (
                                <p className="text-xs mt-1 font-mono text-emerald-700">
                                  {isNews
                                    ? `aggiunti ${String(run.result.added ?? 0)}, controllati ${String(run.result.checked ?? 0)}`
                                    : `aggiunti ${String(run.result.added ?? 0)} su ${String(run.result.attempted ?? 0)} tentati`}
                                </p>
                              )}
                              {run.status === "failed" && run.error && (
                                <p className="text-xs mt-1 font-mono text-red-600 truncate">
                                  {run.error}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

             {section === "prompts" && (
               <div className="p-6 space-y-3 max-w-3xl">
                 <p className="text-sm text-muted-foreground mb-4">
                   Modifica i prompt degli agenti AI. Le modifiche sono salvate
                   nel database e hanno effetto immediato. Usa{" "}
                   <code className="bg-muted px-1 py-0.5 rounded text-xs">
                     {"{{PLACEHOLDER}}"}
                   </code>{" "}
                   per i valori dinamici.
                 </p>

                 {promptsLoading ? (
                   <div className="p-8 text-center text-muted-foreground">
                     Caricamento promptâ€¦
                   </div>
                 ) : (
                   prompts.map((prompt) => {
                     const isExpanded = promptExpandedKey === prompt.key;
                     const isSaving = promptSaving.has(prompt.key);
                     const isDirty =
                       promptEditValues[prompt.key] !== prompt.currentValue;

                     return (
                       <div
                         key={prompt.key}
                         className="bg-card border rounded-2xl overflow-hidden"
                       >
                         <button
                           className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                           onClick={() =>
                             setPromptExpandedKey(isExpanded ? null : prompt.key)
                           }
                         >
                           <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-2 flex-wrap">
                               <span className="font-medium text-sm">
                                 {prompt.label}
                               </span>
                               {prompt.isOverridden && (
                                 <Badge
                                   variant="secondary"
                                   className="text-[10px] bg-amber-100 text-amber-700 border-0"
                                 >
                                   Modificato
                                 </Badge>
                               )}
                             </div>
                             <p className="text-xs text-muted-foreground mt-0.5 truncate">
                               {prompt.description}
                             </p>
                             {prompt.placeholders.length > 0 && (
                               <div className="flex gap-1 flex-wrap mt-1">
                                 {prompt.placeholders.map((p) => (
                                   <code
                                     key={p}
                                     className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded"
                                   >
                                     {p}
                                   </code>
                                 ))}
               </div>
             )}

           </div>
                           {isExpanded ? (
                             <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                           ) : (
                             <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                           )}
                         </button>

                         {isExpanded && (
                           <div className="border-t p-4 space-y-3 bg-muted/10">
                             <textarea
                               value={promptEditValues[prompt.key] ?? ""}
                               onChange={(e) =>
                                 setPromptEditValues((prev) => ({
                                   ...prev,
                                   [prompt.key]: e.target.value,
                                 }))
                               }
                               rows={Math.max(
                                 8,
                                 (promptEditValues[prompt.key] ?? "").split("\n")
                                   .length + 2,
                               )}
                               className="w-full text-xs font-mono border rounded-xl p-3 bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
                             />
                             <div className="flex items-center gap-2">
                               <Button
                                 size="sm"
                                 disabled={isSaving || !isDirty}
                                 onClick={() => savePrompt(prompt.key)}
                               >
                                 {isSaving ? (
                                   <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />
                                 ) : (
                                   <Save className="w-3 h-3 mr-1.5" />
                                 )}
                                 Salva
                               </Button>
                               {prompt.isOverridden && (
                                 <Button
                                   size="sm"
                                   variant="outline"
                                   disabled={isSaving}
                                   onClick={() => resetPrompt(prompt.key)}
                                 >
                                   <RotateCcw className="w-3 h-3 mr-1.5" />
                                   Ripristina Default
                                 </Button>
                               )}
                               {isDirty && (
                                 <span className="text-xs text-amber-600 ml-auto">
                                   Modifiche non salvate
                                 </span>
                               )}
                               {prompt.updatedAt && (
                                 <span className="text-xs text-muted-foreground ml-auto">
                                   Aggiornato: {fmtShortDate(prompt.updatedAt)}
                                 </span>
                               )}
                             </div>
                           </div>
             )}
           </div>
                     );
                   })
                 )}
               </div>
             )}
             {section === "qualita" && (
               <div className="p-8">
                 <h3 className="text-lg font-serif font-bold mb-4">
                   QualitÃ  Wendy
                 </h3>
                 {qualitaLoading ? (
                   <div className="text-center py-8 text-muted-foreground">
                     Caricamento dati qualitÃ ...
                   </div>
                 ) : !qualitaData ? (
                   <div className="text-center py-8 text-muted-foreground">
                     Nessun dato qualitÃ  disponibile
                   </div>
                 ) : (
                   <>
                     {/* Totali */}
                     {qualitaData.totals && (
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                         <div className="bg-card border rounded-xl p-4">
                           <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                             Totale conversazioni
                           </h4>
                           <p className="text-2xl font-bold text-foreground">
                             {qualitaData.totals.total.toLocaleString()}
                           </p>
                         </div>
                         <div className="bg-card border rounded-xl p-4">
                           <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                             Eval score medio
                           </h4>
                           <p className="text-2xl font-bold text-foreground">
                             {qualitaData.totals.avgEvalScore ? (qualitaData.totals.avgEvalScore * 100).toFixed(0) + "%" : "N/D"}
                           </p>
                         </div>
                         <div className="bg-card border rounded-xl p-4">
                           <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                             Supervisor score medio
                           </h4>
                           <p className="text-2xl font-bold text-foreground">
                             {qualitaData.totals.avgSupervisorScore ? (qualitaData.totals.avgSupervisorScore * 100).toFixed(0) + "%" : "N/D"}
                           </p>
                         </div>
                         <div className="bg-card border rounded-xl p-4">
                           <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                             Rewrite rate
                           </h4>
                           <p className="text-2xl font-bold text-foreground">
                             {qualitaData.totals.total > 0 ? `${((qualitaData.totals.rewrites / qualitaData.totals.total) * 100).toFixed(1)}%` : "0%"}
                           </p>
                           <p className="text-xs text-muted-foreground mt-1">
                             {qualitaData.totals.rewrites} riscritte
                           </p>
                         </div>
                         <div className="bg-card border rounded-xl p-4">
                           <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                             Chiarificazioni
                           </h4>
                           <p className="text-2xl font-bold text-foreground">
                             {qualitaData.totals.total > 0 ? `${((qualitaData.totals.clarifications / qualitaData.totals.total) * 100).toFixed(1)}%` : "0%"}
                           </p>
                           <p className="text-xs text-muted-foreground mt-1">
                             {qualitaData.totals.clarifications} richieste
                           </p>
                         </div>
                         <div className="bg-card border rounded-xl p-4">
                           <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                             UI tools usati
                           </h4>
                           <p className="text-2xl font-bold text-foreground">
                             {String(qualitaData.totals.uiTools)}
                           </p>
                           <p className="text-xs text-muted-foreground mt-1">
                             {qualitaData.totals.total > 0 ? ((qualitaData.totals.uiTools / qualitaData.totals.total) * 100).toFixed(1) + "%" : "0%"} dei turni
                           </p>
                         </div>
                       </div>
                     )}
                     
                     {/* Per dominio */}
                     {qualitaData.qualityStats && qualitaData.qualityStats.length > 0 && (
                       <div className="mb-6">
                         <h4 className="font-semibold mb-4">Metriche per dominio</h4>
                          <div className="overflow-x-auto">
                           <table className="w-full text-sm">
                             <thead>
                               <tr className="border-b border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase">
                                 <th className="px-4 py-3 text-left">Dominio</th>
                                 <th className="px-4 py-3 text-right">Turni</th>
                                 <th className="px-4 py-3 text-right">Eval score</th>
                                 <th className="px-4 py-3 text-right">Supervisor</th>
                                 <th className="px-4 py-3 text-right">Rewrite</th>
                                 <th className="px-4 py-3 text-right">Chiarif.</th>
                                 <th className="px-4 py-3 text-right">UI tool</th>
                               </tr>
                             </thead>
                             <tbody>
                                {qualitaData.qualityStats.map((s: any) => (
                                 <tr key={s.domain} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                                   <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 capitalize">{s.domain}</td>
                                   <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{s.total}</td>
                                   <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{(s.avgEvalScore * 100).toFixed(0)}%</td>
                                   <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{s.avgSupervisorScore ? `${(s.avgSupervisorScore * 100).toFixed(0)}%` : "â€”"}</td>
                                   <td className="px-4 py-3 text-right">
                                     <span className={s.rewrites > 0 ? "text-amber-500 font-medium" : "text-gray-400"}>
                                       {s.rewrites} ({(s.rewrites / Math.max(s.total, 1) * 100).toFixed(0)}%)
                                     </span>
                                   </td>
                                   <td className="px-4 py-3 text-right">
                                     <span className={s.clarifications > 0 ? "text-blue-500 font-medium" : "text-gray-400"}>
                                       {s.clarifications}
                                     </span>
                                   </td>
                                   <td className="px-4 py-3 text-right">
                                     <span className={s.uiTools > 0 ? "text-green-500 font-medium" : "text-gray-400"}>
                                       {s.uiTools}
                                     </span>
                                   </td>
                                 </tr>
                               ))}
                             </tbody>
                           </table>
                         </div>
                       </div>
                     )}
                     
                     {/* Supervisor stats */}
                     {qualitaData.supervisorStats && qualitaData.supervisorStats.length > 0 && (
                       <div className="mb-6">
                         <h4 className="font-semibold mb-4">Supervisor â€” score prima/dopo rewrite</h4>
                         <div className="overflow-x-auto">
                           <table className="w-full text-sm">
                             <thead>
                               <tr className="border-b border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase">
                                 <th className="px-4 py-3 text-left">Dominio</th>
                                 <th className="px-4 py-3 text-right">Rewrite totali</th>
                                 <th className="px-4 py-3 text-right">Score prima (media)</th>
                                 <th className="px-4 py-3 text-right">Score dopo (media)</th>
                                 <th className="px-4 py-3 text-right">Miglioramento</th>
                               </tr>
                             </thead>
                             <tbody>
                                {qualitaData.supervisorStats.map((s: any) => {
                                 const improvement = s.avgScoreAfter && s.avgScoreBefore
                                   ? ((s.avgScoreAfter - s.avgScoreBefore) * 100).toFixed(1)
                                   : "â€”";
                                 const isPositive = s.avgScoreAfter && s.avgScoreAfter > s.avgScoreBefore;
                                 return (
                                   <tr key={s.domain} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                                     <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 capitalize">{s.domain}</td>
                                     <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{s.total}</td>
                                     <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{s.avgScoreBefore ? `${(s.avgScoreBefore * 100).toFixed(0)}%` : "â€”"}</td>
                                     <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{s.avgScoreAfter ? `${(s.avgScoreAfter * 100).toFixed(0)}%` : "â€”"}</td>
                                     <td className={`px-4 py-3 text-right font-medium ${isPositive ? "text-green-500" : "text-red-400"}`}>
                                       {improvement !== "â€”" ? `${isPositive ? "+" : ""}${improvement}%` : improvement}
                                     </td>
                                   </tr>
                                 );
                               })}
                             </tbody>
                           </table>
                         </div>
                       </div>
                     )}
                   </>
                 )}
               </div>
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
              <div className="p-8">
                <h3 className="text-lg font-serif font-bold mb-4">
                  <Home className="w-5 h-5 inline mr-2 text-primary" />
                  Panoramica Admin
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { label: "In Attesa", value: stats?.pending ?? 0, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30" },
                    { label: "Approvati", value: stats?.approved ?? 0, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
                    { label: "Rifiutati", value: stats?.rejected ?? 0, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/30" },
                    { label: "Archiviati", value: stats?.archived ?? 0, color: "text-slate-600", bg: "bg-slate-50 dark:bg-slate-950/30" },
                    { label: "Esecuzioni Agenti", value: stats?.totalRuns ?? 0, color: "text-primary", bg: "bg-primary/5" },
                    { label: "Suggerimenti Totali", value: suggestionsTotal, color: "text-primary", bg: "bg-primary/5" },
                  ].map((card) => (
                    <div key={card.label} className={`rounded-xl p-4 ${card.bg} border`}>
                      <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Cataloghi ── */}
            {section === "cataloghi" && (
              <div className="p-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-serif font-bold">
                    <BookOpen className="w-5 h-5 inline mr-2 text-primary" />
                    Cataloghi
                  </h3>
                  <Button size="sm" variant="outline" onClick={loadCataloghi} disabled={cataloghiLoading}>
                    {cataloghiLoading ? <RefreshCw size={13} className="animate-spin mr-1" /> : <RefreshCw size={13} className="mr-1" />}
                    Aggiorna
                  </Button>
                </div>
                {cataloghiLoading ? (
                  <p className="text-sm text-muted-foreground">Caricamento...</p>
                ) : cataloghiData ? (
                  <div className="space-y-2">
                    {(Array.isArray(cataloghiData) ? cataloghiData : []).map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                        <div>
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-md">{item.description}</p>
                        </div>
                        <Badge variant="outline" className="capitalize">{item.trend}</Badge>
                      </div>
                    ))}
                    {Array.isArray(cataloghiData) && cataloghiData.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">Nessun settore trovato.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Nessun dato disponibile.</p>
                )}
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
              <div className="p-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-serif font-bold">
                    <BarChart3 className="w-5 h-5 inline mr-2 text-primary" />
                    Metriche Business
                  </h3>
                  <Button size="sm" variant="outline" onClick={loadMetriche} disabled={metricheLoading}>
                    {metricheLoading ? <RefreshCw size={13} className="animate-spin mr-1" /> : <RefreshCw size={13} className="mr-1" />}
                    Aggiorna
                  </Button>
                </div>
                {metricheLoading ? (
                  <p className="text-sm text-muted-foreground">Caricamento...</p>
                ) : metricheData ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-xl p-4 bg-card border text-center">
                        <p className="text-2xl font-bold">{metricheData.users?.total ?? 0}</p>
                        <p className="text-xs text-muted-foreground">Utenti Totali</p>
                      </div>
                      <div className="rounded-xl p-4 bg-card border text-center">
                        <p className="text-2xl font-bold text-primary">{metricheData.users?.premium ?? 0}</p>
                        <p className="text-xs text-muted-foreground">Premium</p>
                      </div>
                      <div className="rounded-xl p-4 bg-card border text-center">
                        <p className="text-2xl font-bold">{metricheData.tests?.total ?? 0}</p>
                        <p className="text-xs text-muted-foreground">Test Completati</p>
                      </div>
                      <div className="rounded-xl p-4 bg-card border text-center">
                        <p className="text-2xl font-bold">{metricheData.users?.new30d ?? 0}</p>
                        <p className="text-xs text-muted-foreground">Nuovi (30gg)</p>
                      </div>
                    </div>
                    {metricheData.topSectors && metricheData.topSectors.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2 text-sm">Settori più popolari</h4>
                        <div className="space-y-1">
                          {metricheData.topSectors.slice(0, 5).map((s: any) => (
                            <div key={s.sectorId} className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                              <span className="text-sm">{s.name}</span>
                              <Badge variant="outline">{s.count}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {wendyMetricsData && (
                      <div>
                        <h4 className="font-semibold mb-2 text-sm">Wendy AI — Richieste per Dominio</h4>
                        <div className="space-y-1">
                          {Object.entries(wendyMetricsData.volumeByDomain ?? {}).map(([domain, count]) => (
                            <div key={domain} className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                              <span className="text-sm capitalize">{domain}</span>
                              <Badge variant="outline">{String(count)}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Nessun dato disponibile.</p>
                )}
              </div>
            )}

            {/* ── Status & Setup ── */}
            {section === "status" && (
              <div className="p-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-serif font-bold">
                    <Settings className="w-5 h-5 inline mr-2 text-primary" />
                    Status & Setup
                  </h3>
                  <Button size="sm" variant="outline" onClick={loadStatus} disabled={statusLoading}>
                    {statusLoading ? <RefreshCw size={13} className="animate-spin mr-1" /> : <RefreshCw size={13} className="mr-1" />}
                    Aggiorna
                  </Button>
                </div>
                {statusLoading ? (
                  <p className="text-sm text-muted-foreground">Caricamento...</p>
                ) : statusData ? (
                  <div className="space-y-4">
                    <div className={`rounded-xl p-4 border ${
                      statusData.status === "ok" ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30" :
                      statusData.status === "degraded" ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30" :
                      "bg-red-50 border-red-200 dark:bg-red-950/30"
                    }`}>
                      <h4 className="font-semibold mb-2">Stato Generale: <span className="capitalize">{statusData.status}</span></h4>
                      <p className="text-xs text-muted-foreground">Uptime: {Math.floor(statusData.uptimeSeconds / 3600)}h {Math.floor((statusData.uptimeSeconds % 3600) / 60)}m</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {Object.entries(statusData.services ?? {}).map(([name, svc]: [string, any]) => (
                        <div key={name} className={`rounded-xl p-3 border ${
                          svc.status === "ok" ? "bg-emerald-50 border-emerald-200" :
                          svc.status === "not_configured" ? "bg-amber-50 border-amber-200" :
                          "bg-red-50 border-red-200"
                        }`}>
                          <p className="text-sm font-medium capitalize">{name}</p>
                          <p className={`text-xs ${
                            svc.status === "ok" ? "text-emerald-600" :
                            svc.status === "not_configured" ? "text-amber-600" :
                            "text-red-600"
                          }`}>{svc.status.replace("_", " ")}</p>
                          {svc.latencyMs > 0 && <p className="text-xs text-muted-foreground">{svc.latencyMs}ms</p>}
                        </div>
                      ))}
                    </div>
                    {statusData.env && (
                      <div>
                        <h4 className="font-semibold mb-2 text-sm">Environment Variables</h4>
                        <p className="text-xs text-muted-foreground">Configurate: {statusData.env.configured}/{statusData.env.total}</p>
                        {statusData.env.missingRequired && statusData.env.missingRequired.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-red-600 font-medium">Mancanti (richieste):</p>
                            <p className="text-xs text-red-500 font-mono">{statusData.env.missingRequired.join(", ")}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Nessun dato disponibile.</p>
                )}
              </div>
            )}

            {/* ── Messaggi ── */}
            {section === "messaggi" && (
              <div className="p-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-serif font-bold">
                    <MessageCircle className="w-5 h-5 inline mr-2 text-primary" />
                    Messaggi
                  </h3>
                  <Button size="sm" variant="outline" onClick={loadMessaggi} disabled={messaggiLoading}>
                    {messaggiLoading ? <RefreshCw size={13} className="animate-spin mr-1" /> : <RefreshCw size={13} className="mr-1" />}
                    Aggiorna
                  </Button>
                </div>
                {messaggiLoading ? (
                  <p className="text-sm text-muted-foreground">Caricamento...</p>
                ) : messaggiData.length > 0 ? (
                  <div className="space-y-2">
                    {messaggiData.map((msg: any) => (
                      <div key={msg.id} className="p-4 rounded-xl border bg-card">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <p className="text-sm font-medium">{msg.name}</p>
                            <p className="text-xs text-muted-foreground">{msg.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {msg.subject && (
                              <Badge variant="outline" className="capitalize">{msg.subject}</Badge>
                            )}
                            <span className="text-xs text-muted-foreground">{new Date(msg.createdAt).toLocaleDateString("it-IT")}</span>
                          </div>
                        </div>
                        <p className="text-sm mt-2 text-muted-foreground line-clamp-2">{msg.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Nessun messaggio.</p>
                )}
              </div>
            )}

            {/* ── Coda Crescita ── */}
            {section === "crescita" && (
              <div className="p-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-serif font-bold">
                    <Sparkles className="w-5 h-5 inline mr-2 text-primary" />
                    Coda Articoli Crescita
                  </h3>
                  <Button size="sm" variant="outline" onClick={loadCrescita} disabled={crescitaLoading}>
                    {crescitaLoading ? <RefreshCw size={13} className="animate-spin mr-1" /> : <RefreshCw size={13} className="mr-1" />}
                    Aggiorna
                  </Button>
                </div>
                {crescitaLoading ? (
                  <p className="text-sm text-muted-foreground">Caricamento...</p>
                ) : crescitaData?.queue ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="rounded-xl p-3 bg-amber-50 dark:bg-amber-950/30 border text-center">
                        <p className="text-xl font-bold text-amber-600">{crescitaData.stats?.pending ?? 0}</p>
                        <p className="text-xs text-muted-foreground">In coda</p>
                      </div>
                      <div className="rounded-xl p-3 bg-emerald-50 dark:bg-emerald-950/30 border text-center">
                        <p className="text-xl font-bold text-emerald-600">{crescitaData.stats?.published ?? 0}</p>
                        <p className="text-xs text-muted-foreground">Pubblicati</p>
                      </div>
                      <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border text-center">
                        <p className="text-xl font-bold text-red-600">{crescitaData.stats?.rejected ?? 0}</p>
                        <p className="text-xs text-muted-foreground">Scartati</p>
                      </div>
                    </div>
                    {crescitaData.queue.map((article: any) => (
                      <div key={article.id} className="p-4 rounded-xl border bg-card">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm">{article.title}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {article.category}{article.subcategory ? ` / ${article.subcategory}` : ""}
                              {" · "}
                              {article.readTimeMinutes} min
                              {" · "}
                              {new Date(article.createdAt).toLocaleDateString("it-IT")}
                            </p>
                          </div>
                          <Badge variant="outline" className="capitalize">{article.difficulty}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{article.description}</p>
                      </div>
                    ))}
                    {crescitaData.queue.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">Nessun articolo in coda.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Nessun dato disponibile.</p>
                )}
              </div>
            )}

            {/* ── Partner / Affiliazione ── */}
            {section === "affiliazione" && (
              <div className="p-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-serif font-bold">
                    <Handshake className="w-5 h-5 inline mr-2 text-primary" />
                    Partner & Affiliazioni
                  </h3>
                  <Button size="sm" variant="outline" onClick={loadAffiliazione} disabled={affiliazioneLoading}>
                    {affiliazioneLoading ? <RefreshCw size={13} className="animate-spin mr-1" /> : <RefreshCw size={13} className="mr-1" />}
                    Aggiorna
                  </Button>
                </div>
                {affiliazioneLoading ? (
                  <p className="text-sm text-muted-foreground">Caricamento...</p>
                ) : affiliazioneData.length > 0 ? (
                  <div className="space-y-2">
                    {affiliazioneData.map((lead: any) => (
                      <div key={lead.id} className="p-4 rounded-xl border bg-card">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <p className="text-sm font-medium">{lead.institutionName}</p>
                            <p className="text-xs text-muted-foreground">{lead.contactName} · {lead.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">{lead.partnerType?.replace("_", " ")}</Badge>
                            <Badge className={
                              lead.status === "nuovo" ? "bg-primary/10 text-primary border-primary/30" :
                              lead.status === "contattato" ? "bg-yellow-100 text-yellow-700 border-yellow-200" :
                              lead.status === "in_trattativa" ? "bg-orange-100 text-orange-700 border-orange-200" :
                              "bg-emerald-100 text-emerald-700 border-emerald-200"
                            }>
                              {lead.status}
                            </Badge>
                          </div>
                        </div>
                        {lead.message && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{lead.message}</p>}
                        <p className="text-xs text-muted-foreground mt-1">{new Date(lead.createdAt).toLocaleDateString("it-IT")}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Nessuna richiesta di affiliazione.</p>
                )}
              </div>
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
                  Caricamento dettagliâ€¦
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
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <Eye className="w-4 h-4" /> Contenuto Completo
                      </h4>
                      <pre className="bg-muted/50 rounded-xl p-4 text-xs overflow-x-auto max-h-80 whitespace-pre-wrap font-mono">
                        {JSON.stringify(detail.suggestion.payloadJson, null, 2)}
                      </pre>
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
                            placeholder="Motivo del rifiuto (opzionale)â€¦"
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

                  {detail.suggestion.status !== "pending_review" && (
                    <div className="flex gap-2">
                      {detail.suggestion.status !== "archived" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleArchive(detail.suggestion.id)}
                        >
                          <Archive className="w-4 h-4 mr-1" /> Archivia
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
    </AdminAuthGate>
  );
}
