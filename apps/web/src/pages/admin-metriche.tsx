import { AdminAuthGate } from "@/components/AdminAuthGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RagCoreSection } from "@/features/admin-metrics/RagCoreSection";
import { HealthBadge, KpiCard } from "@/features/admin-metrics/shared";
import { TechDebtSection } from "@/features/admin-metrics/TechDebtSection";
import type {
  Metrics,
  TechDebtMetrics,
  WendyMetrics,
} from "@/features/admin-metrics/types";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { getJson } from "@/lib/apiClient";
import {
  Activity,
  BarChart3,
  Brain,
  Crown,
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

export { RagCoreSection, TechDebtSection };

function BusinessKpis({ metrics }: { metrics: Metrics }) {
  return (
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
            ? `EUR ${metrics.revenue.mrr.toLocaleString("it-IT")}`
            : "N/D"
        }
        sub={
          metrics.revenue
            ? `ARR ~EUR ${metrics.revenue.total.toLocaleString("it-IT")}`
            : "Stripe non configurato"
        }
        icon={<Badge variant="outline" className="text-xs">EUR</Badge>}
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
        sub="free -> premium"
        icon={<TrendingUp className="w-4 h-4" />}
      />
      <KpiCard
        label="Nuovi (7gg)"
        value={metrics.users.new7d.toLocaleString("it-IT")}
        icon={<Users className="w-4 h-4" />}
      />
    </div>
  );
}

function DailySignupsChart({ metrics }: { metrics: Metrics }) {
  if (metrics.dailySignups.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Iscrizioni ultimi 30 giorni</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={metrics.dailySignups}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(day: string) => day.slice(5)} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              labelFormatter={(day: string) => new Date(day).toLocaleDateString("it-IT")}
              formatter={(value: number) => [value, "Iscrizioni"]}
            />
            <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function TopSectorsChart({ metrics }: { metrics: Metrics }) {
  if (metrics.topSectors.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top Aree scelte</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={metrics.topSectors} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={160} />
            <Tooltip formatter={(value: number) => [value, "Scelte"]} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {metrics.topSectors.map((_, index) => (
                <Cell key={index} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function WendyMetricsSection({ metrics }: { metrics: WendyMetrics }) {
  const domains = Object.entries(metrics.volumeByDomain ?? {});
  const latency = Object.entries(metrics.latencyByPhase ?? {});

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Brain className="w-5 h-5" />
        Wendy AI - Metriche
      </h2>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Richieste Totali"
          value={metrics.totalRequests.toLocaleString("it-IT")}
          icon={<MessageSquare className="w-4 h-4" />}
        />
        <KpiCard
          label="Rewrite Rate"
          value={`${(metrics.rewriteRate * 100).toFixed(1)}%`}
          sub={`${metrics.totalRewrites} rewrites su ${metrics.totalRequests} richieste`}
          icon={<GitBranch className="w-4 h-4" />}
        />
        {latency.slice(0, 2).map(([phase, data]) => (
          <KpiCard
            key={phase}
            label={`Tempo medio - ${phase}`}
            value={`${data.count > 0 ? ((data.sum / data.count) * 1000).toFixed(0) : "-"}ms`}
            sub={`${data.count} campioni`}
            icon={<BarChart3 className="w-4 h-4" />}
          />
        ))}
      </div>

      {domains.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Volume per Dominio</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={domains.map(([domain, count]) => ({ domain, count }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="domain" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(value: number) => [value, "Richieste"]} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {domains.map((_, index) => (
                    <Cell key={index} fill={`hsl(${140 + index * 30}, 60%, ${50 + index * 5}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {latency.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tempi Medi per Fase (ms)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={latency.map(([phase, data]) => ({
                phase,
                avgMs: data.count > 0 ? Math.round((data.sum / data.count) * 1000) : 0,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="phase" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} unit="ms" />
                <Tooltip formatter={(value: number) => [`${value}ms`, "Media"]} />
                <Bar dataKey="avgMs" radius={[4, 4, 0, 0]}>
                  {latency.map((_, index) => (
                    <Cell key={index} fill={`hsl(${260 + index * 40}, 65%, ${55 + index * 5}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {metrics.rag && <RagCoreSection rag={metrics.rag} />}
    </section>
  );
}

export default function AdminMetriche() {
  const { key } = useAdminAuth();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [wendyMetrics, setWendyMetrics] = useState<WendyMetrics | null>(null);
  const [techDebtMetrics, setTechDebtMetrics] = useState<TechDebtMetrics | null>(null);
  const [techDebtUnavailable, setTechDebtUnavailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchMetrics = useCallback(async (adminKey: string) => {
    setLoading(true);
    setError(null);
    try {
      const auth = { headers: { Authorization: `Bearer ${adminKey}` } };
      const [metricsRes, wendyRes] = await Promise.all([
        getJson<Metrics>(`${BASE}api/admin/metrics`, auth),
        getJson<WendyMetrics>(`${BASE}api/admin/wendy-metrics`, auth),
      ]);
      setMetrics(metricsRes);
      setWendyMetrics(wendyRes);
      setTechDebtUnavailable(false);
      getJson<TechDebtMetrics>(`${BASE}api/admin/tech-debt-metrics`, auth)
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
    <AdminAuthGate title="Metriche Business" description="Utenti, test, conversioni e revenue">
      <div className="min-h-screen bg-muted/20 p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold">NorthStar - Metriche Business</h1>
              {lastRefresh && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Aggiornato il: {lastRefresh.toLocaleString("it-IT")}
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchMetrics(key)} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="ml-2">Aggiorna</span>
            </Button>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {loading && !metrics ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-28 rounded-2xl" />
              ))}
            </div>
          ) : metrics ? (
            <>
              <BusinessKpis metrics={metrics} />
              <DailySignupsChart metrics={metrics} />
              <TopSectorsChart metrics={metrics} />
            </>
          ) : null}

          {wendyMetrics && <WendyMetricsSection metrics={wendyMetrics} />}
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
                      Snapshot non disponibile in questo momento. Le metriche business restano utilizzabili.
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
