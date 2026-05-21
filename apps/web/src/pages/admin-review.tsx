import {
  AffiliationSection,
  AgentsSection,
  BusinessMetricsSection,
  ConfidenceBadge,
  EntityBadge,
  HomeSection,
  MessagesSection,
  PromptsSection,
  QualitySection,
  StatusBadge,
  StatusSection,
  SubscriptionsSection,
  auditActionLabel,
  fmtDate,
  fmtShortDate,
  formatLastUpdated,
  type AdminOverview,
  type AgentPrompt,
  type AgentsOverview,
  type AgentsTab,
  type AiModelPolicy,
  type PersistenceMeta,
  type PromptEditorTab,
  type PromptPreview,
  type PromptVersion,
  type SidebarSection,
  type WendyQualityOverview,
} from "@/components/admin/console";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import {
  ADMIN_NAV_GROUPS,
  PATH_BY_SECTION,
  TITLE_BY_SECTION,
  sectionFromLocation,
} from "@/features/admin-review/adminReviewConfig";
import type {
  AuditLogEntry,
  DashboardStats,
  Suggestion,
  SuggestionDetail,
} from "@/features/admin-review/adminReviewTypes";
import { AdminLogsSection } from "@/features/admin-review/components/AdminLogsSection";
import { AdminSettingsSection } from "@/features/admin-review/components/AdminSettingsSection";
import { AgentHealthSection } from "@/features/admin-review/components/AgentHealthSection";
import { CatalogsSection } from "@/features/admin-review/components/CatalogsSection";
import { GrowthQueueSection } from "@/features/admin-review/components/GrowthQueueSection";
import { MemoryGraphSection } from "@/features/admin-review/components/MemoryGraphSection";
import { SuggestionDetailPanel } from "@/features/admin-review/components/SuggestionDetailPanel";
import { useAdminAffiliations } from "@/features/admin-review/hooks/useAdminAffiliations";
import { useAdminCatalogs } from "@/features/admin-review/hooks/useAdminCatalogs";
import { useAdminMessages } from "@/features/admin-review/hooks/useAdminMessages";
import { useAdminStatus } from "@/features/admin-review/hooks/useAdminStatus";
import { useAdminSubscriptions } from "@/features/admin-review/hooks/useAdminSubscriptions";
import { useAgentHealth } from "@/features/admin-review/hooks/useAgentHealth";
import { useBusinessMetrics } from "@/features/admin-review/hooks/useBusinessMetrics";
import { useGrowthQueue } from "@/features/admin-review/hooks/useGrowthQueue";
import { useMemoryGraph } from "@/features/admin-review/hooks/useMemoryGraph";
import { apiFetch as rawApiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";
import { readApiError, readApiErrorFields } from "./admin-review-api";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Filter,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

function localApiUnavailableMessage(path: string) {
  const target = path.includes("business-status")
    ? "le metriche business"
    : "la console admin";
  if (import.meta.env.DEV) {
    return `Server locale non raggiungibile per ${target}. Avvia il backend su porta 3001 e il web su 5173, poi riprova.`;
  }
  return `API non raggiungibile per ${target}. Riprova tra poco.`;
}

function isLocalProxyFailure(status: number, bodyText: string | null) {
  if (!import.meta.env.DEV || status < 500 || !bodyText) return false;
  return /ECONNREFUSED|proxy|connect|localhost:3001|127\.0\.0\.1:3001/i.test(
    bodyText,
  );
}

function compactPersistenceMeta(meta: {
  persistenceUnavailable?: boolean | undefined;
  reason?: string | null | undefined;
  setupAction?: string | null | undefined;
}): PersistenceMeta {
  const compact: PersistenceMeta = {};
  if (meta.persistenceUnavailable !== undefined) {
    compact.persistenceUnavailable = meta.persistenceUnavailable;
  }
  if (meta.reason !== undefined) {
    compact.reason = meta.reason;
  }
  if (meta.setupAction !== undefined) {
    compact.setupAction = meta.setupAction;
  }
  return compact;
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
  const [agentsOverviewData, setAgentsOverviewData] =
    useState<AgentsOverview | null>(null);
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
  const [promptVersions, setPromptVersions] = useState<
    Record<string, PromptVersion[]>
  >({});
  const [promptPreview, setPromptPreview] = useState<
    Record<string, PromptPreview>
  >({});
  const [promptVersionPersistence, setPromptVersionPersistence] = useState<
    Record<string, PersistenceMeta>
  >({});
  const [promptSaving, setPromptSaving] = useState<Set<string>>(new Set());
  const [aiModelPolicy, setAiModelPolicy] = useState<AiModelPolicy | null>(
    null,
  );

  // Qualita section
  const [qualitaData, setQualitaData] = useState<WendyQualityOverview | null>(
    null,
  );
  const [qualitaLoading, setQualitaLoading] = useState(false);
  const [qualitaDays, setQualitaDays] = useState("30");

  // Home section
  const [homeData, setHomeData] = useState<AdminOverview | null>(null);
  const [homeLoading, setHomeLoading] = useState(false);

  const apiFetch = useCallback(
    async <T = unknown,>(path: string, options?: RequestInit): Promise<T> => {
      if (!token || adminForbidden) {
        throw new Error("auth");
      }

      let res: Response;
      try {
        res = await rawApiFetch(`${BASE}api${path}`, {
          ...options,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            ...(options?.headers || {}),
          },
        });
      } catch (error) {
        const message = localApiUnavailableMessage(path);
        setAdminError(message);
        throw new Error(message, { cause: error });
      }
      if (res.status === 401) {
        logout();
        throw new Error("auth");
      }
      if (res.status === 403) {
        setAdminForbidden(true);
        setAdminError(
          "Accesso non autorizzato: il tuo account non ha il ruolo admin.",
        );
        throw new Error("forbidden");
      }
      if (!res.ok) {
        let errorBody: unknown = null;
        let errorText: string | null = null;
        try {
          errorBody = (await res.clone().json()) as unknown;
        } catch {
          try {
            errorText = await res.text();
          } catch {
            errorText = null;
          }
        }
        const message = isLocalProxyFailure(res.status, errorText)
          ? localApiUnavailableMessage(path)
          : (readApiError(errorBody) ??
            `Errore ${res.status} durante il caricamento della console admin.`);
        setAdminError(message);
        const error = new Error(message) as Error & {
          fields?: Record<string, string>;
        };
        const fields = readApiErrorFields(errorBody);
        if (fields) error.fields = fields;
        throw error;
      }
      const data = (await res.json()) as unknown;
      setAdminError(null);
      setLastUpdatedAt(new Date().toISOString());
      return data as T;
    },
    [adminForbidden, logout, token],
  );

  const metriche = useBusinessMetrics(apiFetch);
  const abbonamenti = useAdminSubscriptions(apiFetch);
  const statusSetup = useAdminStatus(apiFetch);
  const cataloghi = useAdminCatalogs(apiFetch);
  const crescita = useGrowthQueue(apiFetch);
  const memory = useMemoryGraph(apiFetch, setAdminError);
  const messaggi = useAdminMessages(apiFetch);
  const affiliazione = useAdminAffiliations(apiFetch);
  const agentHealth = useAgentHealth(apiFetch);

  const metricheData = metriche.data;
  const metricheLoading = metriche.loading;
  const metricheError = metriche.error;
  const loadMetriche = metriche.load;

  const abbonamentiData = abbonamenti.data;
  const abbonamentiDetail = abbonamenti.detail;
  const abbonamentiLoading = abbonamenti.loading;
  const abbonamentiDetailLoading = abbonamenti.detailLoading;
  const abbonamentiActionLoading = abbonamenti.actionLoading;
  const abbonamentiSearch = abbonamenti.search;
  const abbonamentiPlan = abbonamenti.planFilter;
  const abbonamentiStatus = abbonamenti.statusFilter;
  const abbonamentiFields = abbonamenti.fields;
  const abbonamentiForm = abbonamenti.form;
  const setAbbonamentiSearch = abbonamenti.setSearch;
  const setAbbonamentiPlan = abbonamenti.setPlanFilter;
  const setAbbonamentiStatus = abbonamenti.setStatusFilter;
  const setAbbonamentiForm = abbonamenti.setForm;
  const loadAbbonamenti = abbonamenti.load;
  const saveAbbonamento = abbonamenti.save;

  const statusData = statusSetup.data;
  const statusLoading = statusSetup.loading;
  const statusError = statusSetup.error;
  const opsData = statusSetup.opsData;
  const opsLoading = statusSetup.opsLoading;
  const opsActionLoading = statusSetup.opsActionLoading;
  const opsError = statusSetup.opsError;
  const loadStatus = statusSetup.load;
  const loadOpsStatus = statusSetup.loadOps;
  const runOpsAction = statusSetup.runOpsAction;
  const toggleMaintenanceMode = statusSetup.toggleMaintenanceMode;
  const loadCataloghi = cataloghi.load;
  const cataloghiLoading = cataloghi.loading;
  const loadCrescita = crescita.load;
  const crescitaLoading = crescita.loading;
  const loadMemoryGraph = memory.load;
  const loadMessaggi = messaggi.load;
  const loadAffiliazione = affiliazione.load;
  const loadAgentiSalute = agentHealth.load;

  const openStatusSetup = useCallback(() => {
    setSection("status");
    setLocation("/admin/status");
  }, [setLocation]);

  const loadStats = useCallback(async () => {
    try {
      const data = await apiFetch<DashboardStats>("/admin/stats");
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
      if (filterConfidence !== "all")
        params.set("confidence_min", filterConfidence);
      if (searchTerm) params.set("search", searchTerm);
      params.set("limit", "100");
      const data = await apiFetch<{ items: Suggestion[]; total: number }>(`/admin/suggestions?${params}`);
      setSuggestions(data.items);
      setSuggestionsTotal(data.total);
    } catch {
      /* handled */
    }
    setLoading(false);
  }, [
    apiFetch,
    filterStatus,
    filterEntity,
    filterConfidence,
    searchTerm,
    section,
  ]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<AuditLogEntry[]>("/admin/logs?limit=100");
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
        const data = await apiFetch<SuggestionDetail>(`/admin/suggestions/${id}`);
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
        apiFetch<AgentPrompt[]>("/admin/prompts"),
        apiFetch<{ policy?: AiModelPolicy | null }>("/admin/ai/model-policy"),
      ]);
      setPrompts(data);
      setAiModelPolicy(policyData.policy ?? null);
      const vals: Record<string, string> = {};
      const notes: Record<string, string> = {};
      for (const p of data) {
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
        const data = await apiFetch<{
          versions?: PromptVersion[];
        } & PersistenceMeta>(`/admin/prompts/${key}/versions`);
        setPromptVersions((prev) => ({
          ...prev,
          [key]: data.versions ?? [],
        }));
        setPromptVersionPersistence((prev) => ({
          ...prev,
          [key]: compactPersistenceMeta({
            persistenceUnavailable: data.persistenceUnavailable,
            reason: data.reason,
            setupAction: data.setupAction,
          }),
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
        const data = await apiFetch<PromptPreview>(`/admin/prompts/${key}/preview`, {
          method: "POST",
          body: JSON.stringify({ value: promptEditValues[key] ?? "" }),
        });
        setPromptPreview((prev) => ({
          ...prev,
          [key]: data,
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
      const data = await apiFetch<AgentsOverview>(
        `/admin/agents/overview?days=${agentDays}&limit=100`,
      );
      setAgentsOverviewData(data);
    } catch {
      /* handled */
    }
    setAgentsOverviewLoading(false);
  }, [agentDays, apiFetch]);

  const loadQualita = useCallback(async () => {
    setQualitaLoading(true);
    try {
      const data = await apiFetch<WendyQualityOverview>(
        `/admin/quality/overview?days=${qualitaDays}&limit=50`,
      );
      setQualitaData(data);
    } catch {
      /* handled */
    }
    setQualitaLoading(false);
  }, [apiFetch, qualitaDays]);

  const loadHome = useCallback(async () => {
    setHomeLoading(true);
    try {
      const data = await apiFetch<AdminOverview>("/admin/overview");
      setHomeData(data);
    } catch {
      /* handled */
    }
    setHomeLoading(false);
  }, [apiFetch]);

  const triggerAgent = useCallback(
    async (agentKey: string, path: string, body?: Record<string, unknown>) => {
      if (agentsRunning.has(agentKey)) return;
      setAgentsRunning((prev) => new Set(prev).add(agentKey));
      setAgentsResult((prev) => ({
        ...prev,
        [agentKey]: { ok: false, data: { status: "running..." } },
      }));
      try {
        const data = await apiFetch<Record<string, unknown>>(path, {
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
      setPromptSaving((prev) =>
        new Set(prev).add(`${key}:rollback:${versionId}`),
      );
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
    } else if (section === "messaggi") loadMessaggi();
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
    cataloghi.reset();
    agentHealth.reset();
    setAgentsOverviewData(null);
    memory.reset();
    metriche.reset();
    abbonamenti.reset();
    setHomeData(null);
    statusSetup.reset();
    messaggi.reset();
    crescita.reset();
    affiliazione.reset();
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
    await Promise.all([
      loadSuggestions(),
      loadStats(),
      homeData ? loadHome() : Promise.resolve(),
    ]);
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
    if (section === "suggestions" || section === "queue")
      void loadSuggestions();
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
    } else if (section === "messaggi") void loadMessaggi();
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
    memory.loading ||
    promptsLoading ||
    qualitaLoading ||
    cataloghiLoading ||
    agentHealth.loading ||
    metricheLoading ||
    abbonamentiLoading ||
    abbonamentiDetailLoading ||
    abbonamentiActionLoading ||
    homeLoading ||
    statusLoading ||
    opsLoading ||
    Boolean(opsActionLoading) ||
    messaggi.loading ||
    crescitaLoading ||
    affiliazione.loading;

  const pendingCount = stats?.pending ?? 0;
  const queueSuggestions =
    section === "queue"
      ? suggestions.filter((s) => s.status === "pending_review")
      : suggestions;
  const promptsPersistence = prompts.find(
    (prompt) => prompt.persistenceUnavailable,
  );
  const promptsPersistenceMeta: PersistenceMeta = promptsPersistence
    ? compactPersistenceMeta({
        persistenceUnavailable: true,
        reason: promptsPersistence.reason,
        setupAction: promptsPersistence.setupAction,
      })
    : {};

  useEffect(() => {
    setSection(sectionFromLocation(location));
    setDetail(null);
  }, [location]);

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
            <div className="bg-warning-surface rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-warning">
                {stats.pending}
              </div>
              <div className="text-[10px] text-warning uppercase tracking-wider">
                In Attesa
              </div>
            </div>
            <div className="bg-success-surface rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-success">
                {stats.approved}
              </div>
              <div className="text-[10px] text-success uppercase tracking-wider">
                Approvati
              </div>
            </div>
            <div className="bg-danger-surface rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-danger">
                {stats.rejected}
              </div>
              <div className="text-[10px] text-danger uppercase tracking-wider">
                Rifiutati
              </div>
            </div>
            <div className="bg-muted rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-foreground">
                {stats.totalRuns}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Esecuzioni
              </div>
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
                      <span className="text-xs bg-warning text-primary-foreground px-1.5 py-0.5 rounded-full min-w-5 text-center">
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
                  {section === "queue" && pendingCount > 0
                    ? ` (${pendingCount})`
                    : ""}
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
                <RefreshCw
                  className={cn(
                    "w-4 h-4 sm:mr-2",
                    isRefreshing && "animate-spin",
                  )}
                />
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
                      <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4 opacity-60" />
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
                                <Badge
                                  variant="outline"
                                  className="text-xs capitalize"
                                >
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
                <MemoryGraphSection
                  memory={memory}
                  fmtShortDate={fmtShortDate}
                />
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
                <AdminLogsSection logs={logs} fmtDate={fmtDate} />
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
                <AdminSettingsSection
                  stats={stats}
                  suggestionsTotal={suggestionsTotal}
                />
              )}

              {/* -- Home Admin -- */}
              {section === "home" && (
                <HomeSection
                  data={homeData}
                  loading={homeLoading}
                  onRefresh={loadHome}
                  onNavigateSection={navigateToSection}
                />
              )}

              {/* -- Cataloghi -- */}
              {section === "cataloghi" && (
                <CatalogsSection
                  catalogs={cataloghi}
                  onOpenStatus={openStatusSetup}
                />
              )}

              {/* -- Agent Health -- */}
              {section === "agenti-salute" && (
                <AgentHealthSection agentHealth={agentHealth} />
              )}

              {/* -- Metriche Business -- */}
              {section === "metriche" && (
                <BusinessMetricsSection
                  data={metricheData}
                  loading={metricheLoading}
                  error={metricheError}
                  onRefresh={loadMetriche}
                  onNavigateSection={navigateToSection}
                />
              )}

              {/* -- Abbonamenti -- */}
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
                  onSelectUser={abbonamenti.selectUser}
                  onSave={saveAbbonamento}
                />
              )}

              {/* -- Status & Setup -- */}
              {section === "status" && (
                <StatusSection
                  data={statusData}
                  loading={statusLoading}
                  error={statusError}
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

              {/* -- Messaggi -- */}
              {section === "messaggi" && (
                <MessagesSection
                  data={messaggi.data}
                  loading={messaggi.loading}
                  search={messaggi.search}
                  readFilter={messaggi.read}
                  statusFilter={messaggi.status}
                  assignedToFilter={messaggi.assignedTo}
                  selectedMessage={messaggi.selected}
                  notes={messaggi.notes}
                  actionLoading={messaggi.actionLoading}
                  currentUserId={user?.id ?? null}
                  onSearchChange={messaggi.setSearch}
                  onReadFilterChange={messaggi.setRead}
                  onStatusFilterChange={messaggi.setStatus}
                  onAssignedToFilterChange={messaggi.setAssignedTo}
                  onSelectMessage={messaggi.selectMessage}
                  onNotesChange={messaggi.setNotes}
                  onRefresh={loadMessaggi}
                  onUpdateMessage={messaggi.update}
                />
              )}

              {/* -- Coda Crescita -- */}
              {section === "crescita" && (
                <GrowthQueueSection
                  growth={crescita}
                  auditActionLabel={auditActionLabel}
                  fmtShortDate={(value) =>
                    value ? fmtShortDate(value) : "n/d"
                  }
                />
              )}

              {/* -- Partner / Affiliazione -- */}
              {section === "affiliazione" && (
                <AffiliationSection
                  data={affiliazione.data}
                  loading={affiliazione.loading}
                  search={affiliazione.search}
                  readFilter={affiliazione.read}
                  statusFilter={affiliazione.status}
                  sourceFilter={affiliazione.source}
                  assignedToFilter={affiliazione.assignedTo}
                  selectedLead={affiliazione.selected}
                  notes={affiliazione.notes}
                  actionLoading={affiliazione.actionLoading}
                  currentUserId={user?.id ?? null}
                  onSearchChange={affiliazione.setSearch}
                  onReadFilterChange={affiliazione.setRead}
                  onStatusFilterChange={affiliazione.setStatus}
                  onSourceFilterChange={affiliazione.setSource}
                  onAssignedToFilterChange={affiliazione.setAssignedTo}
                  onSelectLead={affiliazione.selectLead}
                  onNotesChange={affiliazione.setNotes}
                  onRefresh={loadAffiliazione}
                  onUpdateLead={affiliazione.update}
                />
              )}
            </div>
            {detail && (
              <SuggestionDetailPanel
                detail={detail}
                detailLoading={detailLoading}
                showTechnicalData={showTechnicalData}
                showEditNotes={showEditNotes}
                editNotes={editNotes}
                onClose={() => setDetail(null)}
                onTechnicalDataToggle={setShowTechnicalData}
                onShowEditNotesChange={setShowEditNotes}
                onEditNotesChange={setEditNotes}
                onApprove={handleApprove}
                onReject={handleReject}
                onArchive={handleArchive}
                onApply={handleApply}
              />
            )}
          </div>
        </main>{" "}
      </div>
    </>
  );
}
