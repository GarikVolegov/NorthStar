import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

import { HealthBadge, KpiCard } from "./shared";
import type { TechDebtMetrics } from "./types";

const TECH_DEBT_LABELS: Record<string, string> = {
  directApiFetch: "Fetch API diretti",
  globalNamespacePollution: "Global pollution",
  hotConsole: "Console hot path",
  adminHardcodedColors: "Colori admin hardcoded",
  productionDbAny: "DB as any prod",
};

export function TechDebtSection({ techDebt }: { techDebt: TechDebtMetrics }) {
  const latest = techDebt.latest;
  if (!latest) return null;
  const latestTracked = latest.tracked ?? latest.metrics ?? {};
  const latestGated = latest.gated ?? latest.metrics ?? {};
  const previousTracked =
    techDebt.previous?.tracked ?? techDebt.previous?.metrics ?? {};
  const rows = Object.entries(latestTracked).map(([key, value]) => {
    const previous = previousTracked[key];
    return {
      key,
      label: TECH_DEBT_LABELS[key] ?? key,
      value,
      gated: latestGated[key] ?? value,
      delta: typeof previous === "number" ? value - previous : null,
    };
  });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Tech Debt
        </h2>
        <Badge
          variant={techDebt.gateStatus === "ok" ? "outline" : "destructive"}
          className="text-xs"
        >
          {techDebt.gateStatus === "ok" ? "in controllo" : "regressione"}
        </Badge>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {rows.map((row) => (
          <KpiCard
            key={row.key}
            label={row.label}
            value={row.value.toLocaleString("it-IT")}
            sub={
              row.delta === null
                ? `${latest.sprint} · gated ${row.gated}`
                : `${row.delta > 0 ? "+" : ""}${row.delta} vs sprint precedente · gated ${row.gated}`
            }
            icon={
              <HealthBadge
                state={row.delta !== null && row.delta > 0 ? "warning" : "ok"}
              />
            }
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Storico versionato</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Sprint</th>
                  <th className="py-2 pr-4 font-medium">Data</th>
                  <th className="py-2 font-medium">Totale gated</th>
                </tr>
              </thead>
              <tbody>
                {techDebt.history.slice(-4).map((snapshot) => (
                  <tr
                    key={`${snapshot.sprint}-${snapshot.date}`}
                    className="border-b last:border-0"
                  >
                    <td className="py-3 pr-4 font-medium">{snapshot.sprint}</td>
                    <td className="py-3 pr-4">{snapshot.date}</td>
                    <td className="py-3 tabular-nums">
                      {Object.values(snapshot.tracked ?? snapshot.metrics ?? {})
                        .reduce((sum, value) => sum + value, 0)
                        .toLocaleString("it-IT")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
