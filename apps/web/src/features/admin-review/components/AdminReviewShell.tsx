import type {
  AdminOverview,
  AgentPrompt,
  AgentsOverview,
  AgentsTab,
  AiModelPolicy,
  PersistenceMeta,
  PromptEditorTab,
  PromptPreview,
  PromptVersion,
  SidebarSection,
  WendyQualityOverview,
} from "@/components/admin/console";
import { Button } from "@/components/ui/button";
import type {
  AuditLogEntry,
  DashboardStats,
  Suggestion,
  SuggestionDetail,
} from "@/features/admin-review/adminReviewTypes";
import { AdminReviewContent } from "@/features/admin-review/components/AdminReviewContent";
import { AdminReviewSidebar } from "@/features/admin-review/components/AdminReviewSidebar";
import type { useAdminAffiliations } from "@/features/admin-review/hooks/useAdminAffiliations";
import type { useAdminCatalogs } from "@/features/admin-review/hooks/useAdminCatalogs";
import type { useAdminMessages } from "@/features/admin-review/hooks/useAdminMessages";
import type { useAdminStatus } from "@/features/admin-review/hooks/useAdminStatus";
import type { useAdminSubscriptions } from "@/features/admin-review/hooks/useAdminSubscriptions";
import type { useAgentHealth } from "@/features/admin-review/hooks/useAgentHealth";
import type { useBusinessMetrics } from "@/features/admin-review/hooks/useBusinessMetrics";
import type { useGrowthQueue } from "@/features/admin-review/hooks/useGrowthQueue";
import type { useMemoryGraph } from "@/features/admin-review/hooks/useMemoryGraph";
import { cn } from "@/lib/utils";
import { formatLastUpdated } from "@/components/admin/console";
import { Menu, RefreshCw, ShieldAlert, XCircle } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { TITLE_BY_SECTION } from "../adminReviewConfig";

type SectionSuggestionsView = {
  loading: boolean;
  queueSuggestions: Suggestion[];
  filterStatus: string;
  filterEntity: string;
  filterConfidence: string;
  searchTerm: string;
  showFilters: boolean;
};

type AgentsView = {
  data: AgentsOverview | null;
  loading: boolean;
  tab: AgentsTab;
  agentDays: string;
  agentFilter: string;
  agentStatusFilter: string;
  newsSectorInput: string;
  running: Set<string>;
  result: Record<string, { ok: boolean; data: Record<string, unknown> }>;
};

type PromptsView = {
  aiModelPolicy: AiModelPolicy | null;
  promptsPersistenceMeta: PersistenceMeta;
  promptsLoading: boolean;
  prompts: AgentPrompt[];
  promptExpandedKey: string | null;
  promptTab: PromptEditorTab;
  promptEditValues: Record<string, string>;
  promptNotes: Record<string, string>;
  promptVersions: Record<string, PromptVersion[]>;
  promptPreview: Record<string, PromptPreview>;
  promptVersionPersistence: Record<string, PersistenceMeta>;
  promptSaving: Set<string>;
};

