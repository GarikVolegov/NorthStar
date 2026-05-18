import { RefreshCw, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HEALTH_UI } from "./config";
import type { BusinessStatusSnapshot, SidebarSection } from "./types";

type StatusSectionProps = {
  data: BusinessStatusSnapshot | null;
  loading: boolean;
  onRefresh: () => void;
  onNavigateSection: (section: SidebarSection) => void;
};

export function StatusSection({
  data,
  loading,
  onRefresh,
  onNavigateSection,
}: StatusSectionProps) {
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
        <Button size="sm" variant="outline" onClick={onRefresh} disabled={loading} className="min-h-11">
          {loading ? <RefreshCw size={13} className="animate-spin mr-1" /> : <RefreshCw size={13} className="mr-1" />}
          Aggiorna
        </Button>
      </div>

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
    </div>
  );
}
