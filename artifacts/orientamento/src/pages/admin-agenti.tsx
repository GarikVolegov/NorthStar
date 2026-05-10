import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw, Bot, AlertTriangle, CheckCircle2, XCircle, Clock,
  Loader2, TrendingDown, TrendingUp, Activity,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

const BASE = import.meta.env.BASE_URL || "/";

interface AgentStat {
  agentName: string;
  successRate30d: number;
  successRate7d: number;
  totalCalls30d: number;
  totalCalls7d: number;
  errorCount30d: number;
  errorCount7d: number;
  avgDurationMs: number | null;
  status: "healthy" | "degraded" | "critical";
  lastErrors: Array<{ taskType: string; error: string | null; createdAt: string; durationMs: number | null }>;
}

interface DailyRow {
  day: string;
  agentName: string;
  total: number;
  errors: number;
}

interface HealthData {
  agents: AgentStat[];
  daily: DailyRow[];
  generatedAt: string;
}

function statusBadge(status: AgentStat["status"]) {
  if (status === "healthy") return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Sano</Badge>;
  if (status === "degraded") return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Degradato</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-red-200">Critico</Badge>;
}

function rateColor(rate: number) {
  if (rate >= 95) return "text-emerald-600";
  if (rate >= 80) return "text-amber-500";
  return "text-red-500";
}

function AgentCard({ agent }: { agent: AgentStat }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="border">
      <CardContent className="pt-5">
        <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-muted-foreground" />
            <span className="font-semibold font-mono text-sm">{agent.agentName}</span>
            {statusBadge(agent.status)}
          </div>
          <span className="text-xs text-muted-foreground">{agent.totalCalls30d} chiamate / 30g</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div className="text-center p-2 rounded-lg bg-muted/40">
            <p className={`text-xl font-bold ${rateColor(agent.successRate30d)}`}>{agent.successRate30d}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">Successo 30g</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/40">
            <p className={`text-xl font-bold ${rateColor(agent.successRate7d)}`}>{agent.successRate7d}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">Successo 7g</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/40">
            <p className="text-xl font-bold text-red-500">{agent.errorCount30d}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Errori 30g</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/40">
            <p className="text-xl font-bold">
              {agent.avgDurationMs ? `${agent.avgDurationMs}ms` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Latenza media</p>
          </div>
        </div>

        {agent.lastErrors.length > 0 && (
          <div>
            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
            >
              <AlertTriangle size={11} className="text-amber-500" />
              {agent.lastErrors.length} errori recenti — {expanded ? "nascondi" : "mostra"}
            </button>
            {expanded && (
              <div className="space-y-1.5">
                {agent.lastErrors.map((e, i) => (
                  <div key={i} className="text-xs bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 rounded-lg p-2">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono font-medium">{e.taskType}</span>
                      <span className="text-muted-foreground">{new Date(e.createdAt).toLocaleString("it-IT")}</span>
                    </div>
                    <p className="text-red-600 dark:text-red-400 break-all">{e.error ?? "Errore sconosciuto"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {agent.lastErrors.length === 0 && (
          <p className="text-xs text-emerald-600 flex items-center gap-1">
            <CheckCircle2 size={12} /> Nessun errore negli ultimi 30 giorni
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminAgenti() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem("northstar_admin_key") ?? "");
  const [keyInput, setKeyInput] = useState("");
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async (key: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}api/admin/agent-health`, {
        headers: { "x-admin-key": key },
      });
      if (res.status === 401) { setError("Chiave admin non valida."); return; }
      if (!res.ok) throw new Error("Errore server");
      setData(await res.json());
      setLastRefresh(new Date());
    } catch {
      setError("Impossibile caricare i dati.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (adminKey) fetchData(adminKey);
  }, [adminKey, fetchData]);

  if (!adminKey) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader><CardTitle className="text-center">Admin — NorthStar</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input type="password" placeholder="Chiave admin" value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  localStorage.setItem("northstar_admin_key", keyInput.trim());
                  setAdminKey(keyInput.trim());
                }
              }} />
            <Button className="w-full" onClick={() => {
              localStorage.setItem("northstar_admin_key", keyInput.trim());
              setAdminKey(keyInput.trim());
            }}>Accedi</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Build chart data from daily rows
  const agentNames = data ? [...new Set(data.daily.map((d) => d.agentName))] : [];
  const dayMap: Record<string, Record<string, number>> = {};
  (data?.daily ?? []).forEach((row) => {
    if (!dayMap[row.day]) dayMap[row.day] = {};
    dayMap[row.day][row.agentName] = Number(row.total);
  });
  const chartData = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([day, agents]) => ({ day: day.slice(5), ...agents }));

  const COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899"];

  const healthy = data?.agents.filter((a) => a.status === "healthy").length ?? 0;
  const degraded = data?.agents.filter((a) => a.status === "degraded").length ?? 0;
  const critical = data?.agents.filter((a) => a.status === "critical").length ?? 0;

  return (
    <div className="min-h-screen bg-muted/20 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity size={22} className="text-primary" />
              Agent Health Dashboard
            </h1>
            {lastRefresh && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Aggiornato: {lastRefresh.toLocaleTimeString("it-IT")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-emerald-100 text-emerald-700">{healthy} sani</Badge>
            <Badge className="bg-amber-100 text-amber-700">{degraded} degradati</Badge>
            <Badge className="bg-red-100 text-red-700">{critical} critici</Badge>
            <Button variant="outline" size="sm" onClick={() => fetchData(adminKey)} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : <RefreshCw size={14} className="mr-1" />}
              Aggiorna
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-700 text-sm">{error}</div>
        )}

        {/* Summary bar */}
        {data && data.agents.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-emerald-600">{healthy}</p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                <TrendingUp size={11} /> Agenti sani
              </p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-amber-500">{degraded}</p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                <AlertTriangle size={11} /> Degradati
              </p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-red-500">{critical}</p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                <TrendingDown size={11} /> Critici
              </p>
            </CardContent></Card>
          </div>
        )}

        {/* Chart */}
        {chartData.length > 0 && agentNames.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Chiamate per agente — ultimi 14 giorni
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {agentNames.slice(0, 7).map((name, i) => (
                    <Bar key={name} dataKey={name} stackId="a" fill={COLORS[i % COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Agent cards */}
        {loading && !data && (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        )}

        {data && data.agents.length === 0 && (
          <Card>
            <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
              <Bot size={32} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nessun dato agente negli ultimi 30 giorni</p>
              <p className="text-sm mt-1">I log verranno mostrati qui dopo le prime esecuzioni.</p>
            </CardContent>
          </Card>
        )}

        {data && (
          <div className="grid gap-4">
            {data.agents.map((agent) => (
              <AgentCard key={agent.agentName} agent={agent} />
            ))}
          </div>
        )}

        <div className="flex gap-2 text-xs text-muted-foreground pt-2">
          <a href="/admin" className="hover:underline">← Admin Home</a>
          <span>·</span>
          <a href="/admin/metriche" className="hover:underline">Metriche</a>
          <span>·</span>
          <a href="/admin/cataloghi" className="hover:underline">Cataloghi</a>
        </div>
      </div>
    </div>
  );
}
