import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentAnalysis } from "@/hooks/useAgentAnalysis";
import { useDashboardData, type DashboardSession } from "@/hooks/useDashboardData";
import { useDashboardLayout, type WidgetLayout } from "@/hooks/useDashboardLayout";
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
  RefreshCw,
  Rocket,
  Sparkles,
  TrendingUp
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardKpiStrip } from "@/components/dashboard/DashboardKpiStrip";
import { DashboardDiaryBookCard } from "@/components/dashboard/DashboardObjectives";
import { MonthlyRitualBanner } from "@/components/dashboard/MonthlyRitualBanner";
import { DashboardPersonality } from "@/components/dashboard/DashboardPersonality";
import { DashboardWeekTimeline } from "@/components/dashboard/DashboardWeekTimeline";
import { ProactiveInsightCard } from "@/components/wendy/ProactiveInsightCard";
import { useProactiveInsights, type ProactiveInsight } from "@/hooks/useProactiveInsights";
import { useMonthlyRitualCurrent } from "@/hooks/useMonthlyRitual";

import { AgentLoadingSkeleton } from "@/components/dashboard/AgentLoadingSkeleton";
import { DashboardCareerComparison } from "@/components/dashboard/DashboardCareerComparison";
import { DashboardClarityPath } from "@/components/dashboard/DashboardClarityPath";
import { DashboardDiscoveryFeed, useSavedSectorsCount } from "@/components/dashboard/DashboardDiscoveryFeed";
import { DashboardWendyPrompts } from "@/components/dashboard/DashboardWendyPrompts";
import { fetchReadiness, isReadinessData } from "@/components/dashboard/CommitmentReadinessWidget";
import { NextRoutineWidget } from "@/components/dashboard/widgets/NextRoutineWidget";
import type { JourneyId } from "@/components/dashboard/dashboard-sections";
import {
  deriveDashboardPhase,
  getAdaptiveDashboardLayout,
  getAdaptiveSectionPresentation,
  type AdaptiveDashboardPhase,
} from "@/components/dashboard/dashboard-adaptive-flow";
import { JourneyToolsSection } from "@/components/dashboard/JourneyToolsSection";
import { DashboardIndecisoTools } from "@/components/dashboard/DashboardIndecisoTools";
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

const ADAPTIVE_PHASE_LABEL: Record<AdaptiveDashboardPhase, string> = {
  start_test: "Scopri chi sei",
  explore_sectors: "Esplora il mondo",
  compare_options: "Confronta le opzioni",
  choose_path: "Scegli il percorso",
  active_journey: "Percorso attivo",
};

const DASHBOARD_WENDY_CAPABILITIES = ["navigate", "create_objective", "update_objective_progress", "set_filters"];
const DASHBOARD_WENDY_FIELDS = ["objective.text", "objective.category", "objective.dueDate"];
const DASHBOARD_WENDY_ACTIONS = ["Crea obiettivo", "Aggiorna progresso", "Mostra prossimi passi"];

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

function DashboardProgressUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Progressi dashboard non disponibili</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Non posso verificare obiettivi, timeline e avanzamento in questo momento. Il resto della dashboard resta consultabile.
          </p>
          <Button type="button" size="sm" variant="outline" className="mt-3 h-8 gap-1.5" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" />
            Riprova
          </Button>
        </div>
      </div>
    </section>
  );
}

