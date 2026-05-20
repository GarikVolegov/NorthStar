import { useState, type CSSProperties, type ReactNode } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAdminAgents, type ConnectionState } from "@/contexts/AdminAgentContext";
import { useOfficeView } from "@/hooks/useOfficeView";
import { AgentDesk } from "@/components/admin-office/AgentDesk";
import { AgentDrawer } from "@/components/admin-office/AgentDrawer";
import { AgentGrid } from "@/components/admin-office/AgentGrid";
import { StatusBar } from "@/components/admin-office/StatusBar";
import { positionFor } from "@/components/admin-office/positions";
import { STATUS_DOT_CLASS, STATUS_LABEL } from "@/components/admin-office/status";
import type { AgentStatus } from "@workspace/api-zod/agent-registry";

const FLOOR_BG_STYLE: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(45deg, hsl(var(--card)) 0 24px, hsl(var(--muted) / 0.35) 24px 25px)",
};

const STATIC_DECORATIONS = [
  { id: "meeting-1", type: "meeting-room" as const, xPct: 50, yPct: 52 },
  { id: "coffee-1", type: "coffee" as const, xPct: 10, yPct: 14 },
  { id: "plant-1", type: "plant" as const, xPct: 92, yPct: 14 },
  { id: "plant-2", type: "plant" as const, xPct: 7, yPct: 92 },
  { id: "plant-3", type: "plant" as const, xPct: 93, yPct: 92 },
  { id: "plant-4", type: "plant" as const, xPct: 35, yPct: 12 },
];

export default function AdminOfficePage() {
  const { snapshot, connectionState, refresh } = useAdminAgents();
  const [view, setView] = useOfficeView();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const agents = snapshot?.agents ?? [];
  const selected = agents.find((a) => a.slug === selectedSlug) ?? null;

  return (
    <div className="min-h-screen bg-background p-6">
      <header className="mx-auto mb-4 flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Agent Room</h1>
          <p className="text-sm text-muted-foreground">
            Vista live degli agenti AI di NorthStar. Clicca un agente per i dettagli.
          </p>
        </div>
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(next) => {
            if (next === "office" || next === "grid") setView(next);
          }}
          aria-label="Cambia vista"
        >
          <ToggleGroupItem value="office" aria-label="Vista ufficio">
            Ufficio
          </ToggleGroupItem>
          <ToggleGroupItem value="grid" aria-label="Vista griglia">
            Griglia
          </ToggleGroupItem>
        </ToggleGroup>
      </header>

      <StatusBar aggregates={snapshot?.aggregates ?? null} connectionState={connectionState} />

      {view === "office" ? (
        <>
          <FloorPlan>
            {STATIC_DECORATIONS.map((dec) => (
              <Decoration key={dec.id} dec={dec} />
            ))}
            {agents.map((agent, index) => (
              <AgentDesk
                key={agent.slug}
                agent={agent}
                position={positionFor(agent.slug, index)}
                onSelect={() => setSelectedSlug(agent.slug)}
              />
            ))}
            {agents.length === 0 && (
              <EmptyState connectionState={connectionState} />
            )}
          </FloorPlan>
          <Legend />
        </>
      ) : agents.length === 0 ? (
        <div className="mx-auto max-w-6xl">
          <EmptyState connectionState={connectionState} />
        </div>
      ) : (
        <AgentGrid agents={agents} onSelect={setSelectedSlug} />
      )}

      <AgentDrawer
        agent={selected}
        onOpenChange={(open) => {
          if (!open) setSelectedSlug(null);
        }}
        onRefresh={() => {
          void refresh();
        }}
      />
    </div>
  );
}

function FloorPlan({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative mx-auto aspect-[16/10] w-full max-w-6xl overflow-hidden rounded-2xl border-4 border-border bg-card shadow-2xl"
      style={FLOOR_BG_STYLE}
    >
      <Window position="top" />
      <Window position="left" />
      <Window position="right" />
      {children}
    </div>
  );
}

function Window({ position }: { position: "top" | "left" | "right" }) {
  const base =
    "absolute bg-gradient-to-b from-sky-400/30 to-sky-200/10 border border-sky-300/40 rounded-sm";
  if (position === "top") {
    return (
      <>
        <div className={`${base} top-1 left-[18%] h-6 w-[18%]`} />
        <div className={`${base} top-1 left-[64%] h-6 w-[18%]`} />
      </>
    );
  }
  if (position === "left") {
    return <div className={`${base} left-1 top-[45%] h-[18%] w-6`} />;
  }
  return <div className={`${base} right-1 top-[45%] h-[18%] w-6`} />;
}

