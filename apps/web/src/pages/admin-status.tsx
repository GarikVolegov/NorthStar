import { AdminAuthGate } from "@/components/AdminAuthGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { getJson } from "@/lib/apiClient";
import {
  AlertTriangle,
  Bell,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Database,
  ExternalLink,
  Globe,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Sparkles,
  Wifi,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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
  if (s === "ok") return "text-success";
  if (s === "degraded" || s === "not_configured") return "text-warning";
  return "text-danger";
}

function statusBg(s: string) {
  if (s === "ok") return "bg-success-surface border-success-muted";
  if (s === "degraded" || s === "not_configured")
    return "bg-warning-surface border-warning-muted";
  return "bg-danger-surface border-danger-muted";
}

function StatusIcon({ status, size = 20 }: { status: string; size?: number }) {
  if (status === "ok")
    return <CheckCircle2 size={size} className="text-success" />;
  if (status === "not_configured")
    return <AlertTriangle size={size} className="text-warning" />;
  if (status === "degraded")
    return <AlertTriangle size={size} className="text-warning" />;
  if (status === "timeout" || status === "unreachable")
    return <Wifi size={size} className="text-warning" />;
  return <XCircle size={size} className="text-danger" />;
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
  const showLatency =
    service.status !== "not_configured" && service.latencyMs > 0;
  return (
    <Card className={`border ${statusBg(service.status)}`}>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 font-medium text-sm">
            <span className="text-muted-foreground">{icon}</span> {title}
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
            <span className="text-xs text-muted-foreground font-mono">
              {service.latencyMs} ms
            </span>
          )}
        </div>
        {service.error && (
          <p className="mt-2 text-xs text-muted-foreground break-all leading-relaxed">
            {service.error}
          </p>
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

// Integration setup guides
interface IntegrationGuide {
  vars: string[];
  icon: React.ReactNode;
  name: string;
  what: string;
  how: string;
  docsUrl: string;
  docsLabel: string;
}

const INTEGRATION_GUIDES: IntegrationGuide[] = [
  {
    vars: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    icon: <CreditCard size={16} />,
    name: "Stripe",
    what: "Abilita i pagamenti e gli abbonamenti premium (checkout, gestione piani, webhook).",
    how: "1. Crea un account su stripe.com -> Dashboard -> Developers -> API Keys -> copia la Secret key.\n2. Per i webhook: Stripe CLI o dashboard -> Webhooks -> aggiungi l'endpoint `/api/stripe/webhook`.",
    docsUrl: "https://stripe.com/docs/keys",
    docsLabel: "Docs Stripe API Keys",
  },
  {
    vars: ["GNEWS_API_KEY"],
    icon: <Globe size={16} />,
    name: "GNews",
    what: "Abilita il feed di notizie aggiornate relative al settore dell'utente.",
    how: "1. Vai su gnews.io -> crea un account gratuito -> copia la tua API Key dal dashboard.",
    docsUrl: "https://gnews.io/docs/v4",
    docsLabel: "Docs GNews API",
  },
  {
    vars: ["TAVILY_API_KEY"],
    icon: <Search size={16} />,
    name: "Tavily",
    what: "Abilita la ricerca dinamica di articoli di crescita personale tramite AI (Growth Research Scheduler).",
    how: "1. Vai su tavily.com -> crea un account -> copia la API Key dalla dashboard del tuo profilo.",
    docsUrl: "https://tavily.com",
    docsLabel: "Tavily Dashboard",
  },
  {
    vars: ["RESEND_API_KEY"],
    icon: <Mail size={16} />,
    name: "Resend",
    what: "Abilita le email transazionali: verifica account, reset password, digest settimanale.",
    how: "1. Vai su resend.com -> crea un account -> API Keys -> crea una nuova chiave -> aggiungila come segreto.",
    docsUrl: "https://resend.com/docs/introduction",
    docsLabel: "Docs Resend",
  },
  {
    vars: ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_EMAIL"],
    icon: <Bell size={16} />,
    name: "Web Push (VAPID)",
    what: "Abilita le notifiche push del browser per promemoria, scadenze obiettivi e aggiornamenti.",
    how: "Genera le chiavi VAPID con il comando:\n`npx web-push generate-vapid-keys`\nCopia VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY. VAPID_EMAIL è la tua email di contatto (es. admin@northstar.app).",
    docsUrl: "https://developer.mozilla.org/en-US/docs/Web/API/Push_API",
    docsLabel: "Web Push API MDN",
  },
  {
    vars: ["GOOGLE_CLIENT_ID"],
    icon: <KeyRound size={16} />,
    name: "Google OAuth",
    what: "Abilita il login con Google per gli utenti (flusso OAuth2).",
    how: "1. Vai su console.cloud.google.com -> API & Services -> Credentials -> Create OAuth 2.0 Client ID.\n2. Tipo: Web application. Aggiungi i redirect URI autorizzati (es. https://tuodominio.repl.co/api/auth/google/callback).",
    docsUrl: "https://developers.google.com/identity/protocols/oauth2",
    docsLabel: "Docs Google OAuth2",
  },
];

function IntegrationGuideCard({
  guide,
  isMissing,
}: {
  guide: IntegrationGuide;
  isMissing: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card
      className={`border transition-colors ${isMissing ? "border-warning-muted" : "border-success-muted"}`}
    >
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isMissing ? "bg-warning-surface text-warning" : "bg-success-surface text-success"}`}
            >
              {guide.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{guide.name}</span>
                {isMissing ? (
                  <Badge
                    variant="outline"
                    className="text-xs text-warning border-warning-muted"
                  >
                    Non configurato
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-xs text-success border-success-muted"
                  >
                    Attivo
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {guide.vars.join(", ")}
              </p>
            </div>
          </div>
          {isMissing && (
            <button
              onClick={() => setOpen((o) => !o)}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
          {!isMissing && (
            <CheckCircle2 size={16} className="text-success shrink-0" />
          )}
        </div>

        {isMissing && open && (
          <div className="mt-4 space-y-3 border-t pt-3">
            <div>
              <p className="text-xs font-semibold text-foreground mb-1">
                A cosa serve
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {guide.what}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground mb-1">
                Come configurarla
              </p>
              <pre className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap bg-muted rounded-lg p-3 font-mono">
                {guide.how}
              </pre>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={guide.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ExternalLink size={11} /> {guide.docsLabel}
              </a>
              <span className="text-muted-foreground text-xs">-</span>
              <a
                href="https://docs.replit.com/replit-workspace/storing-sensitive-information-environment-variables"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ExternalLink size={11} /> Come aggiungere su Replit
              </a>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminStatus() {
  const { key } = useAdminAuth();
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_MS / 1000);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const health = await getJson<HealthData>(`${BASE}api/health`, {
        okStatuses: [503],
      });
      setData(health);
      setLastRefresh(new Date());
      setCountdown(REFRESH_INTERVAL_MS / 1000);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!key) return;
    fetchHealth();
    const interval = setInterval(fetchHealth, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [key, fetchHealth]);

  useEffect(() => {
    if (!key || !lastRefresh) return;
    const tick = setInterval(
      () => setCountdown((c) => (c > 0 ? c - 1 : 0)),
      1000,
    );
    return () => clearInterval(tick);
  }, [key, lastRefresh]);

  // Determine which integrations are missing
  const missingVars = new Set(data?.env.missingOptional ?? []);
  const integrationStatus = INTEGRATION_GUIDES.map((g) => ({
    guide: g,
    isMissing: g.vars.some((v) => missingVars.has(v)),
  }));
  const missingCount = integrationStatus.filter((i) => i.isMissing).length;
  const configuredCount = integrationStatus.filter((i) => !i.isMissing).length;

  return (
    <AdminAuthGate
      title="Status & Setup"
      description="Stato servizi, env vars e guide integrazioni"
    >
      <div className="min-h-screen bg-muted/20 p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold">
                NorthStar - Status & Setup
              </h1>
              {lastRefresh && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Aggiornato: {lastRefresh.toLocaleTimeString("it-IT")} -
                  prossimo refresh in {countdown}s
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchHealth}
              disabled={loading}
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin mr-1" />
              ) : (
                <RefreshCw size={14} className="mr-1" />
              )}
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
                    <p
                      className={`text-lg font-bold ${statusColor(data.status)}`}
                    >
                      {data.status === "ok"
                        ? "Tutto operativo"
                        : data.status === "degraded"
                          ? "Funzionalità ridotte"
                          : "Errore critico"}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock size={11} />
                      Uptime: {formatUptime(data.uptimeSeconds)} -{" "}
                      {new Date(data.timestamp).toLocaleString("it-IT")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Services */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Servizi Core
            </h2>
            {!data && loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
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
                  {...(data.services.openai.configured === false
                    ? {
                        note: "Attiva l'integrazione OpenAI su Replit per abilitare Wiki, Roadmap e Growth.",
                      }
                    : {})}
                />
              </div>
            ) : null}
          </div>

          {/* Setup wizard - integrations */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Setup Wizard - Integrazioni Opzionali
              </h2>
              {data && (
                <div className="flex items-center gap-2">
                  <Badge className="bg-success-surface text-success text-xs">
                    {configuredCount} attive
                  </Badge>
                  {missingCount > 0 && (
                    <Badge className="bg-warning-surface text-warning text-xs">
                      {missingCount} mancanti
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {!data && loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : data ? (
              <div className="space-y-2">
                {integrationStatus
                  .sort((a, b) => (a.isMissing ? 0 : 1) - (b.isMissing ? 0 : 1))
                  .map(({ guide, isMissing }) => (
                    <IntegrationGuideCard
                      key={guide.name}
                      guide={guide}
                      isMissing={isMissing}
                    />
                  ))}
              </div>
            ) : null}
          </div>

          {/* Env vars summary */}
          {data && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Variabili d'ambiente
              </h2>
              <Card>
                <CardContent className="pt-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Configurate
                    </span>
                    <span className="font-mono font-bold">
                      {data.env.configured} / {data.env.total}
                    </span>
                  </div>
                  {data.env.missingRequired.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-danger flex items-center gap-1">
                        <XCircle size={12} /> Obbligatorie mancanti
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {data.env.missingRequired.map((k) => (
                          <Badge
                            key={k}
                            variant="destructive"
                            className="font-mono text-xs"
                          >
                            {k}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.env.missingRequired.length === 0 &&
                    data.env.missingOptional.length === 0 && (
                      <p className="text-sm text-success flex items-center gap-1.5">
                        <CheckCircle2 size={14} /> Tutte le variabili
                        configurate
                      </p>
                    )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Links */}
          <div className="flex gap-2 text-xs text-muted-foreground pt-2 flex-wrap">
            <a href="/admin" className="hover:underline">
              Torna ad Admin Home
            </a>
            <span>-</span>
            <a href="/admin/metriche" className="hover:underline">
              Metriche business
            </a>
            <span>-</span>
            <a href="/admin/agenti" className="hover:underline">
              Agent Health
            </a>
            <span>-</span>
            <a href="/admin/cataloghi" className="hover:underline">
              Cataloghi
            </a>
          </div>
        </div>
      </div>
    </AdminAuthGate>
  );
}
