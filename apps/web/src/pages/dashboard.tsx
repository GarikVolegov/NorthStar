import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useAgentAnalysis } from "@/hooks/useAgentAnalysis";
import { useDashboardData, type DashboardSession } from "@/hooks/useDashboardData";
import { usePageModule } from "@/hooks/usePageModule";
import { useWendyPageContext } from "@/hooks/useWendyPageContext";
import { apiFetch } from "@/lib/api-fetch";
import { getJson } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { usePageMeta } from "@/lib/seo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  CheckCircle2,
  ChevronRight,
  Compass,
  HelpCircle,
  Lightbulb,
  MapPin,
  MessageSquare,
  Rocket,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect } from "react";
import { Link, useLocation } from "wouter";

import { DashboardObjectivesPathCard } from "@/components/dashboard/DashboardObjectives";
import { DashboardPersonality } from "@/components/dashboard/DashboardPersonality";
import { DashboardWeekTimeline } from "@/components/dashboard/DashboardWeekTimeline";
import { ProactiveInsightCard } from "@/components/wendy/ProactiveInsightCard";
import { useProactiveInsights, type ProactiveInsight } from "@/hooks/useProactiveInsights";

import { AgentLoadingSkeleton } from "@/components/dashboard/AgentLoadingSkeleton";
import type { JourneyId } from "@/components/dashboard/dashboard-sections";
import { JourneyToolsSection } from "@/components/dashboard/JourneyToolsSection";
import { ProfessionCard } from "@/components/dashboard/ProfessionCard";
import { WorkModePanel } from "@/components/dashboard/WorkModePanel";
import { BussolaHome } from "@/features/compass/BussolaHome";

const BASE = import.meta.env.BASE_URL || "/";

type SessionDetail = {
  id: number;
  riasecScores: Record<string, number>;
  primaryTypes: string[];
  spiritScores: Record<string, number>;
  recommendations: Array<{ sectorId: number; sectorName: string; matchScore: number; matchReason: string }>;
  createdAt: string;
};

type LatestSession = {
  sessionId: number;
  recommendations: Array<{ sectorId: number; sectorName: string; matchScore?: number; matchReason?: string }>;
  riasecScores?: Record<string, number>;
  primaryTypes?: string[];
  spiritScores?: Record<string, number>;
  createdAt?: string;
};

const JOURNEY_META: Record<JourneyId, { label: string; Icon: LucideIcon; color: string; bgColor: string; borderColor: string }> = {
  indeciso:    { label: "Indeciso",    Icon: HelpCircle, color: "text-primary", bgColor: "bg-primary/10", borderColor: "border-primary/30" },
  dipendente:  { label: "Dipendente",  Icon: TrendingUp, color: "text-growth",  bgColor: "bg-growth/10",  borderColor: "border-growth/30" },
  autonomo:    { label: "Autonomo",    Icon: Rocket,     color: "text-primary", bgColor: "bg-primary/10", borderColor: "border-primary/30" },
  azienda:     { label: "Azienda",     Icon: Building2,  color: "text-growth",  bgColor: "bg-growth/10",  borderColor: "border-growth/30" },
  investitore: { label: "Investitore", Icon: BarChart3,  color: "text-primary", bgColor: "bg-primary/10", borderColor: "border-primary/30" },
};

// "La tua prossima mossa": l'azione singola, più importante, per ogni percorso.
type MoveCtx = { sessionId: number | null; topSectorId: number | undefined };
const NEXT_MOVE: Record<JourneyId, { Icon: LucideIcon; title: string; desc: string; cta: string; href: (c: MoveCtx) => string }> = {
  indeciso:    { Icon: Compass,       title: "Esplora i settori consigliati", desc: "Scopri le aree più in linea con il tuo profilo RIASEC.",        cta: "Esplora i settori",   href: (c) => (c.sessionId ? `/risultati/${c.sessionId}` : "/settori") },
  dipendente:  { Icon: MessageSquare, title: "Fai un colloquio di prova",     desc: "Allenati con un colloquio AI adattivo e ricevi un feedback.",   cta: "Inizia il colloquio", href: (c) => (c.topSectorId ? `/colloquio/${c.topSectorId}` : "/settori") },
  autonomo:    { Icon: Lightbulb,     title: "Valida la tua idea",            desc: "Metti alla prova la tua idea di business con l'AI.",            cta: "Valida l'idea",       href: () => "/validatore-idea" },
  azienda:     { Icon: Users,         title: "Esplora i profili RIASEC",      desc: "Trova i profili giusti e analizza le competenze richieste.",    cta: "Esplora i profili",   href: () => "/settori" },
  investitore: { Icon: BarChart3,     title: "Analizza il mercato",           desc: "Aree in crescita, trend e segnali emergenti del mercato IT.",   cta: "Apri il mercato",     href: () => "/mercato" },
};

