import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Bot,
  CheckCircle2,
  Play,
  RefreshCw,
} from "lucide-react";
import { AgentsLaunchTab } from "./AgentsLaunchTab";
import { AgentsSummaryCards } from "./AgentsSummaryCards";
import { AgentsTabButtons } from "./AgentsTabButtons";
import { PersistenceWarningBanner } from "./shared";
import type { AgentsOverview, AgentsTab } from "./types";
import {
  agentStatusClass,
  agentStatusLabel,
  fmtDuration,
  fmtShortDate,
} from "./utils";

type AgentLaunchPayload = Record<string, unknown>;
type AgentLaunchResultState = Record<
  string,
  { ok: boolean; data: Record<string, unknown> }
>;

type AgentsSectionProps = {
  data: AgentsOverview | null;
  loading: boolean;
  tab: AgentsTab;
  onTabChange: (tab: AgentsTab) => void;
  agentDays: string;
  onAgentDaysChange: (days: string) => void;
  agentFilter: string;
  onAgentFilterChange: (agent: string) => void;
  agentStatusFilter: string;
  onAgentStatusFilterChange: (status: string) => void;
  newsSectorInput: string;
  onNewsSectorInputChange: (value: string) => void;
  agentsRunning: Set<string>;
  agentsResult: AgentLaunchResultState;
  onRefresh: () => void;
  onOpenStatus: () => void;
  onLaunch: (
    agentKey: string,
    endpoint: string,
    body: AgentLaunchPayload,
  ) => void;
};

function newsProviderStatusClass(status: string) {
  if (status === "ready") return "bg-success-surface text-success";
  if (status === "degraded" || status === "stale") {
    return "bg-warning-surface text-warning";
  }
  if (status === "not_configured" || status === "unavailable") {
    return "bg-danger-surface text-danger";
  }
  return "bg-muted text-muted-foreground";
}

function newsProviderActionLabel(action: string) {
  if (action === "wait_for_next_refresh") return "Attendi prossimo refresh";
  if (action === "wait_for_startup_pipeline") return "Avvia pipeline news";
  if (action === "check_provider_keys") return "Controlla chiavi provider";
  if (action === "configure_sources") return "Configura fonti news";
  if (action === "retry_later") return "Riprova piu tardi";
  return action;
}

