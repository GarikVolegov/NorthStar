import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, DatabaseZap } from "lucide-react";

import { HealthBadge, KpiCard, percent } from "./shared";
import type { RagMetrics } from "./types";

export function RagCoreSection({ rag }: { rag: RagMetrics }) {
  const fallbackState =
    rag.fallbackRate > rag.alertThresholds.fallbackRate ? "warning" : "ok";
  const emptyState =
    rag.emptyResultRate > rag.alertThresholds.emptyResultRate
      ? "warning"
      : "ok";
  const latencyRows = (["pgvector", "js", "none"] as const).map((backend) => ({
    backend,
    avgMs: rag.avgLatencyMsByBackend[backend] ?? 0,
  }));

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <DatabaseZap className="w-5 h-5" />
          RAG Core
        </h2>
        <Badge variant="outline" className="text-xs">
          finestra {rag.alertThresholds.windowMinutes} min
        </Badge>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Retrieve totali"
          value={rag.totalRetrieves.toLocaleString("it-IT")}
          icon={<DatabaseZap className="w-4 h-4" />}
        />
        <KpiCard
          label="Fallback rate"
          value={percent(rag.fallbackRate)}
          sub={`soglia ${percent(rag.alertThresholds.fallbackRate)}`}
          icon={<HealthBadge state={fallbackState} />}
        />
        <KpiCard
          label="Empty result rate"
          value={percent(rag.emptyResultRate)}
          sub={`soglia ${percent(rag.alertThresholds.emptyResultRate)}`}
          icon={<HealthBadge state={emptyState} />}
        />
        <KpiCard
          label="JS limit hits"
          value={rag.jsLimitHits.toLocaleString("it-IT")}
          sub={`${rag.scoreSamplesByBackend.pgvector + rag.scoreSamplesByBackend.js} score osservati`}
          icon={<Activity className="w-4 h-4" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Latenza media per backend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Backend</th>
                  <th className="py-2 pr-4 font-medium">Media</th>
                  <th className="py-2 font-medium">Score samples</th>
                </tr>
              </thead>
              <tbody>
                {latencyRows.map((row) => (
                  <tr key={row.backend} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">{row.backend}</td>
                    <td className="py-3 pr-4 tabular-nums">
                      {Math.round(row.avgMs)}ms
                    </td>
                    <td className="py-3 tabular-nums">
                      {row.backend === "none"
                        ? "-"
                        : rag.scoreSamplesByBackend[row.backend].toLocaleString(
                            "it-IT",
                          )}
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
