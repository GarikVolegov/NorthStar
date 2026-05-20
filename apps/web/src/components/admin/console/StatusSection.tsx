import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Database,
  Play,
  Power,
  RefreshCw,
  RotateCcw,
  Server,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { HEALTH_UI } from "./config";
import type { AdminOpsAction, AdminOpsStatus, BusinessStatusSnapshot, SidebarSection } from "./types";

type StatusSectionProps = {
  data: BusinessStatusSnapshot | null;
  loading: boolean;
  error?: string | null;
  opsData: AdminOpsStatus | null;
  opsLoading: boolean;
  opsActionLoading: string | null;
  opsError: string | null;
  onRefresh: () => void;
  onOpsRefresh: () => void;
  onOpsAction: (action: AdminOpsAction, confirmation: string) => void;
  onMaintenanceToggle: (enabled: boolean) => void;
  onNavigateSection: (section: SidebarSection) => void;
};

const OPS_CONFIRMATION: Record<AdminOpsAction, { title: string; label: string; description: string }> = {
  "server-start": {
    title: "Accendi server",
    label: "ACCENDI SERVER",
    description: "Avvia il servizio northstar-server tramite Docker Compose, se il control plane e disponibile.",
  },
  "server-stop": {
    title: "Spegni server",
    label: "SPEGNI SERVER",
    description: "Spegne il backend. Dopo questa azione la console potrebbe non rispondere finche il servizio non viene riavviato.",
  },
  "server-restart": {
    title: "Riavvia server",
    label: "RIAVVIA SERVER",
    description: "Riavvia il backend NorthStar. Le richieste in corso possono essere interrotte.",
  },
  "database-restart": {
    title: "Riavvia database",
    label: "RIAVVIA DATABASE",
    description: "Riavvia Postgres via Docker Compose. Usa prima la maintenance mode se ci sono utenti attivi.",
  },
};

function formatBytes(value: number) {
  if (!Number.isFinite(value)) return "0 MB";
  return `${Math.round(value / 1024 / 1024)} MB`;
}

