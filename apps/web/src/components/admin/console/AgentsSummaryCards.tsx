import { cn } from "@/lib/utils";
import { Activity, BarChart3, CheckCircle2, Clock } from "lucide-react";
import type { AgentHealthStatus, AgentsOverview } from "./types";
import { agentStatusClass, agentStatusLabel, fmtDuration, fmtUsd } from "./utils";

type AgentsSummaryCardsProps = {
  data: AgentsOverview;
  healthStatus: AgentHealthStatus;
};

export function AgentsSummaryCards({ data, healthStatus }: AgentsSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      <div
        className={cn(
          "border rounded-xl p-4",
          agentStatusClass(healthStatus),
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Salute agenti</span>
          <Activity className="w-4 h-4" />
        </div>
        <p className="text-2xl font-bold mt-2">
          {agentStatusLabel(healthStatus)}
        </p>
        <p className="text-xs mt-1">
          {data.summary.criticalAgents} critici,{" "}
          {data.summary.degradedAgents} degradati
        </p>
      </div>
      <div className="border rounded-xl p-4 bg-card">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Success rate
          </span>
          <CheckCircle2 className="w-4 h-4 text-success" />
        </div>
        <p className="text-2xl font-bold mt-2">
          {data.summary.successRate30d}%
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {data.summary.totalRuns} run, {data.summary.failedRuns} fallite
        </p>
      </div>
      <div className="border rounded-xl p-4 bg-card">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Durata media
          </span>
          <Clock className="w-4 h-4 text-info" />
        </div>
        <p className="text-2xl font-bold mt-2">
          {fmtDuration(data.summary.avgDurationMs)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {data.summary.runningRuns} run in corso
        </p>
      </div>
      <div className="border rounded-xl p-4 bg-card">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Costo AI {data.costs.days}g
          </span>
          <BarChart3 className="w-4 h-4 text-info" />
        </div>
        <p className="text-2xl font-bold mt-2">
          {fmtUsd(data.summary.costUsd30d)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {data.summary.totalTokens30d.toLocaleString("it-IT")} token,{" "}
          {data.summary.aiErrors30d} errori AI
        </p>
      </div>
    </div>
  );
}
