import { type SidebarSection } from "@/components/admin/console";
import { useAuth } from "@/contexts/AuthContext";
import {
  PATH_BY_SECTION,
  sectionFromLocation,
} from "@/features/admin-review/adminReviewConfig";
import type {
  AuditLogEntry,
  DashboardStats,
  Suggestion,
  SuggestionDetail,
} from "@/features/admin-review/adminReviewTypes";
import { AdminReviewShell } from "@/features/admin-review/components/AdminReviewShell";
import { useAdminAffiliations } from "@/features/admin-review/hooks/useAdminAffiliations";
import { useAdminCatalogs } from "@/features/admin-review/hooks/useAdminCatalogs";
import { useAdminMessages } from "@/features/admin-review/hooks/useAdminMessages";
import { useAdminOverviewPanels } from "@/features/admin-review/hooks/useAdminOverviewPanels";
import { useAdminPromptControls } from "@/features/admin-review/hooks/useAdminPromptControls";
import { useAdminReviewApiFetch } from "@/features/admin-review/hooks/useAdminReviewApiFetch";
import { useAdminStatus } from "@/features/admin-review/hooks/useAdminStatus";
import { useAdminSubscriptions } from "@/features/admin-review/hooks/useAdminSubscriptions";
import { useAgentHealth } from "@/features/admin-review/hooks/useAgentHealth";
import { useBusinessMetrics } from "@/features/admin-review/hooks/useBusinessMetrics";
import { useGrowthQueue } from "@/features/admin-review/hooks/useGrowthQueue";
import { useMemoryGraph } from "@/features/admin-review/hooks/useMemoryGraph";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";


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


  const apiFetch = useAdminReviewApiFetch({
    token,
    adminForbidden,
    logout,
    setAdminError,
    setAdminForbidden,
    setLastUpdatedAt,
  });

  const panels = useAdminOverviewPanels(apiFetch);
  const {
    agentDays,
    agentFilter,
    agentsOverviewData,
    agentsOverviewLoading,
    agentsResult,
    agentsRunning,
    agentsTab,
    agentStatusFilter,
    homeData,
    homeLoading,
    loadAgentsOverview,
    loadHome,
    loadQualita,
    newsSectorInput,
    qualitaData,
    qualitaDays,
    qualitaLoading,
    resetOverviewPanels,
    setAgentDays,
    setAgentFilter,
    setAgentsTab,
    setAgentStatusFilter,
    setNewsSectorInput,
    setQualitaDays,
    triggerAgent,
  } = panels;

  const {
    aiModelPolicy,
    loadPromptPreview,
    loadPromptVersions,
    loadPrompts,
    promptEditValues,
    promptExpandedKey,
    promptNotes,
    promptPreview,
    promptSaving,
    promptTab,
    promptVersionPersistence,
    promptVersions,
    prompts,
    promptsLoading,
    promptsPersistenceMeta,
    publishPrompt,
    resetPrompt,
    rollbackPrompt,
    savePrompt,
    setPromptEditValues,
    setPromptExpandedKey,
    setPromptNotes,
    setPromptTab,
  } = useAdminPromptControls(apiFetch);

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
    resetOverviewPanels();
    cataloghi.reset();
    agentHealth.reset();
    memory.reset();
    metriche.reset();
    abbonamenti.reset();
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
  useEffect(() => {
    setSection(sectionFromLocation(location));
    setDetail(null);
  }, [location]);

  return (
    <AdminReviewShell
      section={section}
      stats={stats}
      logs={logs}
      pendingCount={pendingCount}
      suggestionsTotal={suggestionsTotal}
      lastUpdatedAt={lastUpdatedAt}
      adminError={adminError}
      adminForbidden={adminForbidden}
      mobileSidebarOpen={mobileSidebarOpen}
      isRefreshing={isRefreshing}
      detail={detail}
      detailLoading={detailLoading}
      showTechnicalData={showTechnicalData}
      showEditNotes={showEditNotes}
      editNotes={editNotes}
      sectionSuggestions={{
        loading,
        queueSuggestions,
        filterStatus,
        filterEntity,
        filterConfidence,
        searchTerm,
        showFilters,
      }}
      agents={{
        data: agentsOverviewData,
        loading: agentsOverviewLoading,
        tab: agentsTab,
        agentDays,
        agentFilter,
        agentStatusFilter,
        newsSectorInput,
        running: agentsRunning,
        result: agentsResult,
      }}
      prompts={{
        aiModelPolicy,
        promptsPersistenceMeta,
        promptsLoading,
        prompts,
        promptExpandedKey,
        promptTab,
        promptEditValues,
        promptNotes,
        promptVersions,
        promptPreview,
        promptVersionPersistence,
        promptSaving,
      }}
      qualita={{ data: qualitaData, loading: qualitaLoading, days: qualitaDays }}
      home={{ data: homeData, loading: homeLoading }}
      metriche={{ data: metricheData, loading: metricheLoading, error: metricheError }}
      abbonamenti={{
        data: abbonamentiData,
        detail: abbonamentiDetail,
        loading: abbonamentiLoading,
        detailLoading: abbonamentiDetailLoading,
        actionLoading: abbonamentiActionLoading,
        search: abbonamentiSearch,
        planFilter: abbonamentiPlan,
        statusFilter: abbonamentiStatus,
        fields: abbonamentiFields,
        form: abbonamentiForm,
        selectUser: abbonamenti.selectUser,
      }}
      statusSetup={{
        data: statusData,
        loading: statusLoading,
        error: statusError,
        opsData,
        opsLoading,
        opsActionLoading,
        opsError,
      }}
      memory={memory}
      cataloghi={cataloghi}
      agentHealth={agentHealth}
      messaggi={messaggi}
      crescita={crescita}
      affiliazione={affiliazione}
      currentUserId={user?.id ?? null}
      actions={{
        handleLogout, navigateToSection, refreshCurrentSection, setMobileSidebarOpen,
        setAdminError, setShowFilters, setFilterStatus, setFilterEntity,
        setFilterConfidence, setSearchTerm,
        loadDetail,
        setDetail,
        setShowTechnicalData,
        setShowEditNotes,
        setEditNotes,
        handleApprove,
        handleReject,
        handleArchive,
        handleApply,
        openStatusSetup,
        loadAgentsOverview,
        setAgentsTab, setAgentDays, setAgentFilter, setAgentStatusFilter,
        setNewsSectorInput, triggerAgent,
        loadPrompts, loadPromptVersions, loadPromptPreview, setPromptExpandedKey,
        setPromptTab, setPromptEditValues, setPromptNotes, savePrompt,
        publishPrompt, resetPrompt, rollbackPrompt,
        setQualitaDays, loadQualita, loadHome, loadMetriche, loadAbbonamenti,
        saveAbbonamento, setAbbonamentiSearch, setAbbonamentiPlan,
        setAbbonamentiStatus, setAbbonamentiForm, loadStatus, loadOpsStatus,
        runOpsAction, toggleMaintenanceMode, loadMessaggi, loadCrescita,
        loadAffiliazione,
      }}
    />
  );
}