function formatUptime(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hrs}h ${mins}m`;
}

function statusBadge(status: string) {
  if (["online", "running", "ok"].includes(status)) return "border-emerald-200 text-emerald-700 bg-emerald-500/10";
  if (["maintenance", "degraded", "unknown", "not_configured"].includes(status)) return "border-amber-200 text-amber-700 bg-amber-500/10";
  return "border-red-200 text-red-700 bg-red-500/10";
}

export function StatusSection({
  data,
  loading,
  error,
  opsData,
  opsLoading,
  opsActionLoading,
  opsError,
  onRefresh,
  onOpsRefresh,
  onOpsAction,
  onMaintenanceToggle,
  onNavigateSection,
}: StatusSectionProps) {
  const [pendingAction, setPendingAction] = useState<AdminOpsAction | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const pendingConfig = pendingAction ? OPS_CONFIRMATION[pendingAction] : null;
  const runConfirmedAction = () => {
    if (!pendingAction) return;
    onOpsAction(pendingAction, confirmation);
    setPendingAction(null);
    setConfirmation("");
  };

  const openAction = (action: AdminOpsAction) => {
    setPendingAction(action);
    setConfirmation("");
  };

  return (
    <div className="p-4 md:p-8 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-serif font-bold">
            <Settings className="w-5 h-5 inline mr-2 text-primary" />
            Status & Setup
          </h3>
          <p className="text-sm text-muted-foreground">Salute tecnica, configurazione e problemi recenti da correggere.</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            onRefresh();
            onOpsRefresh();
          }}
          disabled={loading || opsLoading}
          className="min-h-11"
        >
          {loading || opsLoading ? <RefreshCw size={13} className="animate-spin mr-1" /> : <RefreshCw size={13} className="mr-1" />}
          Aggiorna
        </Button>
      </div>

      {opsError && (
        <div className="rounded-lg border border-red-200 bg-red-500/10 p-3 text-sm text-red-700">
          {opsError}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-500/10 p-3 text-sm text-red-700" role="alert">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium">Status business non raggiungibile</p>
              <p className="mt-1 break-words">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <Server className="h-4 w-4 text-primary" />
                Server
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Processo API, Docker service e azioni operative.
              </p>
            </div>
            <Badge variant="outline" className={cn("capitalize", statusBadge(opsData?.server.status ?? "unknown"))}>
              {opsData?.server.status ?? "unknown"}
            </Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Uptime</p>
              <p className="font-semibold">{opsData ? formatUptime(opsData.server.uptimeSeconds) : "--"}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Memoria</p>
              <p className="font-semibold">{opsData ? formatBytes(opsData.server.memory.heapUsed) : "--"}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">PID</p>
              <p className="font-semibold">{opsData?.server.pid ?? "--"}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Docker</p>
              <p className="font-semibold capitalize">{opsData?.server.docker.status ?? "unknown"}</p>
            </div>
          </div>
          {!opsData?.enabled && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-500/10 p-3 text-xs text-amber-700">
              Azioni Docker disabilitate. Imposta <span className="font-mono">ADMIN_OPS_ENABLED=true</span> per abilitarle.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onOpsRefresh} disabled={opsLoading} className="min-h-11">
              <RefreshCw size={14} className={cn("mr-1", opsLoading && "animate-spin")} />
              Stato
            </Button>
            <Button size="sm" variant="outline" onClick={() => openAction("server-start")} disabled={!opsData?.capabilities.serverStart || !!opsActionLoading} className="min-h-11">
              <Play size={14} className="mr-1" />
              Accendi
            </Button>
            <Button size="sm" variant="outline" onClick={() => openAction("server-restart")} disabled={!opsData?.capabilities.serverRestart || !!opsActionLoading} className="min-h-11">
              <RotateCcw size={14} className="mr-1" />
              Riavvia
            </Button>
            <Button size="sm" variant="destructive" onClick={() => openAction("server-stop")} disabled={!opsData?.capabilities.serverStop || !!opsActionLoading} className="min-h-11">
              <Power size={14} className="mr-1" />
              Spegni
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <Database className="h-4 w-4 text-primary" />
                Database
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Stato Postgres, pool connessioni e maintenance mode.
              </p>
            </div>
            <Badge variant="outline" className={cn("capitalize", statusBadge(opsData?.database.status ?? "unknown"))}>
              {opsData?.database.status ?? "unknown"}
            </Badge>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Pool</p>
              <p className="font-semibold">{opsData?.database.pool.totalCount ?? "--"}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Idle</p>
              <p className="font-semibold">{opsData?.database.pool.idleCount ?? "--"}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Waiting</p>
              <p className="font-semibold">{opsData?.database.pool.waitingCount ?? "--"}</p>
            </div>
          </div>
          <div className="mt-4 rounded-lg border bg-background p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Maintenance mode</p>
                <p className="text-xs text-muted-foreground">Blocca modifiche utente senza spegnere Postgres.</p>
              </div>
              <Switch
                checked={Boolean(opsData?.database.maintenance.enabled)}
                disabled={opsLoading || !opsData?.capabilities.databaseMaintenance}
                onCheckedChange={onMaintenanceToggle}
                aria-label="Maintenance mode database"
              />
            </div>
            {opsData?.database.maintenance.reason && (
              <p className="mt-2 text-xs text-muted-foreground">{opsData.database.maintenance.reason}</p>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => openAction("database-restart")} disabled={!opsData?.capabilities.databaseRestart || !!opsActionLoading} className="min-h-11">
              <RotateCcw size={14} className="mr-1" />
              Riavvia database
            </Button>
            {!opsData?.capabilities.databaseRestart && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <AlertTriangle size={13} />
                Restart DB disabilitato: usa maintenance mode o abilita ADMIN_OPS_ALLOW_DB_RESTART.
              </p>
            )}
          </div>
        </div>
      </div>

      {opsData?.lastOperation && (
        <div className="rounded-lg border bg-card p-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">Ultima operazione: {opsData.lastOperation.service} / {opsData.lastOperation.action}</p>
              <p className="text-xs text-muted-foreground">{opsData.lastOperation.message}</p>
            </div>
            <Badge variant="outline" className="capitalize">{opsData.lastOperation.status}</Badge>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      ) : data ? (
        <div className="space-y-5">
          <div className={cn("rounded-lg p-4 border", HEALTH_UI[data.technical.status].tone)}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h4 className="font-semibold mb-1">{data.technical.label}</h4>
                <p className="text-xs">
                  Uptime: {Math.floor(data.technical.uptimeSeconds / 3600)}h {Math.floor((data.technical.uptimeSeconds % 3600) / 60)}m
                </p>
              </div>
              <Badge variant="outline">{data.technical.reasons.length} segnali</Badge>
            </div>
            {data.technical.reasons.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.technical.reasons.slice(0, 5).map((reason) => (
                  <Badge key={reason} variant="outline" className="bg-background/60">{reason}</Badge>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {Object.entries(data.technical.services ?? {}).map(([name, service]) => (
              <div key={name} className={cn(
                "rounded-lg p-3 border bg-card",
                service.status === "ok" && "border-emerald-200",
                service.status === "not_configured" && "border-amber-200",
                service.status === "error" && "border-red-200",
              )}>
                <p className="text-sm font-medium">{service.label}</p>
                <p className={cn(
                  "text-xs mt-1",
                  service.status === "ok" ? "text-emerald-600" :
                    service.status === "not_configured" ? "text-amber-600" :
                      "text-red-600",
                )}>{service.status.replace("_", " ")}</p>
                {service.uptimeSeconds != null && <p className="text-xs text-muted-foreground">{Math.floor(service.uptimeSeconds / 60)}m uptime</p>}
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h4 className="font-semibold text-sm">Environment</h4>
                <span className="text-xs text-muted-foreground">{data.env.configured}/{data.env.total} configurate</span>
              </div>
              {data.env.missingCritical.length > 0 ? (
                <div className="mb-3">
                  <p className="text-xs font-medium text-red-600 mb-1">Critiche mancanti</p>
                  <div className="flex flex-wrap gap-2">
                    {data.env.missingCritical.map((key) => <Badge key={key} variant="outline" className="border-red-200 text-red-700">{key}</Badge>)}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-emerald-700 mb-3">Env critiche configurate.</p>
              )}
              {data.env.missingOptional.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-amber-700 mb-1">Opzionali mancanti</p>
                  <div className="flex flex-wrap gap-2">
                    {data.env.missingOptional.map((key) => <Badge key={key} variant="outline" className="border-amber-200 text-amber-700">{key}</Badge>)}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-card p-4">
              <h4 className="font-semibold text-sm mb-3">Link rapidi</h4>
              <div className="grid sm:grid-cols-2 gap-2">
                {data.actions.map((action) => (
                  <button
                    key={action.path}
                    type="button"
                    onClick={() => onNavigateSection(action.section)}
                    className="min-h-11 rounded-lg border bg-background p-3 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="text-sm font-medium">{action.label}</span>
                    {action.count != null && <Badge variant="outline" className="ml-2">{action.count}</Badge>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-lg border bg-card p-4">
              <h4 className="font-semibold text-sm mb-3">Errori recenti</h4>
              {data.technical.errors.recent.length > 0 ? (
                <div className="space-y-2">
                  {data.technical.errors.recent.map((error) => (
                    <div key={`${error.file}-${error.function}-${error.capturedAt}`} className="rounded-lg border bg-background p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium line-clamp-1">{error.message}</p>
                        <Badge variant="outline">{error.occurrences}x</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{error.file} · {error.function}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nessun errore catturato di recente.</p>
              )}
            </div>

            <div className="rounded-lg border bg-card p-4">
              <h4 className="font-semibold text-sm mb-3">Agenti e AI</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Run agenti</p>
                  <p className="text-lg font-bold">{data.technical.agents.totalRuns}</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Errori agenti</p>
                  <p className="text-lg font-bold">{data.technical.agents.errorRate}%</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">AI request</p>
                  <p className="text-lg font-bold">{data.technical.ai.requests}</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">AI error rate</p>
                  <p className="text-lg font-bold">{data.technical.ai.errorRate}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Nessun dato disponibile.</p>
          <Button variant="outline" className="mt-3 min-h-11" onClick={onRefresh}>Riprova</Button>
        </div>
      )}

      <AlertDialog open={Boolean(pendingAction)} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingConfig?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pendingConfig?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <p className="text-sm">
              Scrivi <span className="font-mono font-semibold">{pendingConfig?.label}</span> per confermare.
            </p>
            <Input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={pendingConfig?.label}
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmation("")}>Annulla</AlertDialogCancel>
            <Button
              type="button"
              variant={pendingAction === "server-stop" ? "destructive" : "default"}
              disabled={!pendingConfig || confirmation !== pendingConfig.label || !!opsActionLoading}
              onClick={runConfirmedAction}
            >
              Conferma
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