// ── Small presentational helpers (Guided Focus) ─────────────────────────────────

function ProfileRing({ percent, size = 44 }: { percent: number; size?: number }) {
  const r = size / 2 - 4;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, percent) / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--primary)/0.12)" strokeWidth="3.5" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="hsl(var(--primary))" strokeWidth="3.5"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
    </svg>
  );
}

function SectionDivider({ label, sub, action }: { label: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        {label}
        {sub && <span className="ml-1.5 font-normal normal-case tracking-normal text-muted-foreground/70">· {sub}</span>}
      </span>
      {action ?? <div className="h-px flex-1 bg-border" />}
      {action && <div className="h-px w-4 bg-border" />}
    </div>
  );
}

function StatChip({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground">
      <Icon className="w-3.5 h-3.5 text-primary" />
      {children}
    </span>
  );
}

export default function Dashboard() {
  usePageMeta({
    title: "Fondazione NorthStar",
    description: "La tua analisi AI personalizzata: professioni consigliate, percorsi formativi e modalità di lavoro ottimale per il tuo profilo RIASEC.",
  });
  useWendyPageContext({
    page: 'dashboard',
    title: 'Dashboard',
    capabilities: ['navigate', 'create_objective', 'update_objective_progress', 'set_filters'],
    fields: ['objective.text', 'objective.category', 'objective.dueDate'],
    actions: ['Crea obiettivo', 'Aggiorna progresso', 'Mostra prossimi passi'],
  });
  usePageModule({ pageId: "dashboard" });

  const { user, authReady } = useAuth();
  const { isPro } = useSubscription();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (authReady && !user) navigate("/");
  }, [user, authReady, navigate]);

  const journeyType = (user?.journeyType ?? "indeciso") as JourneyId;
  const journeyMeta = JOURNEY_META[journeyType];

  const { data: dashData, isLoading: dashLoading } = useDashboardData();
  const { data: latestSession, isLoading: sessionLoading } = useLatestSession();
  const dashboardSession = dashData?.session ?? null;
  const sessionId = latestSession?.sessionId ?? dashboardSession?.id ?? null;
  const { data: sessionDetail, isLoading: detailLoading } = useSessionDetail(sessionId);

  const latestSessionProfile: DashboardSession | null = latestSession
    ? {
        id: latestSession.sessionId,
        riasecScores: latestSession.riasecScores ?? {},
        primaryTypes: latestSession.primaryTypes ?? [],
        spiritScores: latestSession.spiritScores ?? {},
        recommendations: (latestSession.recommendations ?? []).map((recommendation) => ({
          sectorId: recommendation.sectorId,
          sectorName: recommendation.sectorName,
          matchScore: recommendation.matchScore ?? 0,
        })),
        createdAt: latestSession.createdAt ?? "",
      }
    : null;
  const effectiveSession = (sessionDetail ?? latestSessionProfile ?? dashboardSession) as DashboardSession | null;
  const recommendations = latestSession?.recommendations ?? effectiveSession?.recommendations ?? [];
  const topSectorId = recommendations[0]?.sectorId;
  const topSectors = recommendations.map((r) => ({ sectorName: r.sectorName }));

  const { data: agentData, isLoading: agentLoading, isError: agentError } = useAgentAnalysis({
    sessionId,
    riasecScores: effectiveSession?.riasecScores,
    primaryTypes: effectiveSession?.primaryTypes,
    spiritScores: effectiveSession?.spiritScores,
    topSectors,
    enabled: !!effectiveSession,
  });

  const isPremium = isPro || agentData?.plan === "premium";
  const summary = agentData?.data?.summary;
  const professions = summary?.professions ?? [];
  const workMode = summary?.workMode;

  const { insights, markRead, dismiss } = useProactiveInsights();
  const objectives = dashData?.objectives ?? [];
  const strategicObjectives = objectives.filter((objective) => objective.category !== "idea_validation");
  const objectivesProgress = dashData?.objectivesProgress ?? { done: 0, total: 0, percent: 0 };
  const upcomingEvents = dashData?.upcomingEvents ?? [];

  const queryClient = useQueryClient();

  useEffect(() => {
    if (dashData && strategicObjectives.length === 0 && journeyType) {
      apiFetch(`${BASE}api/objectives/seed`, { method: "POST" })
        .then(() => queryClient.invalidateQueries({ queryKey: ["dashboard-data"] }))
        .catch(() => {});
    }
  }, [dashData, strategicObjectives.length, journeyType]);

  if (!authReady || sessionLoading || dashLoading) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-3xl">
        <div className="flex flex-col items-center gap-3 mb-10">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-32 w-full rounded-3xl mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (!user) return null;

  // La Bussola È la dashboard dell'indeciso (scelta di prodotto): per questo
  // journey rendiamo l'hub guidato dal profilo compass — anche senza test, è la
  // Bussola stessa a guidare verso il test. Gli altri journey tengono la
  // dashboard Guided Focus qui sotto.
  if (journeyType === "indeciso") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <BussolaHome />
      </div>
    );
  }

  if (!sessionId && !sessionLoading && authReady) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-5 border border-primary/20">
          <Bot className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold mb-3 text-foreground">Pannello di controllo</h1>
        <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
          Completa il test di orientamento per sbloccare l'analisi personalizzata e tutti gli strumenti.
        </p>
        <Button asChild size="lg" className="rounded-full">
          <Link href="/test"><Sparkles className="w-4 h-4 mr-2" />Inizia il test gratuito</Link>
        </Button>
        <div className="mt-6">
          <Link href="/percorso">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:gap-2.5 transition-all cursor-pointer">
              <MapPin className="w-4 h-4" /> Oppure scegli il tuo percorso <ChevronRight className="w-4 h-4" />
            </span>
          </Link>
        </div>
      </div>
    );
  }

  // Completamento profilo (4 tappe da 25%).
  const profilePercent = Math.min(100, Math.round(
    (sessionId ? 25 : 0) +
    25 + // journeyType impostato e non "indeciso" (gli indecisi vedono la Bussola sopra)
    (user?.onboardingCompleted ? 25 : 0) +
    (user?.avatarUrl ? 25 : 0)
  ));
  const profileComplete = profilePercent >= 100;

  const confirmedSectorName = effectiveSession?.recommendations?.[0]?.sectorName ?? null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buonasera";
  const firstName = user.name?.split(" ")[0] ?? "";

  const move = NEXT_MOVE[journeyType];
  const moveHref = move.href({ sessionId, topSectorId });
  const hasAnalysis = !!agentData && !agentLoading && (professions.length > 0 || !!workMode);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 md:py-12 space-y-7">

      {/* ── Hero — centrato, calmo ── */}
      <header className="text-center flex flex-col items-center gap-3">
        <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium", journeyMeta.bgColor, journeyMeta.borderColor, journeyMeta.color)}>
          <journeyMeta.Icon className="w-3.5 h-3.5" /> {journeyMeta.label}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{greeting},</p>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground">
            {firstName || "bentornato"}
          </h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-center pt-1">
          {!profileComplete && (
            <Link href="/profilo" className="inline-flex items-center gap-2 rounded-full border bg-card/60 pl-1.5 pr-3 py-1 text-xs font-medium text-muted-foreground hover:border-primary/40 transition-colors cursor-pointer">
              <ProfileRing percent={profilePercent} size={28} />
              <span>Profilo {profilePercent}%</span>
            </Link>
          )}
          {confirmedSectorName && (
            <StatChip icon={MapPin}>{confirmedSectorName}</StatChip>
          )}
          <StatChip icon={CheckCircle2}>{objectivesProgress.done}/{objectivesProgress.total} obiettivi</StatChip>
        </div>
      </header>

      {/* ── La tua prossima mossa ── */}
      <SectionDivider label="La tua prossima mossa" />
      <Link href={moveHref} className="block group">
        <div className="relative overflow-hidden rounded-3xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-6 md:p-7 hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <move.Icon className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-lg text-foreground">{move.title}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{move.desc}</p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:gap-2.5 transition-all shrink-0">
              {move.cta} <ArrowRight className="w-4 h-4" />
            </div>
          </div>
          <div className="sm:hidden mt-4 flex items-center gap-1.5 text-sm font-semibold text-primary">
            {move.cta} <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </Link>

      {/* ── Analisi personalizzata ── */}
      {(agentLoading || detailLoading) && <AgentLoadingSkeleton />}
      {agentError && !agentLoading && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <p className="text-sm text-muted-foreground">Analisi non disponibile. Riprova tra qualche minuto.</p>
        </div>
      )}
      {hasAnalysis && (
        <>
          <SectionDivider
            label="Analisi personalizzata"
            action={sessionId ? (
              <Link href={`/risultati/${sessionId}`} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 whitespace-nowrap cursor-pointer">
                Completa <ArrowRight className="w-3 h-3" />
              </Link>
            ) : undefined}
          />
          {professions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {professions.slice(0, 3).map((p, i) => (
                <ProfessionCard key={`${p.title}-${i}`} p={p} index={i} />
              ))}
            </div>
          )}
          {workMode && <WorkModePanel wm={workMode} isPremium={isPremium} />}
        </>
      )}

      {/* ── I tuoi strumenti ── */}
      <SectionDivider label="I tuoi strumenti" sub={journeyMeta.label} />
      <JourneyToolsSection
        journeyType={journeyType}
        {...(topSectorId !== undefined ? { sectorId: topSectorId } : {})}
      />

      {/* ── Il tuo percorso (obiettivi · personalità · insight) ── */}
      <SectionDivider label="Il tuo percorso" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DashboardObjectivesPathCard objectives={strategicObjectives} />
        <DashboardPersonality
          {...(effectiveSession?.riasecScores ? { riasecScores: effectiveSession.riasecScores } : {})}
          {...(effectiveSession?.spiritScores ? { spiritScores: effectiveSession.spiritScores } : {})}
          {...(effectiveSession?.primaryTypes ? { primaryTypes: effectiveSession.primaryTypes } : {})}
          agentSummary={summary}
          objectivesProgress={objectivesProgress}
        />
      </div>
      {insights.length > 0 && (
        <div className="space-y-2">
          {insights.slice(0, 2).map((insight: ProactiveInsight) => (
            <ProactiveInsightCard key={insight.id} insight={insight} onRead={markRead} onDismiss={dismiss} />
          ))}
        </div>
      )}
      {upcomingEvents.length > 0 && <DashboardWeekTimeline events={upcomingEvents} />}

      {/* ── Sblocca Pro (solo free) — leva di conversione ── */}
      {!isPro && (
        <Link href="/premium" className="block group">
          <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-foreground">Sblocca tutto con Pro</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Colloqui e analisi illimitati · segnali di mercato live · export del CV in PDF.
                </p>
              </div>
              <Button className="rounded-full shrink-0 group-hover:translate-x-0.5 transition-transform">
                <Sparkles className="w-4 h-4 mr-2" /> Passa a Pro
              </Button>
            </div>
          </div>
        </Link>
      )}
    </div>
  );
}

function useLatestSession() {
  return useQuery<LatestSession>({
    queryKey: ["latest-session-dashboard"],
    queryFn: () => getJson<LatestSession>(`${BASE}api/test-sessions/latest`),
    retry: false,
    staleTime: 120_000,
  });
}

function useSessionDetail(sessionId: number | null) {
  return useQuery<SessionDetail>({
    queryKey: ["session-detail-dashboard", sessionId],
    enabled: !!sessionId,
    staleTime: 600_000,
    queryFn: () => getJson<SessionDetail>(`${BASE}api/test-sessions/${sessionId}`),
  });
}
