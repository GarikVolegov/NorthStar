import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
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
} from "lucide-react";

const BASE = import.meta.env.BASE_URL || "/";
const LS_KEY = "ns_admin_key";

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
    education_path: { label: "Percorso", icon: GraduationCap },
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
  | "prompts";

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
    document.title = "Admin Review — NorthStar";
  }, []);

  const [key, setKey] = useState(() => localStorage.getItem(LS_KEY) || "");
  const [inputKey, setInputKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState(false);

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
        setAuthed(false);
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
      setAuthed(true);
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
      setAuthed(true);
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
      setAuthed(true);
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
      setAuthed(true);
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
      setAuthed(true);
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
      setAuthed(true);
    } catch {
      /* handled */
    }
    setRunHistoryLoading(false);
  }, [apiFetch]);

  const triggerAgent = useCallback(
    async (agentKey: string, path: string, body?: Record<string, unknown>) => {
      if (agentsRunning.has(agentKey)) return;
      setAgentsRunning((prev) => new Set(prev).add(agentKey));
      setAgentsResult((prev) => ({
        ...prev,
        [agentKey]: { ok: false, data: { status: "running…" } },
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
    if (!authed) return;
    if (section === "suggestions" || section === "queue") loadSuggestions();
    else if (section === "runs") loadRuns();
    else if (section === "logs") loadLogs();
    else if (section === "prompts") loadPrompts();
    else if (section === "agents") loadRunHistory();
  }, [
    authed,
    section,
    loadSuggestions,
    loadRuns,
    loadLogs,
    loadPrompts,
    loadRunHistory,
  ]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputKey.trim();
    if (!trimmed) return;
    localStorage.setItem(LS_KEY, trimmed);
    setKey(trimmed);
    setAuthError(false);
  }

  function handleLogout() {
    localStorage.removeItem(LS_KEY);
    setKey("");
    setAuthed(false);
    setStats(null);
    setSuggestions([]);
    setDetail(null);
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

  if (!authed) {
    return (
      <div className="min-h-screen bg-linear-to-b from-slate-50 to-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="rounded-3xl border bg-card p-8 shadow-sm">
            <div className="flex flex-col items-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <ShieldAlert className="w-7 h-7 text-primary" />
              </div>
              <h1 className="text-xl font-serif font-bold text-foreground">
                Admin Review
              </h1>
              <p className="text-sm text-muted-foreground text-center mt-1">
                Pannello di controllo per la revisione dei risultati AI
              </p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="password"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="Chiave admin…"
                className="text-center"
              />
              {authError && (
                <p className="text-destructive text-sm text-center">
                  Chiave non valida.
                </p>
              )}
              <Button type="submit" className="w-full">
                Accedi
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const sidebarItems: {
    key: SidebarSection;
    label: string;
    icon: typeof ClipboardList;
    count?: number;
  }[] = [
    {
      key: "queue",
      label: "Queue Revisione",
      icon: ClipboardList,
      count: stats?.pending,
    },
    { key: "suggestions", label: "Suggerimenti", icon: Bot },
    { key: "runs", label: "Esecuzioni Agenti", icon: History },
    { key: "logs", label: "Audit Log", icon: FileText },
    { key: "agents", label: "Lancia Agenti", icon: Terminal },
    { key: "prompts", label: "Prompt Agenti", icon: Code2 },
    { key: "settings", label: "Impostazioni", icon: Settings },
  ];

  const pendingCount = stats?.pending ?? 0;
  const queueSuggestions =
    section === "queue"
      ? suggestions.filter((s) => s.status === "pending_review")
      : suggestions;

  return (
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
                        placeholder="Cerca per nome…"
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
                    Caricamento…
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
                          {log.action} — {log.targetType} #{log.targetId}
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
                  Avvia manualmente una sessione di ricerca AI. Il processo può
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
                      placeholder="Settori specifici (opzionale, separati da virgola)"
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
                          esecuzione…
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
                          Completato — aggiunti:{" "}
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
                        esecuzione…
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
                          Completato — aggiunti:{" "}
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
                                      : "In esecuzione…"}
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
                                    · Settori: {sectors}
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
                    Caricamento prompt…
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
          </div>

          {/* Detail Panel */}
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
                  Caricamento dettagli…
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
                            placeholder="Motivo del rifiuto (opzionale)…"
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
  );
}
