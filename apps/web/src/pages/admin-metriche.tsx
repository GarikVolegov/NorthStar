import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Users, Crown, TrendingUp, BarChart3, FlaskConical, Loader2 } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";

const BASE = import.meta.env.BASE_URL || "/";

interface Metrics {
  users: { total: number; premium: number; new30d: number; new7d: number; conversionRate: number };
  tests: { total: number; withUser: number; last30d: number; completionRate: string };
  topSectors: Array<{ sectorId: number; name: string; count: number }>;
  dailySignups: Array<{ day: string; count: number }>;
  revenue: { mrr: number; total: number; currency: string } | null;
  generatedAt: string;
}

function KpiCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
          <span className="text-muted-foreground/60">{icon}</span>
        </div>
        <p className="text-3xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function AdminMetriche() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem("northstar_admin_key") ?? "");
  const [keyInput, setKeyInput] = useState("");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchMetrics = useCallback(async (key: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}api/admin/metrics`, {
        headers: { "x-admin-key": key },
      });
      if (res.status === 401) { setError("Chiave admin non valida."); return; }
      if (!res.ok) throw new Error("Errore server");
      const data = await res.json();
      setMetrics(data);
      setLastRefresh(new Date());
    } catch (e) {
      setError("Impossibile caricare le metriche.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (adminKey) fetchMetrics(adminKey);
  }, [adminKey, fetchMetrics]);

  useEffect(() => {
    if (!adminKey) return;
    const interval = setInterval(() => fetchMetrics(adminKey), 60_000);
    return () => clearInterval(interval);
  }, [adminKey, fetchMetrics]);

  function handleKeySubmit() {
    const k = keyInput.trim();
    if (!k) return;
    localStorage.setItem("northstar_admin_key", k);
    setAdminKey(k);
  }

  if (!adminKey) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-center">Admin — NorthStar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="password"
              placeholder="Chiave admin"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleKeySubmit()}
            />
            <Button className="w-full" onClick={handleKeySubmit}>Accedi</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">NorthStar — Metriche Business</h1>
            {lastRefresh && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Aggiornato il: {lastRefresh.toLocaleString("it-IT")}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchMetrics(adminKey)} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="ml-2">Aggiorna</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { localStorage.removeItem("northstar_admin_key"); setAdminKey(""); }}>
              Esci
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {loading && !metrics ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : metrics ? (
          <>
            {/* KPI Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Utenti Totali" value={metrics.users.total.toLocaleString("it-IT")} sub={`+${metrics.users.new7d} ultimi 7gg`} icon={<Users className="w-4 h-4" />} />
              <KpiCard label="Utenti Premium" value={metrics.users.premium.toLocaleString("it-IT")} sub={`${metrics.users.conversionRate}% conversione`} icon={<Crown className="w-4 h-4" />} />
              <KpiCard label="Nuovi (30gg)" value={metrics.users.new30d.toLocaleString("it-IT")} icon={<TrendingUp className="w-4 h-4" />} />
              <KpiCard
                label="MRR"
                value={metrics.revenue ? `€${metrics.revenue.mrr.toLocaleString("it-IT")}` : "N/D"}
                sub={metrics.revenue ? `ARR ~€${metrics.revenue.total.toLocaleString("it-IT")}` : "Stripe non configurato"}
                icon={<Badge variant="outline" className="text-xs">€</Badge>}
              />
              <KpiCard label="Test Completati" value={metrics.tests.total.toLocaleString("it-IT")} sub={`${metrics.tests.last30d} ultimi 30gg`} icon={<FlaskConical className="w-4 h-4" />} />
              <KpiCard label="Test con Account" value={metrics.tests.withUser.toLocaleString("it-IT")} sub={`${metrics.tests.completionRate}% con account`} icon={<BarChart3 className="w-4 h-4" />} />
              <KpiCard label="Conversione %" value={`${metrics.users.conversionRate}%`} sub="free → premium" icon={<TrendingUp className="w-4 h-4" />} />
              <KpiCard label="Nuovi (7gg)" value={metrics.users.new7d.toLocaleString("it-IT")} icon={<Users className="w-4 h-4" />} />
            </div>

            {/* Daily Signups Chart */}
            {metrics.dailySignups.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Iscrizioni ultimi 30 giorni</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={metrics.dailySignups}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(d: string) => d.slice(5)}
                      />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        labelFormatter={(d: string) => new Date(d).toLocaleDateString("it-IT")}
                        formatter={(v: number) => [v, "Iscrizioni"]}
                      />
                      <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Top Sectors */}
            {metrics.topSectors.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top Settori scelti</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={metrics.topSectors} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={160} />
                      <Tooltip formatter={(v: number) => [v, "Scelte"]} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {metrics.topSectors.map((_, i) => (
                          <Cell key={i} fill={`hsl(${220 + i * 20}, 70%, ${55 + i * 3}%)`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
