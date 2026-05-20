import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Bot, RefreshCw } from "lucide-react";
import type { useAgentHealth } from "../hooks/useAgentHealth";

type AgentHealthSectionProps = {
  agentHealth: ReturnType<typeof useAgentHealth>;
};

export function AgentHealthSection({ agentHealth }: AgentHealthSectionProps) {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-serif font-bold">
          <Activity className="w-5 h-5 inline mr-2 text-primary" />
          Salute Agenti
        </h3>
        <Button size="sm" variant="outline" onClick={agentHealth.load} disabled={agentHealth.loading}>
          {agentHealth.loading ? <RefreshCw size={13} className="animate-spin mr-1" /> : <RefreshCw size={13} className="mr-1" />}
          Aggiorna
        </Button>
      </div>
      {agentHealth.loading ? (
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      ) : agentHealth.data?.agents ? (
        <div className="space-y-3">
          {agentHealth.data.agents.map((agent) => (
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
  );
}
