import type { AgentSnapshot } from "@workspace/api-zod/agent-registry";
import type { DeskPosition } from "./positions";
import { STATUS_DOT_CLASS, STATUS_LABEL } from "./status";

const TICKER_THRESHOLD = 22;

interface AgentDeskProps {
  agent: AgentSnapshot;
  position: DeskPosition;
  onSelect?: () => void;
}

export function AgentDesk({ agent, position, onSelect }: AgentDeskProps) {
  const offline = agent.status === "offline";
  const interactive = Boolean(onSelect);
  return (
    <div
      className={`absolute z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 transition-all duration-500 ${offline ? "opacity-40 grayscale" : ""} ${interactive ? "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary hover:scale-105" : ""}`}
      style={{ left: `${position.xPct}%`, top: `${position.yPct}%` }}
      data-testid={`desk-${agent.slug}`}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={`${agent.name} — ${STATUS_LABEL[agent.status]}${interactive ? ", clicca per dettagli" : ""}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (!onSelect) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <CurrentTaskBubble agent={agent} />
      <div className="relative">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full border-2 border-border bg-background text-2xl shadow ${agent.color}`}
        >
          <span aria-hidden>{agent.avatar}</span>
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-background transition-colors duration-500 ${STATUS_DOT_CLASS[agent.status]}`}
          aria-hidden
        />
      </div>
      <div className="h-2 w-6 rounded-full bg-border/80" aria-hidden />
      <div className="h-3 w-24 rounded-md bg-muted shadow-md" aria-hidden />
      <div className="text-center leading-tight">
        <div className="text-xs font-medium text-foreground">{agent.name}</div>
        <div className="text-[10px] text-muted-foreground">{agent.role}</div>
      </div>
    </div>
  );
}

function CurrentTaskBubble({ agent }: { agent: AgentSnapshot }) {
  if (agent.status === "offline") return null;

  const thinking = agent.status === "thinking";
  const task = agent.currentTask;

  if (!task && !thinking) return null;

  return (
    <div className="absolute -top-14 left-1/2 z-30 -translate-x-1/2">
      <div className="relative max-w-[160px] overflow-hidden rounded-xl border border-border bg-card/95 px-3 py-1.5 text-xs text-foreground shadow-md">
        <BubbleContent title={task?.title ?? null} thinking={thinking} />
        <span
          className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-border bg-card/95"
          aria-hidden
        />
      </div>
    </div>
  );
}

function BubbleContent({
  title,
  thinking,
}: {
  title: string | null;
  thinking: boolean;
}) {
  if (!title) {
    return <ThinkingDots />;
  }

  const showTicker = title.length > TICKER_THRESHOLD;

  return (
    <span className="flex items-center gap-1.5">
      <span className="block min-w-0 flex-1 overflow-hidden">
        {showTicker ? (
          <span className="block whitespace-nowrap animate-office-ticker">
            {title}
          </span>
        ) : (
          <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
            {title}
          </span>
        )}
      </span>
      {thinking && <ThinkingDots />}
    </span>
  );
}

function ThinkingDots() {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label="Sta pensando"
    >
      <span
        className="h-1 w-1 animate-bounce rounded-full bg-warning"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="h-1 w-1 animate-bounce rounded-full bg-warning"
        style={{ animationDelay: "120ms" }}
      />
      <span
        className="h-1 w-1 animate-bounce rounded-full bg-warning"
        style={{ animationDelay: "240ms" }}
      />
    </span>
  );
}
