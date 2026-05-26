import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentAnalysis } from "@/hooks/useAgentAnalysis";
import { useDashboardData, type DashboardSession } from "@/hooks/useDashboardData";
import { usePageModule } from "@/hooks/usePageModule";
import { useWendyPageContext } from "@/hooks/useWendyPageContext";
import { apiFetch } from "@/lib/api-fetch";
import { getJson } from "@/lib/apiClient";
import { usePageMeta } from "@/lib/seo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  ChevronRight,
  HelpCircle,
  LayoutGrid,
  MapPin,
  Rocket,
  Sparkles,
  TrendingUp
} from "lucide-react";
import { useEffect } from "react";
import { Link, useLocation } from "wouter";

import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardKpiStrip } from "@/components/dashboard/DashboardKpiStrip";
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

const JOURNEY_META: Record<JourneyId, {
  label: string;
  Icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  headline: string;
  subline: string;
}> = {
  indeciso:    { label: "Indeciso",   Icon: HelpCircle,  color: "text-primary",      bgColor: "bg-primary/10",      borderColor: "border-primary/30",      headline: "Scopri la tua strada",           subline: "Inizia con il test RIASEC per capire il tuo profilo professionale" },
  dipendente:  { label: "Dipendente", Icon: TrendingUp,  color: "text-growth",    bgColor: "bg-growth/10",    borderColor: "border-growth/30",    headline: "Accelera la tua carriera",        subline: "Analizza le tue skill, allenati per i colloqui, ottieni un piano di crescita" },
  autonomo:    { label: "Autonomo",   Icon: Rocket,      color: "text-primary",      bgColor: "bg-primary/10",      borderColor: "border-primary/30",      headline: "Scala il tuo business",          subline: "Valida idee, trova mercati, costruisci il tuo piano strategico con l'AI" },
  azienda:     { label: "Azienda",    Icon: Building2,   color: "text-growth",    bgColor: "bg-growth/10",    borderColor: "border-growth/30",    headline: "Trova i profili giusti",          subline: "Esplora i profili RIASEC, pubblica le tue opportunità, analizza il mercato" },
  investitore: { label: "Investitore",Icon: BarChart3,   color: "text-primary",      bgColor: "bg-primary/10",      borderColor: "border-primary/30",      headline: "Analizza le opportunità",         subline: "Aree in crescita, trend di mercato e analisi delle competenze richieste" },
};

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

  const isPremium = agentData?.plan === "premium";
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
      <div className="container mx-auto px-4 py-20 max-w-5xl">
        <Skeleton className="h-10 w-72 mb-3" />
        <Skeleton className="h-5 w-96 mb-12" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (!user) return null;

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
        {!journeyType && (
          <div className="mt-6">
            <Link href="/percorso">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:gap-2.5 transition-all">
                <MapPin className="w-4 h-4" /> Oppure scegli il tuo percorso <ChevronRight className="w-4 h-4" />
              </div>
            </Link>
          </div>
        )}
      </div>
    );
  }

  // Calcolo percentuale completamento profilo
  const profilePercent = Math.min(100, Math.round(
    (sessionId                                        ? 25 : 0) +
    (journeyType && journeyType !== "indeciso"        ? 25 : 0) +
    (user?.onboardingCompleted                        ? 25 : 0) +
    (user?.avatarUrl                                  ? 25 : 0)
  ));

  const confirmedSectorName = effectiveSession?.recommendations?.[0]?.sectorName ?? null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-5">

      {/* ZONA 1 — Hero */}
      <DashboardHero
        journeyType={journeyType}
        session={effectiveSession}
        isPremium={isPremium}
        userName={user.name}
        profilePercent={profilePercent}
        confirmedSectorName={confirmedSectorName}
        sessionId={sessionId}
      />

      {/* ZONA 2 — KPI Strip */}
      <DashboardKpiStrip
        profilePercent={profilePercent}
        objectives={objectives}
        objectivesProgress={objectivesProgress}
        confirmedSectorName={confirmedSectorName}
        sessionId={sessionId}
      />

      {/* ZONA 3 — Grid: sinistra 2/3, destra 1/3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Colonna sinistra */}
        <div className="lg:col-span-2 space-y-5">
          <DashboardWeekTimeline events={upcomingEvents} />
          <DashboardObjectivesPathCard objectives={strategicObjectives} />
        </div>

        {/* Colonna destra */}
        <div className="space-y-4">
          <DashboardPersonality
            {...(effectiveSession?.riasecScores ? { riasecScores: effectiveSession.riasecScores } : {})}
            {...(effectiveSession?.spiritScores ? { spiritScores: effectiveSession.spiritScores } : {})}
            {...(effectiveSession?.primaryTypes ? { primaryTypes: effectiveSession.primaryTypes } : {})}
            agentSummary={summary}
            objectivesProgress={objectivesProgress}
          />
          {insights.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                Insight da Wendy
              </p>
              {insights.slice(0, 2).map((insight: ProactiveInsight) => (
                <ProactiveInsightCard
                  key={insight.id}
                  insight={insight}
                  onRead={markRead}
                  onDismiss={dismiss}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ZONA 4 — Strumenti del percorso */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
            <LayoutGrid className="w-3.5 h-3.5" />
          </div>
          <h2 className="font-bold text-base text-foreground">
            Strumenti del percorso
          </h2>
          {journeyMeta && (
            <span className="text-xs text-muted-foreground">— {journeyMeta.label}</span>
          )}
        </div>
        <JourneyToolsSection
          journeyType={journeyType}
          {...(topSectorId !== undefined ? { sectorId: topSectorId } : {})}
        />
      </section>

      {/* ZONA 5 — Analisi AI (max 3 professioni + modalità lavoro) */}
      {(agentLoading || detailLoading) && <AgentLoadingSkeleton />}

      {agentError && !agentLoading && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <p className="text-sm text-muted-foreground">Analisi non disponibile. Riprova tra qualche minuto.</p>
        </div>
      )}

      {agentData && !agentLoading && (professions.length > 0 || workMode) && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <h2 className="font-bold text-base text-foreground">Analisi personalizzata</h2>
            </div>
            {sessionId && (
              <Link href={`/risultati/${sessionId}`} className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
                Analisi completa <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>

          <div className="space-y-5">
            {professions.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {professions.slice(0, 3).map((p, i) => (
                  <ProfessionCard key={`${p.title}-${i}`} p={p} index={i} />
                ))}
              </div>
            )}
            {workMode && <WorkModePanel wm={workMode} isPremium={isPremium} />}
          </div>
        </section>
      )}
    </div>
  );
}
