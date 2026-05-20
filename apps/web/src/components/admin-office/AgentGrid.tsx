import type { AgentSnapshot } from "@workspace/api-zod/agent-registry";
import { STATUS_DOT_CLASS, STATUS_LABEL } from "./status";

interface AgentGridProps {
  agents: AgentSnapshot[];
  onSelect: (slug: string) => void;
}

export function AgentGrid({ agents, onSelect }: AgentGridProps) {
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {agents.map((agent) => (
        <AgentCompactCard key={agent.slug} agent={agent} onSelect={() => onSelect(agent.slug)} />
      ))}
    </div>
  );
}

function AgentCompactCard({
  agent,
  onSelect,
}: {
  agent: AgentSnapshot;
  onSelect: () => void;
}) {
  const offline = agent.status === "offline";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col items-center gap-2 rounded-lg border border-border bg-card/50 p-3 text-left transition-all duration-300 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${offline ? "opacity-40 grayscale" : ""}`}
      data-testid={`grid-card-${agent.slug}`}
      aria-label={`${agent.name} — ${STATUS_LABEL[agent.status]}`}
    >
      <div className="relative">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-full border-2 border-border bg-background text-3xl ${agent.color}`}
        >
          <span aria-hidden>{agent.avatar}</span>
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-card transition-colors duration-500 ${STATUS_DOT_CLASS[agent.status]}`}
          aria-hidden
        />
      </div>
      <div className="w-full text-center">
        <div className="truncate text-sm font-medium text-foreground">{agent.name}</div>
        <div className="truncate text-[11px] text-muted-foreground">{agent.role}</div>
      </div>
      {agent.currentTask?.title && (
        <div className="w-full truncate rounded-md bg-muted/40 px-2 py-1 text-center text-[11px] text-muted-foreground">
          {agent.currentTask.title}
        </div>
      )}
    </button>
  );
}