export type AdminReviewShellProps = {
  section: SidebarSection;
  stats: DashboardStats | null;
  logs: AuditLogEntry[];
  pendingCount: number;
  suggestionsTotal: number;
  lastUpdatedAt: string | null;
  adminError: string | null;
  adminForbidden: boolean;
  mobileSidebarOpen: boolean;
  isRefreshing: boolean;
  detail: SuggestionDetail | null;
  detailLoading: boolean;
  showTechnicalData: boolean;
  showEditNotes: boolean;
  editNotes: string;
  sectionSuggestions: SectionSuggestionsView;
  agents: AgentsView;
  prompts: PromptsView;
  qualita: { data: WendyQualityOverview | null; loading: boolean; days: string };
  home: { data: AdminOverview | null; loading: boolean };
  metriche: Pick<ReturnType<typeof useBusinessMetrics>, "data" | "loading" | "error">;
  abbonamenti: Pick<ReturnType<typeof useAdminSubscriptions>, "data" | "detail" | "loading" | "detailLoading" | "actionLoading" | "search" | "planFilter" | "statusFilter" | "fields" | "form" | "selectUser">;
  statusSetup: Pick<ReturnType<typeof useAdminStatus>, "data" | "loading" | "error" | "opsData" | "opsLoading" | "opsActionLoading" | "opsError">;
  memory: ReturnType<typeof useMemoryGraph>;
  cataloghi: ReturnType<typeof useAdminCatalogs>;
  agentHealth: ReturnType<typeof useAgentHealth>;
  messaggi: ReturnType<typeof useAdminMessages>;
  crescita: ReturnType<typeof useGrowthQueue>;
  affiliazione: ReturnType<typeof useAdminAffiliations>;
  currentUserId: number | null;
  actions: {
    handleLogout: () => void;
    navigateToSection: (section: SidebarSection) => void;
    refreshCurrentSection: () => void;
    setMobileSidebarOpen: Dispatch<SetStateAction<boolean>>;
    setAdminError: Dispatch<SetStateAction<string | null>>;
    setShowFilters: Dispatch<SetStateAction<boolean>>;
    setFilterStatus: Dispatch<SetStateAction<string>>;
    setFilterEntity: Dispatch<SetStateAction<string>>;
    setFilterConfidence: Dispatch<SetStateAction<string>>;
    setSearchTerm: Dispatch<SetStateAction<string>>;
    loadDetail: (id: number) => Promise<void>;
    setDetail: Dispatch<SetStateAction<SuggestionDetail | null>>;
    setShowTechnicalData: Dispatch<SetStateAction<boolean>>;
    setShowEditNotes: Dispatch<SetStateAction<boolean>>;
    setEditNotes: Dispatch<SetStateAction<string>>;
    handleApprove: (id: number) => Promise<void>;
    handleReject: (id: number) => Promise<void>;
    handleArchive: (id: number) => Promise<void>;
    handleApply: (id: number) => Promise<void>;
    openStatusSetup: () => void;
    loadAgentsOverview: () => Promise<void>;
    setAgentsTab: Dispatch<SetStateAction<AgentsTab>>;
    setAgentDays: Dispatch<SetStateAction<string>>;
    setAgentFilter: Dispatch<SetStateAction<string>>;
    setAgentStatusFilter: Dispatch<SetStateAction<string>>;
    setNewsSectorInput: Dispatch<SetStateAction<string>>;
    triggerAgent: (agentKey: string, path: string, body?: Record<string, unknown>) => Promise<void>;
    loadPrompts: () => Promise<void>;
    loadPromptVersions: (key: string) => Promise<void>;
    loadPromptPreview: (key: string) => Promise<void>;
    setPromptExpandedKey: Dispatch<SetStateAction<string | null>>;
    setPromptTab: Dispatch<SetStateAction<PromptEditorTab>>;
    setPromptEditValues: Dispatch<SetStateAction<Record<string, string>>>;
    setPromptNotes: Dispatch<SetStateAction<Record<string, string>>>;
    savePrompt: (key: string) => Promise<void>;
    publishPrompt: (key: string) => Promise<void>;
    resetPrompt: (key: string) => Promise<void>;
    rollbackPrompt: (key: string, versionId: number) => Promise<void>;
    setQualitaDays: Dispatch<SetStateAction<string>>;
    loadQualita: () => Promise<void>;
    loadHome: () => Promise<void>;
    loadMetriche: () => Promise<void>;
    loadAbbonamenti: () => Promise<void>;
    saveAbbonamento: ReturnType<typeof useAdminSubscriptions>["save"];
    setAbbonamentiSearch: Dispatch<SetStateAction<string>>;
    setAbbonamentiPlan: Dispatch<SetStateAction<string>>;
    setAbbonamentiStatus: Dispatch<SetStateAction<string>>;
    setAbbonamentiForm: ReturnType<typeof useAdminSubscriptions>["setForm"];
    loadStatus: () => Promise<void>;
    loadOpsStatus: () => Promise<void>;
    runOpsAction: ReturnType<typeof useAdminStatus>["runOpsAction"];
    toggleMaintenanceMode: ReturnType<typeof useAdminStatus>["toggleMaintenanceMode"];
    loadMessaggi: () => Promise<void>;
    loadCrescita: () => Promise<void>;
    loadAffiliazione: () => Promise<void>;
  };
};

export function AdminReviewShell(props: AdminReviewShellProps) {
  const {
    section,
    stats,
    pendingCount,
    suggestionsTotal,
    lastUpdatedAt,
    adminError,
    adminForbidden,
    mobileSidebarOpen,
    isRefreshing,
    actions,
  } = props;
  const {
    handleLogout,
    navigateToSection,
    refreshCurrentSection,
    setMobileSidebarOpen,
    setAdminError,
  } = actions;

  const sidebarContent = (
    <AdminReviewSidebar
      stats={stats}
      section={section}
      onNavigateSection={navigateToSection}
      onLogout={handleLogout}
    />
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
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
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
          <Button
            variant="outline"
            size="sm"
            className="min-h-11"
            onClick={refreshCurrentSection}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={cn("w-4 h-4 sm:mr-2", isRefreshing && "animate-spin")}
            />
            <span className="hidden sm:inline">Aggiorna</span>
          </Button>
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

        <AdminReviewContent {...props} />
      </main>
    </div>
  );
}
