/**
 * AdminAgentHealth — mostra lo stato di tutti gli agenti del sistema.
 *
 * Agenti monitorati:
 *   - Collector Agent
 *   - Enricher Agent
 *   - Personalizer Agent
 *   - Feed API
 *   - Growth Chat Agent
 *
 * Per ogni agente:
 *   - Badge colored (ok/warning/error/unknown)
 *   - Ultimo run
 *   - Messaggio di stato
 *   - Item count (se disponibile)
 */
import React from "react";
import type { AgentStatus } from "./useAdminData";

interface Props {
  agents:    AgentStatus[];
  isLoading: boolean;
  onRefresh: () => void;
}

const STATUS_CONFIG = {
  ok:      { label: "OK",         color: "bg-green-100 text-green-700",  dot: "bg-green-400" },
  warning: { label: "WARNING",    color: "bg-amber-100 text-amber-700",  dot: "bg-amber-400" },
  error:   { label: "ERRORE",     color: "bg-red-100 text-red-700",      dot: "bg-red-400" },
  unknown: { label: "SCONOSCIUTO",color: "bg-gray-100 text-gray-600",    dot: "bg-gray-300" },
};

const AGENT_ICONS: Record<string, string> = {
  collector:    "📰",
  enricher:     "✨",
  personalizer: "🎯",
  feed:         "📡",
  growth_chat:  "🤖",
  default:      "⚙️",
};

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "mai";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(dateStr));
}

export const AdminAgentHealth: React.FC<Props> = ({ agents, isLoading, onRefresh }) => {
  const FALLBACK_AGENTS: AgentStatus[] = [
    { name: "collector",    status: "unknown" },
    { name: "enricher",     status: "unknown" },
    { name: "personalizer", status: "unknown" },
    { name: "feed",         status: "unknown" },
    { name: "growth_chat",  status: "unknown" },
  ];

  const displayAgents = agents.length > 0 ? agents : FALLBACK_AGENTS;

  return (
    <div className="rounded-2xl border bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-900">📊 Agent Health</h2>
          <p className="text-xs text-gray-400">Stato degli agenti del sistema</p>
        </div>
        <button
          onClick={onRefresh}
          className="text-xs text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition"
        >↻ Aggiorna</button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {displayAgents.map((agent) => {
            const cfg  = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.unknown;
            const icon = AGENT_ICONS[agent.name] ?? AGENT_ICONS.default;
            return (
              <div key={agent.name} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition">
                <span className="text-lg">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 capitalize">{agent.name.replace("_", " ")}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    {agent.itemsCount != null && (
                      <span className="text-[10px] text-gray-400">{agent.itemsCount} item</span>
                    )}
                  </div>
                  {agent.message && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{agent.message}</p>
                  )}
                  <p className="text-[10px] text-gray-300">Ultimo run: {formatDate(agent.lastRunAt)}</p>
                </div>
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
