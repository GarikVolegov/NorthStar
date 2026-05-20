import { AdminAuthGate } from "@/components/AdminAuthGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { getJson } from "@/lib/apiClient";
import {
  Activity,
  BarChart3,
  Brain,
  Crown,
  DatabaseZap,
  FlaskConical,
  GitBranch,
  Loader2,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const BASE = import.meta.env.BASE_URL || "/";

interface Metrics {
  users: {
    total: number;
    premium: number;
    new30d: number;
    new7d: number;
    conversionRate: number;
  };
  tests: {
    total: number;
    withUser: number;
    last30d: number;
    completionRate: string;
  };
  topSectors: Array<{ sectorId: number; name: string; count: number }>;
  dailySignups: Array<{ day: string; count: number }>;
  revenue: { mrr: number; total: number; currency: string } | null;
  generatedAt: string;
}

interface WendyMetrics {
  volumeByDomain: Record<string, number>;
  totalRequests: number;
  totalRewrites: number;
  rewriteRate: number;
  latencyByPhase: Record<string, { sum: number; count: number }>;
  rag?: RagMetrics;
  generatedAt: string;
}

interface TechDebtSnapshot {
  sprint: string;
  date: string;
  metrics?: Record<string, number>;
  tracked?: Record<string, number>;
  gated?: Record<string, number>;
}

interface TechDebtMetrics {
  latest: TechDebtSnapshot | null;
  previous: TechDebtSnapshot | null;
  history: TechDebtSnapshot[];
  gateStatus: "ok" | "warning";
  generatedAt: string;
}

function KpiCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            {label}
          </span>
          <span className="text-muted-foreground/60">{icon}</span>
        </div>
        <p className="text-3xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

interface RagMetrics {
  totalRetrieves: number;
  fallbackRate: number;
  emptyResultRate: number;
  jsLimitHits: number;
  avgLatencyMsByBackend: Record<"pgvector" | "js" | "none", number>;
  scoreSamplesByBackend: Record<"pgvector" | "js", number>;
  alertThresholds: {
    fallbackRate: number;
    emptyResultRate: number;
    windowMinutes: number;
  };
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function HealthBadge({ state }: { state: "ok" | "warning" }) {
  return (
    <Badge
      variant={state === "ok" ? "outline" : "destructive"}
      className="text-xs"
    >
      {state === "ok" ? "OK" : "Warning"}
    </Badge>
  );
}

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

export default function AdminMetriche() {
  const { key } = useAdminAuth();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [wendyMetrics, setWendyMetrics] = useState<WendyMetrics | null>(null);
  const [techDebtMetrics, setTechDebtMetrics] =
    useState<TechDebtMetrics | null>(null);
  const [techDebtUnavailable, setTechDebtUnavailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchMetrics = useCallback(async (adminKey: string) => {
    setLoading(true);
    setError(null);
    try {
      const [metricsRes, wendyRes] = await Promise.all([
        getJson<Metrics>(`${BASE}api/admin/metrics`, {
          headers: { Authorization: `Bearer ${adminKey}` },
        }),
        getJson<WendyMetrics>(`${BASE}api/admin/wendy-metrics`, {
          headers: { Authorization: `Bearer ${adminKey}` },
        }),
      ]);
      setMetrics(metricsRes);
      setWendyMetrics(wendyRes);
      setTechDebtUnavailable(false);
      getJson<TechDebtMetrics>(`${BASE}api/admin/tech-debt-metrics`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      })
        .then((data) => {
          setTechDebtMetrics(data);
          setTechDebtUnavailable(false);
        })
        .catch(() => {
          setTechDebtMetrics(null);
          setTechDebtUnavailable(true);
        });
      setLastRefresh(new Date());
    } catch {
      setError("Impossibile caricare le metriche.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (key) fetchMetrics(key);
  }, [key, fetchMetrics]);

  useEffect(() => {
    if (!key) return;
    const interval = setInterval(() => fetchMetrics(key), 60_000);
    return () => clearInterval(interval);
  }, [key, fetchMetrics]);

  return (
    <AdminAuthGate
      title="Metriche Business"
      description="Utenti, test, conversioni e revenue"
    >
      <div className="min-h-screen bg-muted/20 p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold">
                NorthStar â€” Metriche Business
              </h1>
              {lastRefresh && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Aggiornato il: {lastRefresh.toLocaleString("it-IT")}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchMetrics(key)}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span className="ml-2">Aggiorna</span>
              </Button>
            </div>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {loading && !metrics ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))}
            </div>
          ) : metrics ? (
            <>
              {/* KPI Grid */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  label="Utenti Totali"
                  value={metrics.users.total.toLocaleString("it-IT")}
                  sub={`+${metrics.users.new7d} ultimi 7gg`}
                  icon={<Users className="w-4 h-4" />}
                />
                <KpiCard
                  label="Utenti Premium"
                  value={metrics.users.premium.toLocaleString("it-IT")}
                  sub={`${metrics.users.conversionRate}% conversione`}
                  icon={<Crown className="w-4 h-4" />}
                />
                <KpiCard
                  label="Nuovi (30gg)"
                  value={metrics.users.new30d.toLocaleString("it-IT")}
                  icon={<TrendingUp className="w-4 h-4" />}
                />
                <KpiCard
                  label="MRR"
                  value={
                    metrics.revenue
                      ? `â‚¬${metrics.revenue.mrr.toLocaleString("it-IT")}`
                      : "N/D"
                  }
                  sub={
                    metrics.revenue
                      ? `ARR ~â‚¬${metrics.revenue.total.toLocaleString("it-IT")}`
                      : "Stripe non configurato"
                  }
                  icon={
                    <Badge variant="outline" className="text-xs">
                      â‚¬
                    </Badge>
                  }
                />
                <KpiCard
                  label="Test Completati"
                  value={metrics.tests.total.toLocaleString("it-IT")}
                  sub={`${metrics.tests.last30d} ultimi 30gg`}
                  icon={<FlaskConical className="w-4 h-4" />}
                />
                <KpiCard
                  label="Test con Account"
                  value={metrics.tests.withUser.toLocaleString("it-IT")}
                  sub={`${metrics.tests.completionRate}% con account`}
                  icon={<BarChart3 className="w-4 h-4" />}
                />
                <KpiCard
                  label="Conversione %"
                  value={`${metrics.users.conversionRate}%`}
                  sub="free â†’ premium"
                  icon={<TrendingUp className="w-4 h-4" />}
                />
                <KpiCard
                  label="Nuovi (7gg)"
                  value={metrics.users.new7d.toLocaleString("it-IT")}
                  icon={<Users className="w-4 h-4" />}
                />
              </div>

              {/* Daily Signups Chart */}
              {metrics.dailySignups.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Iscrizioni ultimi 30 giorni
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={metrics.dailySignups}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                        />
                        <XAxis
                          dataKey="day"
                          tick={{ fontSize: 11 }}
                          tickFormatter={(d: string) => d.slice(5)}
                        />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip
                          labelFormatter={(d: string) =>
                            new Date(d).toLocaleDateString("it-IT")
                          }
                          formatter={(v: number) => [v, "Iscrizioni"]}
                        />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Top Sectors */}
              {metrics.topSectors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Top Aree scelte</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={metrics.topSectors} layout="vertical">
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                        />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 11 }}
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 11 }}
                          width={160}
                        />
                        <Tooltip formatter={(v: number) => [v, "Scelte"]} />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {metrics.topSectors.map((_, i) => (
                            <Cell
                              key={i}
                              fill={`hsl(var(--chart-${(i % 5) + 1}))`}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}

          {/* â”€â”€ Wendy AI Metrics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {wendyMetrics && (
            <section className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Brain className="w-5 h-5" />
                Wendy AI â€” Metriche
              </h2>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  label="Richieste Totali"
                  value={wendyMetrics.totalRequests.toLocaleString("it-IT")}
                  icon={<MessageSquare className="w-4 h-4" />}
                />
                <KpiCard
                  label="Rewrite Rate"
                  value={`${(wendyMetrics.rewriteRate * 100).toFixed(1)}%`}
                  sub={`${wendyMetrics.totalRewrites} rewrites su ${wendyMetrics.totalRequests} richieste`}
                  icon={<GitBranch className="w-4 h-4" />}
                />
                {Object.entries(wendyMetrics.latencyByPhase ?? {})
                  .slice(0, 2)
                  .map(([phase, data]) => (
                    <KpiCard
                      key={phase}
                      label={`Tempo medio â€” ${phase}`}
                      value={`${data.count > 0 ? ((data.sum / data.count) * 1000).toFixed(0) : "â€”"}ms`}
                      sub={`${data.count} campioni`}
                      icon={<BarChart3 className="w-4 h-4" />}
                    />
                  ))}
              </div>

              {/* Volume per domain */}
              {Object.keys(wendyMetrics.volumeByDomain ?? {}).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Volume per Dominio
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={Object.entries(wendyMetrics.volumeByDomain).map(
                          ([domain, count]) => ({
                            domain,
                            count,
                          }),
                        )}
                        layout="vertical"
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                        />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 11 }}
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="domain"
                          tick={{ fontSize: 11 }}
                          width={100}
                        />
                        <Tooltip formatter={(v: number) => [v, "Richieste"]} />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {Object.keys(wendyMetrics.volumeByDomain).map(
                            (_, i) => (
                              <Cell
                                key={i}
                                fill={`hsl(${140 + i * 30}, 60%, ${50 + i * 5}%)`}
                              />
                            ),
                          )}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Latency per phase */}
              {Object.keys(wendyMetrics.latencyByPhase ?? {}).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Tempi Medi per Fase (ms)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={Object.entries(wendyMetrics.latencyByPhase).map(
                          ([phase, data]) => ({
                            phase,
                            avgMs:
                              data.count > 0
                                ? Math.round((data.sum / data.count) * 1000)
                                : 0,
                          }),
                        )}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                        />
                        <XAxis dataKey="phase" tick={{ fontSize: 11 }} />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          allowDecimals={false}
                          unit="ms"
                        />
                        <Tooltip
                          formatter={(v: number) => [`${v}ms`, "Media"]}
                        />
                        <Bar dataKey="avgMs" radius={[4, 4, 0, 0]}>
                          {Object.keys(wendyMetrics.latencyByPhase).map(
                            (_, i) => (
                              <Cell
                                key={i}
                                fill={`hsl(${260 + i * 40}, 65%, ${55 + i * 5}%)`}
                              />
                            ),
                          )}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {wendyMetrics.rag && <RagCoreSection rag={wendyMetrics.rag} />}
            </section>
          )}
          {techDebtMetrics && <TechDebtSection techDebt={techDebtMetrics} />}
          {techDebtUnavailable && (
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Activity className="w-5 h-5" />
                      Tech Debt
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Snapshot non disponibile in questo momento. Le metriche
                      business restano utilizzabili.
                    </p>
                  </div>
                  <HealthBadge state="warning" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AdminAuthGate>
  );
}
