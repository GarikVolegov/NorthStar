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
} from "@/components/admin/console";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminLogsSection } from "@/features/admin-review/components/AdminLogsSection";
import { AdminSettingsSection } from "@/features/admin-review/components/AdminSettingsSection";
import { AgentHealthSection } from "@/features/admin-review/components/AgentHealthSection";
import { CatalogsSection } from "@/features/admin-review/components/CatalogsSection";
import { GrowthQueueSection } from "@/features/admin-review/components/GrowthQueueSection";
import { MemoryGraphSection } from "@/features/admin-review/components/MemoryGraphSection";
import { SuggestionDetailPanel } from "@/features/admin-review/components/SuggestionDetailPanel";
import { cn } from "@/lib/utils";
import { Bot, CheckCircle2, ChevronDown, ChevronRight, Filter, Search } from "lucide-react";
import type { AdminReviewShellProps } from "./AdminReviewShell";

export function AdminReviewContent({
  section,
  stats,
  logs,
  suggestionsTotal,
  detail,
  detailLoading,
  showTechnicalData,
  showEditNotes,
  editNotes,
  sectionSuggestions,
  agents,
  prompts,
  qualita,
  home,
  metriche,
  abbonamenti,
  statusSetup,
  memory,
  cataloghi,
  agentHealth,
  messaggi,
  crescita,
  affiliazione,
  currentUserId,
  actions,
}: AdminReviewShellProps) {
  const {
    loading,
    queueSuggestions,
    filterStatus,
    filterEntity,
    filterConfidence,
    searchTerm,
    showFilters,
  } = sectionSuggestions;
  const {
    navigateToSection,
    setShowFilters,
    setFilterStatus,
    setFilterEntity,
    setFilterConfidence,
    setSearchTerm,
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
    setAgentsTab,
    setAgentDays,
    setAgentFilter,
    setAgentStatusFilter,
    setNewsSectorInput,
    triggerAgent,
    loadPrompts,
    loadPromptVersions,
    loadPromptPreview,
    setPromptExpandedKey,
    setPromptTab,
    setPromptEditValues,
    setPromptNotes,
    savePrompt,
    publishPrompt,
    resetPrompt,
    rollbackPrompt,
    setQualitaDays,
    loadQualita,
    loadHome,
    loadMetriche,
    loadAbbonamenti,
    saveAbbonamento,
    setAbbonamentiSearch,
    setAbbonamentiPlan,
    setAbbonamentiStatus,
    setAbbonamentiForm,
    loadStatus,
    loadOpsStatus,
    runOpsAction,
    toggleMaintenanceMode,
    loadMessaggi,
    loadAffiliazione,
  } = actions;
  const {
    data: agentsOverviewData,
    loading: agentsOverviewLoading,
    tab: agentsTab,
    agentDays,
    agentFilter,
    agentStatusFilter,
    newsSectorInput,
    running: agentsRunning,
    result: agentsResult,
  } = agents;
  const {
    aiModelPolicy,
    promptsPersistenceMeta,
    promptsLoading,
    prompts: promptItems,
    promptExpandedKey,
    promptTab,
    promptEditValues,
    promptNotes,
    promptVersions,
    promptPreview,
    promptVersionPersistence,
    promptSaving,
  } = prompts;
  const { data: qualitaData, loading: qualitaLoading, days: qualitaDays } = qualita;
  const { data: homeData, loading: homeLoading } = home;
  const { data: metricheData, loading: metricheLoading, error: metricheError } = metriche;
  const {
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
  } = abbonamenti;
  const {
    data: statusData,
    loading: statusLoading,
    error: statusError,
    opsData,
    opsLoading,
    opsActionLoading,
    opsError,
  } = statusSetup;

  return (          <div className="flex-1 flex overflow-hidden">
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
                  prompts={promptItems}
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
                  currentUserId={currentUserId}
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
                  currentUserId={currentUserId}
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
  );
}

