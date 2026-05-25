import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, BarChart3, RefreshCw } from "lucide-react";
import type { BusinessStatusSnapshot, SidebarSection } from "./types";

type BusinessMetricsSectionProps = {
  data: BusinessStatusSnapshot | null;
  loading: boolean;
  error?: string | null;
  onRefresh: () => void;
  onNavigateSection: (section: SidebarSection) => void;
};

export function BusinessMetricsSection({
  data,
  loading,
  error,
  onRefresh,
  onNavigateSection,
}: BusinessMetricsSectionProps) {
  return (
    <div className="p-4 md:p-8 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-serif font-bold">
            <BarChart3 className="w-5 h-5 inline mr-2 text-primary" />
            Metriche Business
          </h3>
          <p className="text-sm text-muted-foreground">
            Crescita, conversione e segnali per decidere cosa correggere.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onRefresh}
          disabled={loading}
          className="min-h-11"
        >
          {loading ? (
            <RefreshCw size={13} className="animate-spin mr-1" />
          ) : (
            <RefreshCw size={13} className="mr-1" />
          )}
          Aggiorna
        </Button>
      </div>

      {error && (
        <div
          className="rounded-lg border border-danger-muted bg-danger-surface p-4 text-sm text-danger"
          role="alert"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium">Metriche non raggiungibili</p>
              <p className="mt-1 break-words">{error}</p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      ) : data ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {[
              {
                label: "Utenti",
                value: data.business.users.total,
                detail: `+${data.business.users.new30d} in 30g`,
              },
              {
                label: "Nuovi 7g",
                value: data.business.users.new7d,
                detail: "Acquisizione breve",
              },
              {
                label: "Test",
                value: data.business.tests.total,
                detail: `+${data.business.tests.recent30d} in 30g`,
              },
              {
                label: "Premium",
                value: data.business.users.premium,
                detail: `${data.business.users.conversionRate}% conversione`,
              },
              {
                label: "Test/User",
                value: `${data.funnels.userToTestRate}%`,
                detail: "Attivazione",
              },
              {
                label: "Lead conv.",
                value: `${data.funnels.leadConversionRate}%`,
                detail: "Partner",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg p-4 bg-card border min-w-0"
              >
                <p className="text-2xl font-bold truncate">{item.value}</p>
                <p className="text-xs font-medium text-muted-foreground">
                  {item.label}
                </p>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-lg border bg-card p-4">
              <h4 className="font-semibold text-sm mb-3">Trend sintetico</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">
                    Utenti 7g / 30g
                  </p>
                  <p className="text-lg font-bold">
                    {data.business.users.new7d} / {data.business.users.new30d}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Test 7g / 30g</p>
                  <p className="text-lg font-bold">
                    {data.business.tests.recent7d} /{" "}
                    {data.business.tests.recent30d}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">
                    Test confermati
                  </p>
                  <p className="text-lg font-bold">
                    {data.business.tests.completionRate}%
                  </p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">AI error rate</p>
                  <p className="text-lg font-bold">
                    {data.technical.ai.errorRate}%
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h4 className="font-semibold text-sm">Decisioni rapide</h4>
                <Badge
                  variant={
                    data.technical.status === "healthy"
                      ? "secondary"
                      : "default"
                  }
                >
                  {data.technical.label}
                </Badge>
              </div>
              <div className="space-y-2">
                {data.actions
                  .filter((action) => (action.count ?? 0) > 0)
                  .slice(0, 5)
                  .map((action) => (
                    <button
                      key={action.path}
                      type="button"
                      onClick={() => onNavigateSection(action.section)}
                      className="w-full min-h-11 rounded-lg border bg-background p-3 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">
                          {action.label}
                        </span>
                        <Badge variant="outline">{action.count}</Badge>
                      </div>
                    </button>
                  ))}
                {data.actions.every((action) => !action.count) && (
                  <p className="text-sm text-muted-foreground">
                    Nessuna azione urgente: guarda i trend e continua a
                    monitorare.
                  </p>
                )}
              </div>
            </div>
          </div>

          {data.business.topSectors && data.business.topSectors.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <h4 className="font-semibold mb-2 text-sm">
                Settori più popolari
              </h4>
              <div className="space-y-1">
                {data.business.topSectors.slice(0, 5).map((sector) => (
                  <div
                    key={String(sector.sectorId)}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/40"
                  >
                    <span className="text-sm">
                      Settore #{sector.sectorId ?? "n/d"}
                    </span>
                    <Badge variant="outline">{sector.count}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nessun dato disponibile.
          </p>
          <Button
            variant="outline"
            className="mt-3 min-h-11"
            onClick={onRefresh}
          >
            Riprova
          </Button>
        </div>
      )}
    </div>
  );
}
