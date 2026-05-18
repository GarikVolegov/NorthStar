import { Activity, BarChart3, Bot, CheckCircle2, Clock, History, Play, RefreshCw, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AgentLaunchResult } from "./AgentLaunchResult";
import { PersistenceWarningBanner } from "./shared";
import type { AgentsOverview, AgentsTab } from "./types";
import {
  agentStatusClass,
  agentStatusLabel,
  fmtDuration,
  fmtShortDate,
  fmtUsd,
} from "./utils";

type AgentLaunchPayload = Record<string, unknown>;
type AgentLaunchResultState = Record<string, { ok: boolean; data: Record<string, unknown> }>;

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
  onLaunch: (agentKey: string, endpoint: string, body: AgentLaunchPayload) => void;
};

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
  const tabs: Array<{ key: AgentsTab; label: string; icon: typeof Activity }> = [
    { key: "overview", label: "Overview", icon: Activity },
    { key: "history", label: "Run history", icon: History },
    { key: "errors", label: "Errori", icon: ShieldAlert },
    { key: "launch", label: "Rilancia", icon: Play },
  ];

  const healthStatus =
    data?.persistenceUnavailable
      ? "critical"
      : data && data.summary.criticalAgents > 0
        ? "critical"
        : data && (data.summary.degradedAgents > 0 || data.summary.failedRuns > 0)
          ? "degraded"
          : "healthy";

  const filteredRuns =
    data?.recentRuns.filter((run) => {
      const agentMatches = agentFilter === "all" || run.agentName === agentFilter;
      const statusMatches = agentStatusFilter === "all" || run.status === agentStatusFilter;
      return agentMatches && statusMatches;
    }) ?? [];

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Osservabilita unificata per Wendy e agenti: salute, run, errori, costi e rilanci sicuri.
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
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
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

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className={cn("border rounded-xl p-4", agentStatusClass(healthStatus))}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Salute agenti</span>
                <Activity className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold mt-2">{agentStatusLabel(healthStatus)}</p>
              <p className="text-xs mt-1">
                {data.summary.criticalAgents} critici, {data.summary.degradedAgents} degradati
              </p>
            </div>
            <div className="border rounded-xl p-4 bg-card">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-muted-foreground">Success rate</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold mt-2">{data.summary.successRate30d}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.summary.totalRuns} run, {data.summary.failedRuns} fallite
              </p>
            </div>
            <div className="border rounded-xl p-4 bg-card">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-muted-foreground">Durata media</span>
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-bold mt-2">{fmtDuration(data.summary.avgDurationMs)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.summary.runningRuns} run in corso
              </p>
            </div>
            <div className="border rounded-xl p-4 bg-card">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-muted-foreground">Costo AI {data.costs.days}g</span>
                <BarChart3 className="w-4 h-4 text-violet-600" />
              </div>
              <p className="text-2xl font-bold mt-2">{fmtUsd(data.summary.costUsd30d)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.summary.totalTokens30d.toLocaleString("it-IT")} token, {data.summary.aiErrors30d} errori AI
              </p>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {tabs.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.key}
                  variant={tab === item.key ? "default" : "outline"}
                  onClick={() => onTabChange(item.key)}
                  className="min-h-11 shrink-0"
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.label}
                </Button>
              );
            })}
          </div>

          {tab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
              {data.agents.length === 0 ? (
                <div className="lg:col-span-2 p-10 text-center text-muted-foreground border rounded-xl bg-muted/20">
                  Nessun agente ha run nel periodo selezionato.
                </div>
              ) : (
                data.agents.map((agent) => (
                  <div key={agent.agentName} className="border rounded-xl p-4 bg-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="font-semibold truncate">{agent.agentName}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Ultima run: {agent.lastRunAt ? fmtShortDate(agent.lastRunAt) : "N/D"}
                        </p>
                      </div>
                      <Badge variant="outline" className={cn("border", agentStatusClass(agent.status))}>
                        {agentStatusLabel(agent.status)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Run</p>
                        <p className="font-semibold">{agent.totalCalls30d}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Success rate</p>
                        <p className="font-semibold">{agent.successRate30d}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Errori</p>
                        <p className={cn("font-semibold", agent.errorCount30d > 0 && "text-red-600")}>
                          {agent.errorCount30d}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Durata media</p>
                        <p className="font-semibold">{fmtDuration(agent.avgDurationMs)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
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
                  onChange={(event) => onAgentStatusFilterChange(event.target.value)}
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
                            <p className="font-medium truncate">{run.agentName}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {fmtShortDate(run.startedAt)} - {run.taskType ?? "task"} - {fmtDuration(run.durationMs)}
                            </p>
                          </div>
                          <Badge
                            variant={run.status === "completed" ? "secondary" : run.status === "running" ? "outline" : "destructive"}
                            className="text-xs capitalize"
                          >
                            {run.status}
                          </Badge>
                        </div>
                        {(run.outputSummary || run.errorMessage || run.inputSummary) && (
                          <p className={cn("text-xs mt-2 truncate", run.errorMessage ? "text-red-600" : "text-muted-foreground")}>
                            {run.errorMessage || run.outputSummary || run.inputSummary}
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
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                  <p className="font-medium">Nessun errore agente recente</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Nel periodo selezionato non risultano run fallite o cancellate.
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {data.recentErrors.map((error) => (
                    <div key={error.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{error.agentName}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {error.taskType ?? "task"} - {fmtShortDate(error.startedAt)} - {fmtDuration(error.durationMs)}
                          </p>
                        </div>
                        <Badge variant="destructive" className="text-xs capitalize">
                          {error.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-red-600 mt-2 break-words">
                        {error.errorMessage || "Errore senza messaggio"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "launch" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {data.runnableAgents.map((agent) => {
                const running = agentsRunning.has(agent.key);
                const result = agentsResult[agent.key];
                return (
                  <div key={agent.key} className="border rounded-xl p-4 bg-card space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold">{agent.label}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{agent.description}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "capitalize",
                          agent.risk === "low" && "bg-emerald-50 text-emerald-700",
                          agent.risk === "medium" && "bg-amber-50 text-amber-700",
                          agent.risk === "high" && "bg-red-50 text-red-700",
                        )}
                      >
                        {agent.risk}
                      </Badge>
                    </div>
                    {agent.key === "news-research" && (
                      <Input
                        placeholder="Aree specifiche opzionali, separate da virgola"
                        value={newsSectorInput}
                        onChange={(event) => onNewsSectorInputChange(event.target.value)}
                        className="min-h-11"
                      />
                    )}
                    <Button
                      className="w-full min-h-11"
                      disabled={running}
                      onClick={() => {
                        const body =
                          agent.key === "news-research"
                            ? {
                                sectorNames: newsSectorInput
                                  .split(",")
                                  .map((value) => value.trim())
                                  .filter(Boolean),
                              }
                            : {};
                        onLaunch(agent.key, agent.endpoint, body);
                      }}
                    >
                      {running ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          In esecuzione...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Rilancia agente
                        </>
                      )}
                    </Button>
                    {result && <AgentLaunchResult agentKey={agent.key} result={result} />}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