interface DecorationDef {
  id: string;
  type: "meeting-room" | "coffee" | "plant";
  xPct: number;
  yPct: number;
}

function Decoration({ dec }: { dec: DecorationDef }) {
  if (dec.type === "meeting-room") return <MeetingRoom xPct={dec.xPct} yPct={dec.yPct} />;
  if (dec.type === "coffee") return <CoffeeArea xPct={dec.xPct} yPct={dec.yPct} />;
  return <Plant xPct={dec.xPct} yPct={dec.yPct} />;
}

function MeetingRoom({ xPct, yPct }: { xPct: number; yPct: number }) {
  const chairs = Array.from({ length: 6 }, (_, i) => i);
  return (
    <div
      className="absolute z-10 flex h-40 w-40 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/70 backdrop-blur-sm"
      style={{ left: `${xPct}%`, top: `${yPct}%` }}
      aria-label="Sala meeting"
    >
      <span className="text-xs uppercase tracking-wider text-muted-foreground">Meeting</span>
      {chairs.map((i) => (
        <span
          key={i}
          className="absolute h-3 w-3 rounded-full bg-border"
          style={{
            transform: `rotate(${i * 60}deg) translateY(-72px)`,
            transformOrigin: "center",
          }}
          aria-hidden
        />
      ))}
    </div>
  );
}

function CoffeeArea({ xPct, yPct }: { xPct: number; yPct: number }) {
  return (
    <div
      className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-md border border-amber-300/30 bg-amber-100/10 px-3 py-2"
      style={{ left: `${xPct}%`, top: `${yPct}%` }}
      aria-label="Coffee area"
    >
      <span className="text-2xl" aria-hidden>☕</span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Coffee</span>
    </div>
  );
}

function Plant({ xPct, yPct }: { xPct: number; yPct: number }) {
  return (
    <span
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2 text-3xl"
      style={{ left: `${xPct}%`, top: `${yPct}%` }}
      aria-hidden
    >
      🪴
    </span>
  );
}

function EmptyState({ connectionState }: { connectionState: ConnectionState }) {
  let title = "Nessun agente da mostrare";
  let body =
    "La pagina e' caricata ma il registry non ha popolato gli agenti.";
  let hint: string | null = null;

  if (connectionState === "idle") {
    title = "Auth non pronta o non sei admin";
    body =
      "Il provider non avvia il fetch finche` `user.role !== \"admin\"`. Verifica che il login sia completato e che il tuo utente abbia role='admin' nel DB.";
    hint = "Console (dev): controlla `[AdminAgentProvider]` per role e authReady.";
  } else if (connectionState === "connecting" || connectionState === "reconnecting") {
    title = "Connessione al backend in corso";
    body =
      "Lo snapshot sta per arrivare. Se resta cosi` a lungo, controlla che il server gira (porta 3001) e che `/api/admin/agents` risponda 200.";
  } else if (connectionState === "open") {
    title = "Backend connesso, nessun agente nel DB";
    body =
      "Lo snapshot e' vuoto: probabilmente le migration `0018_agent_employees_tasks.sql` e `0029_seed_wendy_agent.sql` non sono state applicate.";
    hint = "Esegui `pnpm db:migrate`.";
  } else if (connectionState === "closed") {
    title = "Connessione chiusa";
    body =
      "Il backend non risponde o il token e' stato rifiutato. Verifica `pnpm dev:server` e che `/api/auth/clerk-sync` non sia in errore.";
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-6">
      <div className="max-w-md rounded-xl border border-border bg-card/90 p-6 shadow-2xl backdrop-blur-sm">
        <h2 className="mb-2 text-base font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{body}</p>
        {hint && (
          <p className="mt-2 text-xs text-muted-foreground/80">{hint}</p>
        )}
      </div>
    </div>
  );
}

function Legend() {
  const entries: { status: AgentStatus; label: string }[] = [
    { status: "idle", label: STATUS_LABEL.idle },
    { status: "thinking", label: STATUS_LABEL.thinking },
    { status: "executing", label: STATUS_LABEL.executing },
    { status: "error", label: STATUS_LABEL.error },
    { status: "offline", label: STATUS_LABEL.offline },
  ];
  return (
    <div className="mx-auto mt-4 flex max-w-6xl flex-wrap items-center gap-4 rounded-md border border-border bg-card/40 px-4 py-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Stati</span>
      {entries.map((e) => (
        <span key={e.status} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT_CLASS[e.status]}`} />
          {e.label}
        </span>
      ))}
    </div>
  );
}