export default function Dashboard() {
  usePageMeta({
    title: "Fondazione NorthStar",
    description: "La tua analisi AI personalizzata: professioni consigliate, percorsi formativi e modalità di lavoro ottimale per il tuo profilo RIASEC.",
  });
  usePageModule({ pageId: "dashboard" });

  const { user, authReady } = useAuth();
  const [location, navigate] = useLocation();

  // Track saved sectors count — initialized from localStorage, updated live via callback
  const savedSectorsCountFromStorage = useSavedSectorsCount(user?.id);
  const [savedSectorsCountOverride, setSavedSectorsCount] = useState<number | null>(null);
  const savedSectorsCount = savedSectorsCountOverride ?? savedSectorsCountFromStorage;

  useEffect(() => {
    if (authReady && !user) navigate("/");
  }, [user, authReady, navigate]);

  const journeyType = (user?.journeyType ?? "indeciso") as JourneyId;
  const journeyMeta = JOURNEY_META[journeyType];

  const { data: dashData, isLoading: dashLoading, isError: dashError, refetch: refetchDashboard } = useDashboardData();
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

  const { insights, error: insightsError, refetch: refetchInsights, markRead, dismiss } = useProactiveInsights();
  const { data: monthlyRitual } = useMonthlyRitualCurrent();
  const { layout: dashboardLayout } = useDashboardLayout();
  const { data: readinessData } = useQuery({
    queryKey: ["discovery-readiness"],
    queryFn: fetchReadiness,
    enabled: journeyType === "indeciso",
    staleTime: 60 * 1000,
  });
  const ritualRequested = location.includes("ritual=notte-fondazione");
  const objectives = dashData?.objectives ?? [];
  const strategicObjectives = objectives.filter((objective) => objective.category !== "idea_validation");
  const objectivesProgress = dashData?.objectivesProgress ?? { done: 0, total: 0, percent: 0 };
  const upcomingEvents = dashData?.upcomingEvents ?? [];
  const readinessBand = isReadinessData(readinessData) ? readinessData.band : undefined;
  const clarityScore = journeyType === "indeciso"
    ? Math.min(100, Math.round(
        (sessionId               ? 30 : 0) +
        (user?.onboardingCompleted ? 15 : 0) +
        (savedSectorsCount >= 1  ? 15 : 0) +
        (savedSectorsCount >= 3  ? 20 : 0) +
        (savedSectorsCount >= 5  ? 20 : 0)
      ))
    : undefined;
  const adaptiveInput = {
    journeyType,
    hasSession: !!sessionId,
    savedSectorsCount,
    hasDecided: false,
    readinessBand,
    layout: dashboardLayout,
  };
  const adaptiveState = deriveDashboardPhase(adaptiveInput);
  const adaptiveSectionPresentation = getAdaptiveSectionPresentation(adaptiveInput);
  const visibleDashboardLayout = getAdaptiveDashboardLayout(adaptiveInput);

  const queryClient = useQueryClient();

  useWendyPageContext({
    page: 'dashboard',
    title: 'Dashboard',
    journeyType,
    capabilities: DASHBOARD_WENDY_CAPABILITIES,
    fields: DASHBOARD_WENDY_FIELDS,
    actions: DASHBOARD_WENDY_ACTIONS,
    adaptivePhase: adaptiveState.phase,
    adaptiveNextAction: adaptiveState.nextAction,
    clarityScore,
    savedSectorsCount,
    readinessBand,
  });

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

  // Top 2 recommendations for career comparison
  const topTwoRecs = recommendations.slice(0, 2);
  const compSectorA = topTwoRecs[0]
    ? { sectorId: topTwoRecs[0].sectorId, sectorName: topTwoRecs[0].sectorName, matchScore: topTwoRecs[0].matchScore ?? 0 }
    : null;
  const compSectorB = topTwoRecs[1]
    ? { sectorId: topTwoRecs[1].sectorId, sectorName: topTwoRecs[1].sectorName, matchScore: topTwoRecs[1].matchScore ?? 0 }
    : null;

  function renderDiscoveryFeed() {
    if (!user) return null;

    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <h2 className="font-bold text-sm text-foreground">Settori consigliati per te</h2>
          <span className="text-xs text-muted-foreground">- salva quelli che ti interessano</span>
        </div>
        <DashboardDiscoveryFeed
          sectors={recommendations.map((r) => ({
            sectorId: r.sectorId,
            sectorName: r.sectorName,
            matchScore: r.matchScore ?? 0,
            matchReason: (r as { matchReason?: string }).matchReason,
          }))}
          userId={user.id}
          onSavedCountChange={setSavedSectorsCount}
        />
      </section>
    );
  }

  function renderPersonality() {
    const session = effectiveSession;

    return (
      <DashboardPersonality
        {...(session?.riasecScores ? { riasecScores: session.riasecScores } : {})}
        {...(session?.spiritScores ? { spiritScores: session.spiritScores } : {})}
        {...(session?.primaryTypes ? { primaryTypes: session.primaryTypes } : {})}
        agentSummary={summary}
        objectivesProgress={objectivesProgress}
      />
    );
  }

  function renderTools() {
    const isIndeciso = journeyType === "indeciso";
    const toolsProps = topSectorId !== undefined
      ? { journeyType, sectorId: topSectorId }
      : { journeyType };

    return (
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
            <LayoutGrid className="w-3.5 h-3.5" />
          </div>
          <h2 className="font-bold text-base text-foreground">Strumenti del percorso</h2>
          {journeyMeta && <span className="text-xs text-muted-foreground">- {journeyMeta.label}</span>}
        </div>
        {isIndeciso ? (
          <DashboardIndecisoTools toolsProps={toolsProps} />
        ) : (
          <JourneyToolsSection {...toolsProps} />
        )}
      </section>
    );
  }

  function renderAnalysis() {
    const selectedWorkMode = workMode;

    return (
      <>
        {(agentLoading || detailLoading) && <AgentLoadingSkeleton />}
        {agentError && !agentLoading && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <p className="text-sm text-muted-foreground">Analisi non disponibile. Riprova tra qualche minuto.</p>
          </div>
        )}
        {agentData && !agentLoading && (professions.length > 0 || selectedWorkMode) && (
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
              {selectedWorkMode && <WorkModePanel wm={selectedWorkMode} isPremium={isPremium} />}
            </div>
          </section>
        )}
      </>
    );
  }

  function renderDashboardSection(section: WidgetLayout) {
    switch (section.id) {
      case "clarity_path":
        return (
          <DashboardClarityPath
            hasSession={!!sessionId}
            savedSectorsCount={savedSectorsCount}
            hasDecided={false}
            currentPhaseLabel={ADAPTIVE_PHASE_LABEL[adaptiveState.phase]}
            nextAction={{
              label: adaptiveState.nextAction.label,
              href: adaptiveState.nextAction.href,
            }}
            compact={adaptiveSectionPresentation.clarity_path?.priority === "compact"}
          />
        );
      case "next_routine":
        return <NextRoutineWidget size={section.size} />;
      case "discovery_feed":
        return renderDiscoveryFeed();
      case "personality":
        return renderPersonality();
      case "career_comparison":
        return <DashboardCareerComparison sectorA={compSectorA} sectorB={compSectorB} />;
      case "wendy_prompts":
        return <DashboardWendyPrompts />;
      case "kpi_strip":
        if (dashError) return null;
        return (
          <DashboardKpiStrip
            profilePercent={profilePercent}
            objectives={objectives}
            objectivesProgress={objectivesProgress}
            confirmedSectorName={confirmedSectorName}
            sessionId={sessionId}
          />
        );
      case "week_timeline":
        if (dashError) return null;
        return <DashboardWeekTimeline events={upcomingEvents} objectives={strategicObjectives} />;
      case "diary_objectives":
        if (dashError) return null;
        return <DashboardDiaryBookCard objectives={strategicObjectives} />;
      case "wendy_insights":
        if (insightsError) {
          return (
            <section className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">Insight da Wendy non disponibili</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Non posso verificare gli aggiornamenti in questo momento. Riprova senza perdere il resto della dashboard.
                  </p>
                  <Button type="button" size="sm" variant="outline" className="mt-3 h-8" onClick={() => refetchInsights()}>
                    Riprova
                  </Button>
                </div>
              </div>
            </section>
          );
        }
        if (insights.length === 0) return null;
        return (
          <section className="space-y-2">
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
          </section>
        );
      case "tools":
        return renderTools();
      case "analysis":
        return renderAnalysis();
      default:
        return null;
    }
  }

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
        {...(clarityScore !== undefined ? { clarityScore } : {})}
      />

      <MonthlyRitualBanner ritual={monthlyRitual} forceExpanded={ritualRequested} />

      {dashError && <DashboardProgressUnavailable onRetry={() => refetchDashboard()} />}

      {visibleDashboardLayout.map((section) => {
        const content = renderDashboardSection(section);
        return content ? <div key={section.id}>{content}</div> : null;
      })}

    </div>
  );
}
