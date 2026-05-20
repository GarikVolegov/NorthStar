import type { RegistryAggregates } from "@workspace/api-zod/agent-registry";
import type { ConnectionState } from "@/contexts/AdminAgentContext";

const CONNECTION_DOT: Record<ConnectionState, string> = {
  idle: "bg-zinc-500",
  connecting: "bg-amber-400 animate-pulse",
  open: "bg-emerald-500",
  reconnecting: "bg-amber-500 animate-pulse",
  closed: "bg-red-500",
};

const CONNECTION_LABEL: Record<ConnectionState, string> = {
  idle: "In attesa",
  connecting: "Connessione…",
  open: "Live",
  reconnecting: "Riconnessione…",
  closed: "Disconnesso",
};

interface StatusBarProps {
  aggregates: RegistryAggregates | null;
  connectionState: ConnectionState;
}

export function StatusBar({ aggregates, connectionState }: StatusBarProps) {
  const online = aggregates?.online ?? 0;
  const executing = aggregates?.executing ?? 0;
  const tokens = aggregates?.tokensTotalToday ?? 0;

  return (
    <div className="mx-auto mb-4 flex max-w-6xl flex-wrap items-center gap-3 rounded-lg border border-border bg-card/40 px-4 py-2 text-sm">
      <Stat label="Online" value={online.toString()} />
      <Stat
        label="In esecuzione"
        value={executing.toString()}
        pulse={executing > 0}
      />
      <Stat label="Token oggi" value={tokens.toLocaleString("it-IT")} />
      <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
        <span className={`h-2 w-2 rounded-full ${CONNECTION_DOT[connectionState]}`} aria-hidden />
        {CONNECTION_LABEL[connectionState]}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  pulse = false,
}: {
  label: string;
  value: string;
  pulse?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`text-base font-semibold text-foreground tabular-nums ${pulse ? "animate-pulse" : ""}`}>
        {value}
      </span>
    </div>
  );
}
