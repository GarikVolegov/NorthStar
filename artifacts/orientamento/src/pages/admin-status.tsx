import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw, Database, Bot, Clock, Loader2,
  CheckCircle2, XCircle, AlertTriangle, Wifi, Sparkles,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL || "/";
const REFRESH_INTERVAL_MS = 15_000;

interface ServiceStatus {
  status: string;
  latencyMs: number;
  error?: string;
  configured?: boolean;
}

interface HealthData {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  uptimeSeconds: number;
  services: {
    database: ServiceStatus;
    aiAgents: ServiceStatus;
    openai: ServiceStatus;
  };
  env: {
    configured: number;
    total: number;
    missingRequired: string[];
    missingOptional: string[];
  };
}

function statusColor(s: string) {
  if (s === "ok") return "text-emerald-600 dark:text-emerald-400";
  if (s === "degraded" || s === "not_configured") return "text-amber-500 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

function statusBg(s: string) {
  if (s === "ok") return "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800";
  if (s === "degraded" || s === "not_configured") return "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800";
  return "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800";
}

function StatusIcon({ status, size = 20 }: { status: string; size?: number }) {
  if (status === "ok") return <CheckCircle2 size={size} className="text-emerald-500" />;
  if (status === "not_configured") return <AlertTriangle size={size} className="text-amber-500" />;
  if (status === "degraded") return <AlertTriangle size={size} className="text-amber-500" />;
  if (status === "timeout" || status === "unreachable") return <Wifi size={size} className="text-orange-500" />;
  return <XCircle size={size} className="text-red-500" />;
}

function ServiceCard({
  title,
  icon,
  service,
  note,
}: {
  title: string;
  icon: React.ReactNode;
  service: ServiceStatus;
  note?: string;
}) {
  const showLatency = service.status !== "not_configured" && service.latencyMs > 0;
  return (
    <Card className={`border ${statusBg(service.status)}`}>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 font-medium text-sm">
            <span className="text-muted-foreground">{icon}</span>
            {title}
          </div>
          <StatusIcon status={service.status} />
        </div>
        <div className="flex items-center justify-between">
          <Badge
            variant="outline"
            className={`text-xs font-mono capitalize ${statusColor(service.status)}`}
          >
            {service.status.replace("_", " ")}
          </Badge>
          {showLatency && (
            <span className="text-xs text-muted-foreground font-mono">{service.latencyMs} ms</span>
          )}
        </div>
        {service.error && (
          <p className="mt-2 text-xs text-muted-foreground break-all leading-relaxed">{service.error}</p>
        )}
        {note && !service.error && (
          <p className="mt-2 text-xs text-muted-foreground">{note}</p>
        )}
      </CardContent>
    </Card>
  );
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function AdminStatus() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem("northstar_admin_key") ?? "");
  const [keyInput, setKeyInput] = useState("");
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_MS / 1000);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/health`);
      if (res.ok || res.status === 503) {
        setData(await res.json());
        setLastRefresh(new Date());
        setCountdown(REFRESH_INTERVAL_MS / 1000);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!adminKey) return;
    fetchHealth();
    const interval = setInterval(fetchHealth, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [adminKey, fetchHealth]);

  useEffect(() => {
    if (!adminKey || !lastRefresh) return;
    const tick = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(tick);
  }, [adminKey, lastRefresh]);

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
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">NorthStar — Status</h1>
            {lastRefresh && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Aggiornato: {lastRefresh.toLocaleTimeString("it-IT")} · prossimo refresh in {countdown}s
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={fetchHealth} disabled={loading}>
            {loading
              ? <Loader2 size={14} className="animate-spin mr-1" />
              : <RefreshCw size={14} className="mr-1" />}
            Aggiorna
          </Button>
        </div>

        {/* Overall status banner */}
        {!data && loading && <Skeleton className="h-20 w-full rounded-xl" />}
        {data && (
          <Card className={`border-2 ${statusBg(data.status)}`}>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <StatusIcon status={data.status} size={28} />
                <div>
                  <p className={`text-lg font-bold ${statusColor(data.status)}`}>
                    {data.status === "ok"
                      ? "Tutto operativo"
                      : data.status === "degraded"
                      ? "Funzionalità ridotte"
                      : "Errore critico"}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock size={11} />
                    Uptime: {formatUptime(data.uptimeSeconds)} · {new Date(data.timestamp).toLocaleString("it-IT")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Services */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Servizi</h2>
          {!data && loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
          ) : data ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <ServiceCard
                title="Database"
                icon={<Database size={15} />}
                service={data.services.database}
              />
              <ServiceCard
                title="AI Agents (Python)"
                icon={<Bot size={15} />}
                service={data.services.aiAgents}
              />
              <ServiceCard
                title="OpenAI Integration"
                icon={<Sparkles size={15} />}
                service={data.services.openai}
                note={
                  data.services.openai.configured === false
                    ? "Attiva l'integrazione OpenAI su Replit per abilitare Wiki, Roadmap e Growth Research."
                    : undefined
                }
              />
            </div>
          ) : null}
        </div>

        {/* Env vars */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Variabili d'ambiente
          </h2>
          {!data && loading ? (
            <Skeleton className="h-32 rounded-xl" />
          ) : data ? (
            <Card>
              <CardContent className="pt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Configurate</span>
                  <span className="font-mono font-bold">
                    {data.env.configured} / {data.env.total}
                  </span>
                </div>

                {data.env.missingRequired.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-red-500 flex items-center gap-1">
                      <XCircle size={12} /> Obbligatorie mancanti
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {data.env.missingRequired.map((k) => (
                        <Badge key={k} variant="destructive" className="font-mono text-xs">{k}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {data.env.missingOptional.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-amber-500 flex items-center gap-1">
                      <AlertTriangle size={12} /> Opzionali non impostate
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {data.env.missingOptional.map((k) => (
                        <Badge
                          key={k}
                          variant="outline"
                          className="font-mono text-xs text-amber-600 border-amber-300"
                        >
                          {k}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {data.env.missingRequired.length === 0 && data.env.missingOptional.length === 0 && (
                  <p className="text-sm text-emerald-600 flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> Tutte le variabili configurate
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Links */}
        <div className="flex gap-2 text-xs text-muted-foreground pt-2">
          <a href="/admin/metriche" className="hover:underline">Metriche business</a>
          <span>·</span>
          <a href="/admin/review" className="hover:underline">Review contenuti</a>
          <span>·</span>
          <a href="/admin/messaggi" className="hover:underline">Messaggi</a>
        </div>

      </div>
    </div>
  );
}
