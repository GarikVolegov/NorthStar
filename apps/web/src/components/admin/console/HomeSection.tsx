import {
  Bot,
  ChevronRight,
  ClipboardList,
  Handshake,
  Home,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HEALTH_UI } from "./config";
import type { AdminOverview, SidebarSection } from "./types";

type HomeSectionProps = {
  data: AdminOverview | null;
  loading: boolean;
  onRefresh: () => void;
  onNavigateSection: (section: SidebarSection) => void;
};

export function HomeSection({
  data,
  loading,
  onRefresh,
  onNavigateSection,
}: HomeSectionProps) {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-serif font-bold flex items-center gap-2">
            <Home className="w-5 h-5 text-primary" />
            Panoramica Admin
          </h3>
          <p className="text-sm text-muted-foreground">
            Control room operativa per capire in pochi secondi cosa richiede attenzione.
          </p>
        </div>
        <Button size="sm" variant="outline" className="min-h-11" onClick={onRefresh} disabled={loading}>
          {loading ? <RefreshCw size={14} className="animate-spin mr-2" /> : <RefreshCw size={14} className="mr-2" />}
          Aggiorna
        </Button>
      </div>

      {loading && !data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-32 rounded-lg border bg-card animate-pulse" />
          ))}
        </div>
      ) : !data ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <ShieldAlert className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium">Panoramica non disponibile</p>
          <p className="text-sm text-muted-foreground mt-1">
            Non sono riuscito a caricare la control room.
          </p>
          <Button className="mt-4 min-h-11" variant="outline" onClick={onRefresh}>
            Riprova
          </Button>
        </div>
      ) : (
        <>
          {(() => {
            const health = HEALTH_UI[data.health.status];
            const HealthIcon = health.icon;
            const summaryCards = [
              {
                label: "Azioni aperte",
                value: data.health.actionItems,
                detail: `${data.queues.reviewPending} review, ${data.inbox.unreadMessages} messaggi`,
                icon: ClipboardList,
                action: () => onNavigateSection("queue"),
              },
              {
                label: "Errori recenti",
                value: data.errors.totalCaptured,
                detail: `${data.errors.unique} unici, ${data.errors.brokenComponents.length} componenti`,
                icon: ShieldAlert,
                action: () => onNavigateSection("status"),
              },
              {
                label: "Agenti problematici",
                value: data.agents.critical + data.agents.degraded,
                detail: `${data.agents.critical} critici, ${data.agents.degraded} degradati`,
                icon: Bot,
                action: () => onNavigateSection("agenti-salute"),
              },
            ];

            return (
              <div className="grid gap-3 xl:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))]">
                <div className={cn("rounded-lg border p-4", health.tone)}>
                  <div className="flex items-start gap-3">
                    <span className={cn("mt-1 h-3 w-3 rounded-full shrink-0", health.dot)} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <HealthIcon className="w-5 h-5" />
                        <p className="font-semibold">{data.health.label || health.label}</p>
                      </div>
                      <p className="text-sm mt-2 opacity-90">
                        {data.health.reasons.length > 0
                          ? data.health.reasons.slice(0, 3).join(" - ")
                          : "Nessuna anomalia operativa rilevata."}
                      </p>
                    </div>
                  </div>
                </div>

                {summaryCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.label}
                      type="button"
                      onClick={card.action}
                      className="min-h-32 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Icon className="w-5 h-5 text-muted-foreground" />
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <p className="mt-4 text-3xl font-bold">{card.value}</p>
                      <p className="text-sm font-medium">{card.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{card.detail}</p>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="font-semibold">Azioni richieste</p>
                  <p className="text-xs text-muted-foreground">Code operative da svuotare</p>
                </div>
                <Badge variant={data.queues.totalOpen > 0 ? "default" : "secondary"}>
                  {data.queues.totalOpen} aperte
                </Badge>
              </div>
              <div className="space-y-2">
                {[
                  { label: "Richieste in revisione", value: data.queues.reviewPending, section: "queue" as SidebarSection },
                  { label: "Articoli crescita pending", value: data.queues.growthPending, section: "crescita" as SidebarSection },
                  { label: "Messaggi non letti", value: data.inbox.unreadMessages, section: "messaggi" as SidebarSection },
                  { label: "Lead da contattare", value: data.inbox.pendingLeads, section: "affiliazione" as SidebarSection },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => onNavigateSection(item.section)}
                    className="min-h-11 w-full flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  >
                    <span className="text-sm">{item.label}</span>
                    <span className={cn("text-sm font-semibold", item.value > 0 ? "text-amber-700" : "text-muted-foreground")}>
                      {item.value}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="font-semibold">Errori API recenti</p>
                  <p className="text-xs text-muted-foreground">Execution monitor in memoria</p>
                </div>
                <Button size="sm" variant="ghost" className="min-h-11" onClick={() => onNavigateSection("status")}>
                  Dettagli
                </Button>
              </div>
              {data.errors.recent.length === 0 ? (
                <div className="rounded-md bg-muted/40 p-4 text-sm text-muted-foreground">
                  Nessun errore recente catturato.
                </div>
              ) : (
                <div className="space-y-2">
                  {data.errors.recent.slice(0, 3).map((error) => (
                    <div key={`${error.file}-${error.function}-${error.code ?? "error"}`} className="rounded-md border p-3">
                      <p className="text-sm font-medium truncate">{error.file}</p>
                      <p className="text-xs text-muted-foreground truncate">{error.message}</p>
                      <p className="text-xs text-red-600 mt-1">{error.occurrences} occorrenze</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="font-semibold">Agenti</p>
                  <p className="text-xs text-muted-foreground">Salute e fallimenti recenti</p>
                </div>
                <Button size="sm" variant="ghost" className="min-h-11" onClick={() => onNavigateSection("agenti-salute")}>
                  Apri
                </Button>
              </div>
              {data.agents.failedRecent.length === 0 && data.agents.critical + data.agents.degraded === 0 ? (
                <div className="rounded-md bg-muted/40 p-4 text-sm text-muted-foreground">
                  Nessun agente problematico negli ultimi 30 giorni.
                </div>
              ) : (
                <div className="space-y-2">
                  {data.agents.health
                    .filter((agent) => agent.status !== "healthy")
                    .slice(0, 3)
                    .map((agent) => (
                      <div key={agent.agentName} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">{agent.agentName}</p>
                          <Badge variant="outline">{agent.errorRate30d}% errori</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {agent.errorCount30d} errori su {agent.totalCalls30d} chiamate
                        </p>
                      </div>
                    ))}
                  {data.agents.failedRecent.slice(0, 2).map((run) => (
                    <div key={run.id} className="rounded-md border p-3">
                      <p className="text-sm font-medium truncate">{run.agentName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {run.errorMessage || "Run fallito senza messaggio"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border bg-card p-4">
              <p className="font-semibold mb-3">Metriche chiave</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Utenti", value: data.metrics.users.total },
                  { label: "Nuovi 30g", value: data.metrics.users.new30d },
                  { label: "Premium", value: data.metrics.users.premium },
                  { label: "Test", value: data.metrics.tests.total },
                  { label: "Eventi futuri", value: data.metrics.calendar?.upcoming ?? 0 },
                  { label: "Prossime 24h", value: data.metrics.calendar?.next24h ?? 0 },
                ].map((item) => (
                  <div key={item.label} className="rounded-md bg-muted/40 p-3">
                    <p className="text-xl font-bold">{item.value}</p>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <p className="font-semibold mb-3">Inbox business</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => onNavigateSection("messaggi")}
                  className="min-h-24 rounded-md border p-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  <MessageCircle className="w-5 h-5 text-muted-foreground" />
                  <p className="mt-3 text-2xl font-bold">{data.inbox.unreadMessages}</p>
                  <p className="text-sm font-medium">Messaggi non letti</p>
                  <p className="text-xs text-muted-foreground">{data.inbox.totalMessages} totali</p>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateSection("affiliazione")}
                  className="min-h-24 rounded-md border p-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  <Handshake className="w-5 h-5 text-muted-foreground" />
                  <p className="mt-3 text-2xl font-bold">{data.inbox.pendingLeads}</p>
                  <p className="text-sm font-medium">Lead da contattare</p>
                  <p className="text-xs text-muted-foreground">{data.inbox.totalLeads} totali</p>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