export function AgentsSection({
  data,
  loading,
  tab,
  onTabChange,
  agentDays,
  onAgentDaysChange,
  agentFilter,
  onAgentFilterChange,
  agentStatusFilter,
  onAgentStatusFilterChange,
  newsSectorInput,
  onNewsSectorInputChange,
  agentsRunning,
  agentsResult,
  onRefresh,
  onOpenStatus,
  onLaunch,
}: AgentsSectionProps) {
  const healthStatus = data?.persistenceUnavailable
    ? "critical"
    : data && data.summary.criticalAgents > 0
      ? "critical"
      : data && (data.summary.degradedAgents > 0 || data.summary.failedRuns > 0)
        ? "degraded"
        : "healthy";

  const filteredRuns =
    data?.recentRuns.filter((run) => {
      const agentMatches =
        agentFilter === "all" || run.agentName === agentFilter;
      const statusMatches =
        agentStatusFilter === "all" || run.status === agentStatusFilter;
      return agentMatches && statusMatches;
    }) ?? [];
  const pipelines = data?.runnablePipelines ?? [];
  const advancedAgents = data?.advancedRunnableAgents ?? data?.runnableAgents ?? [];
  const hasNewsLaunch =
    pipelines.some((pipeline) => pipeline.key === "news-publishing") ||
    advancedAgents.some((agent) => agent.key === "news-research");
  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Osservabilita unificata per Wendy e agenti: salute, run, errori,
            costi e rilanci sicuri.
          </p>
          {data?.generatedAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Snapshot: {fmtShortDate(data.generatedAt)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={agentDays}
            onChange={(event) => onAgentDaysChange(event.target.value)}
            className="min-h-11 text-sm border rounded-lg px-3 bg-background"
            aria-label="Periodo agenti"
          >
            <option value="7">Ultimi 7 giorni</option>
            <option value="30">Ultimi 30 giorni</option>
          </select>
          <Button
            variant="outline"
            onClick={onRefresh}
            disabled={loading}
            className="min-h-11"
          >
            <RefreshCw
              className={cn("w-4 h-4 mr-2", loading && "animate-spin")}
            />
            Riprova
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <div className="p-12 text-center text-muted-foreground">
          Caricamento osservabilita agenti...
        </div>
      ) : !data ? (
        <div className="p-12 text-center border rounded-xl bg-muted/20">
          <Bot className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Nessun dato agente disponibile</p>
          <p className="text-sm text-muted-foreground mt-1">
            Avvia un agente o riprova quando il server ha scritto nuove run.
          </p>
        </div>
      ) : (
        <>
          <PersistenceWarningBanner
            meta={data}
            title="Osservabilita agenti non affidabile"
            onRetry={onRefresh}
            onOpenStatus={onOpenStatus}
          />

          <AgentsSummaryCards data={data} healthStatus={healthStatus} />

          <AgentsTabButtons tab={tab} onTabChange={onTabChange} />

          {tab === "overview" && (
            <div className="space-y-3">
              {data.controlRoom && (
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-3">
                  <div className="border rounded-xl p-4 bg-card">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-semibold">Risultati pronti</h4>
                      <Badge variant="secondary">live</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">News reali</p>
                        <p className="font-semibold">{data.controlRoom.readyOutputs.realNews.count}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Discovery da arricchire</p>
                        <p className="font-semibold">{data.controlRoom.readyOutputs.pendingDiscovery.count}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Articoli crescita</p>
                        <p className="font-semibold">{data.controlRoom.readyOutputs.growthArticles.count}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Job snapshots</p>
                        <p className="font-semibold">{data.controlRoom.readyOutputs.jobSnapshots.count}</p>
                      </div>
                    </div>
                  </div>
                  <div className="border rounded-xl p-4 bg-card">
                    <h4 className="font-semibold">AI e provider</h4>
                    <p className="text-sm text-muted-foreground mt-2">
                      Provider: {data.controlRoom.ai.activeProvider} - modello: {data.controlRoom.ai.model}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Badge variant={data.controlRoom.ai.openRouterConfigured ? "secondary" : "outline"}>
                        OpenRouter {data.controlRoom.ai.openRouterConfigured ? "ok" : "missing"}
                      </Badge>
                      <Badge variant={data.controlRoom.ai.openAiFallbackConfigured ? "secondary" : "destructive"}>
                        OpenAI fallback {data.controlRoom.ai.openAiFallbackConfigured ? "ok" : "missing"}
                      </Badge>
                    </div>
                  </div>
                  <div className="border rounded-xl p-4 bg-card">
                    <h4 className="font-semibold">Blocchi configurazione</h4>
                    {data.controlRoom.configBlockers.length === 0 ? (
                      <p className="text-sm text-muted-foreground mt-2">Nessun blocco noto.</p>
                    ) : (
                      <div className="space-y-2 mt-3">
                        {data.controlRoom.configBlockers.slice(0, 4).map((blocker) => (
                          <div key={blocker.key} className="flex items-start justify-between gap-2 text-sm">
                            <span className="min-w-0">
                              <span className="font-medium">{blocker.key}</span>
                              <span className="block text-xs text-muted-foreground truncate">{blocker.message}</span>
                            </span>
                            <Badge variant={blocker.severity === "critical" ? "destructive" : "outline"}>
                              missing
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="border rounded-xl p-4 bg-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="font-semibold">Provider news</h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Stato fetch e fonti pubbliche
                        </p>
                      </div>
                      {data.controlRoom.newsDiagnostics ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 text-xs",
                            newsProviderStatusClass(
                              data.controlRoom.newsDiagnostics.providerStatus,
                            ),
                          )}
                        >
                          {data.controlRoom.newsDiagnostics.providerStatus}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0 text-xs">
                          n/d
                        </Badge>
                      )}
                    </div>

                    {data.controlRoom.newsDiagnostics ? (
                      <>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">
                              Fonti abilitate
                            </p>
                            <p className="font-semibold">
                              {data.controlRoom.newsDiagnostics.enabledSources}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">
                              Fonti in errore
                            </p>
                            <p
                              className={cn(
                                "font-semibold",
                                data.controlRoom.newsDiagnostics
                                  .sourcesWithErrors > 0 && "text-danger",
                              )}
                            >
                              {
                                data.controlRoom.newsDiagnostics
                                  .sourcesWithErrors
                              }
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">
                              Ultimo fetch
                            </p>
                            <p className="truncate font-semibold">
                              {data.controlRoom.newsDiagnostics.lastAttemptAt
                                ? fmtShortDate(
                                    data.controlRoom.newsDiagnostics
                                      .lastAttemptAt,
                                  )
                                : "Mai"}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">
                              Totale fetched
                            </p>
                            <p className="font-semibold">
                              {data.controlRoom.newsDiagnostics.totalFetched ??
                                "N/D"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 space-y-2 text-xs">
                          <p className="break-words text-muted-foreground">
                            {data.controlRoom.newsDiagnostics.message}
                          </p>
                          {(data.controlRoom.newsDiagnostics.lastRefreshError ||
                            data.controlRoom.newsDiagnostics.lastError) && (
                            <p className="break-words text-danger">
                              {data.controlRoom.newsDiagnostics
                                .lastRefreshError ||
                                data.controlRoom.newsDiagnostics.lastError}
                            </p>
                          )}
                          <Badge variant="outline" className="max-w-full text-xs">
                            <span className="min-w-0 truncate">
                              {newsProviderActionLabel(
                                data.controlRoom.newsDiagnostics.refreshAction,
                              )}
                            </span>
                          </Badge>
                        </div>
                      </>
                    ) : (
                      <p className="mt-4 text-sm text-muted-foreground">
                        Diagnostica provider news non disponibile in questo
                        snapshot.
                      </p>
                    )}

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onRefresh}
                        disabled={loading}
                        className="min-h-10"
                      >
                        <RefreshCw
                          className={cn(
                            "h-4 w-4 mr-2",
                            loading && "animate-spin",
                          )}
                        />
                        Aggiorna
                      </Button>
                      {hasNewsLaunch && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onTabChange("launch")}
                          className="min-h-10"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Pipeline
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
                {data.agents.length === 0 ? (
                  <div className="lg:col-span-2 p-10 text-center text-muted-foreground border rounded-xl bg-muted/20">
                    Nessun agente ha run nel periodo selezionato.
                  </div>
                ) : (
                  data.agents.map((agent) => (
                    <div
                      key={agent.agentName}
                      className="border rounded-xl p-4 bg-card"
                    >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="font-semibold truncate">
                          {agent.agentName}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Ultima run:{" "}
                          {agent.lastRunAt
                            ? fmtShortDate(agent.lastRunAt)
                            : "N/D"}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn("border", agentStatusClass(agent.status))}
                      >
                        {agentStatusLabel(agent.status)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Run</p>
                        <p className="font-semibold">{agent.totalCalls30d}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Success rate
                        </p>
                        <p className="font-semibold">{agent.successRate30d}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Errori</p>
                        <p
                          className={cn(
                            "font-semibold",
                            agent.errorCount30d > 0 && "text-danger",
                          )}
                        >
                          {agent.errorCount30d}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Durata media
                        </p>
                        <p className="font-semibold">
                          {fmtDuration(agent.avgDurationMs)}
                        </p>
                      </div>
                    </div>
                  </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === "history" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <select
                  value={agentFilter}
                  onChange={(event) => onAgentFilterChange(event.target.value)}
                  className="min-h-11 text-sm border rounded-lg px-3 bg-background"
                  aria-label="Filtra agente"
                >
                  <option value="all">Tutti gli agenti</option>
                  {data.agents.map((agent) => (
                    <option key={agent.agentName} value={agent.agentName}>
                      {agent.agentName}
                    </option>
                  ))}
                </select>
                <select
                  value={agentStatusFilter}
                  onChange={(event) =>
                    onAgentStatusFilterChange(event.target.value)
                  }
                  className="min-h-11 text-sm border rounded-lg px-3 bg-background"
                  aria-label="Filtra stato run"
                >
                  <option value="all">Tutti gli stati</option>
                  <option value="completed">Completate</option>
                  <option value="running">In corso</option>
                  <option value="failed">Fallite</option>
                  <option value="cancelled">Cancellate</option>
                </select>
              </div>
              <div className="border rounded-xl overflow-hidden">
                {filteredRuns.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground">
                    Nessuna run corrisponde ai filtri.
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredRuns.map((run) => (
                      <div key={run.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {run.agentName}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {fmtShortDate(run.startedAt)} -{" "}
                              {run.taskType ?? "task"} -{" "}
                              {fmtDuration(run.durationMs)}
                            </p>
                          </div>
                          <Badge
                            variant={
                              run.status === "completed"
                                ? "secondary"
                                : run.status === "running"
                                  ? "outline"
                                  : "destructive"
                            }
                            className="text-xs capitalize"
                          >
                            {run.status}
                          </Badge>
                        </div>
                        {(run.outputSummary ||
                          run.errorMessage ||
                          run.inputSummary) && (
                          <p
                            className={cn(
                              "text-xs mt-2 truncate",
                              run.errorMessage
                                ? "text-danger"
                                : "text-muted-foreground",
                            )}
                          >
                            {run.errorMessage ||
                              run.outputSummary ||
                              run.inputSummary}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "errors" && (
            <div className="border rounded-xl overflow-hidden">
              {data.recentErrors.length === 0 ? (
                <div className="p-10 text-center">
                  <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-3" />
                  <p className="font-medium">Nessun errore agente recente</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Nel periodo selezionato non risultano run fallite o
                    cancellate.
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {data.recentErrors.map((error) => (
                    <div key={error.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {error.agentName}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {error.taskType ?? "task"} -{" "}
                            {fmtShortDate(error.startedAt)} -{" "}
                            {fmtDuration(error.durationMs)}
                          </p>
                        </div>
                        <Badge
                          variant="destructive"
                          className="text-xs capitalize"
                        >
                          {error.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-danger mt-2 break-words">
                        {error.errorMessage || "Errore senza messaggio"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "launch" && (
            <AgentsLaunchTab
              pipelines={pipelines}
              advancedAgents={advancedAgents}
              agentsRunning={agentsRunning}
              agentsResult={agentsResult}
              newsSectorInput={newsSectorInput}
              onNewsSectorInputChange={onNewsSectorInputChange}
              onLaunch={onLaunch}
            />
          )}

        </>
      )}
    </div>
  );
}
