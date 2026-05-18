import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { usePageModule } from "@/hooks/usePageModule";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useAgentAnalysis } from "@/hooks/useAgentAnalysis";
import { useWendyPageContext } from "@/hooks/useWendyPageContext";
import type { ProfessionResult, EducationResult, WorkModeResult } from "@/hooks/useAgentAnalysis";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { usePageMeta } from "@/lib/seo";
import {
  Bot, Crown, ArrowRight, AlertTriangle,
  HelpCircle, Rocket, Building2, BarChart3, TrendingUp,
  LayoutGrid, Sparkles, MapPin, ChevronRight,
} from "lucide-react";

import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardObjectives } from "@/components/dashboard/DashboardObjectives";
import { DashboardPersonality } from "@/components/dashboard/DashboardPersonality";
import { DashboardCalendar } from "@/components/dashboard/DashboardCalendar";
import { DashboardKpiStrip } from "@/components/dashboard/DashboardKpiStrip";
import { ProactiveInsightCard } from "@/components/wendy/ProactiveInsightCard";
import { useProactiveInsights } from "@/hooks/useProactiveInsights";

import { JourneyToolsSection } from "@/components/dashboard/JourneyToolsSection";
import { ProfessionCard } from "@/components/dashboard/ProfessionCard";
import { WorkModePanel } from "@/components/dashboard/WorkModePanel";
import { AgentLoadingSkeleton } from "@/components/dashboard/AgentLoadingSkeleton";
import type { JourneyId } from "@/components/dashboard/dashboard-sections";

const BASE = import.meta.env.BASE_URL || "/";

type SessionDetail = {
  id: number;
  riasecScores: Record<string, number>;
  primaryTypes: string[];
  spiritScores: Record<string, number>;
  recommendations: Array<{ sectorId: number; sectorName: string; matchScore: number; matchReason: string }>;
  createdAt: string;
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
  return useQuery<{ sessionId: number; recommendations: Array<{ sectorId: number; sectorName: string }> }>({
    queryKey: ["latest-session-dashboard"],
    queryFn: async () => {
      const res = await apiFetch(`${BASE}api/test-sessions/latest`);
      if (!res.ok) throw new Error("No session");
      return res.json();
    },
    retry: false,
    staleTime: 120_000,
  });
}

function useSessionDetail(sessionId: number | null) {
  return useQuery<SessionDetail>({
    queryKey: ["session-detail-dashboard", sessionId],
    enabled: !!sessionId,
    staleTime: 600_000,
    queryFn: async () => {
      const res = await apiFetch(`${BASE}api/test-sessions/${sessionId}`);
      if (!res.ok) throw new Error("Errore sessione");
      return res.json() as Promise<SessionDetail>;
    },
  });
}

export default function Dashboard() {
  usePageMeta({
    title: "Dashboard AI — NorthStar",
    description: "La tua analisi AI personalizzata: professioni consigliate, percorsi formativi e modalità di lavoro ottimale per il tuo profilo RIASEC.",
  });
  useWendyPageContext({ page: 'dashboard', title: 'Dashboard' });
  usePageModule({ pageId: "dashboard" });

  const { user, authReady } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (authReady && !user) navigate("/");
  }, [user, authReady, navigate]);

  const journeyType = (user?.journeyType ?? "indeciso") as JourneyId;
  const journeyMeta = JOURNEY_META[journeyType];

  const { data: latestSession, isLoading: sessionLoading } = useLatestSession();
  const sessionId = latestSession?.sessionId ?? null;
  const { data: sessionDetail, isLoading: detailLoading } = useSessionDetail(sessionId);
  const topSectorId = latestSession?.recommendations?.[0]?.sectorId;
  const topSectors = (latestSession?.recommendations ?? []).map((r) => ({ sectorName: r.sectorName }));

  const { data: agentData, isLoading: agentLoading, isError: agentError } = useAgentAnalysis({
    sessionId,
    riasecScores: sessionDetail?.riasecScores,
    primaryTypes: sessionDetail?.primaryTypes,
    spiritScores: sessionDetail?.spiritScores,
    topSectors,
    enabled: !!sessionDetail,
  });

  const isPremium = agentData?.plan === "premium";
  const summary = agentData?.data?.summary;
  const professions = summary?.professions ?? [];
  const workMode = summary?.workMode;

  const { data: dashData, isLoading: dashLoading } = useDashboardData();
  const { insights, markRead, dismiss } = useProactiveInsights();
  const objectives = dashData?.objectives ?? [];
  const objectivesProgress = dashData?.objectivesProgress ?? { done: 0, total: 0, percent: 0 };
  const upcomingEvents = dashData?.upcomingEvents ?? [];

  const queryClient = useQueryClient();

  const toggleObjective = async (id: number, current: boolean) => {
    try {
      await apiFetch(`${BASE}api/objectives/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !current }),
      });
      queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
    } catch {}
  };

  const deleteObjective = async (id: number) => {
    try {
      await apiFetch(`${BASE}api/objectives/${id}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
    } catch {}
  };

  const createObjective = async (text: string) => {
    try {
      await apiFetch(`${BASE}api/objectives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
    } catch {}
  };

  useEffect(() => {
    if (dashData && objectives.length === 0 && journeyType) {
      apiFetch(`${BASE}api/objectives/seed`, { method: "POST" })
        .then(() => queryClient.invalidateQueries({ queryKey: ["dashboard-data"] }))
        .catch(() => {});
    }
  }, [dashData, objectives.length, journeyType]);

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

  const confirmedSectorName = sessionDetail?.recommendations?.[0]?.sectorName ?? null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-5">

      {/* ZONA 1 — Hero */}
      <DashboardHero
        journeyType={journeyType}
        session={sessionDetail ?? null}
        isPremium={isPremium}
        userName={user.name}
      />

      {/* ZONA 2 — KPI Strip */}
      <DashboardKpiStrip
        profilePercent={profilePercent}
        objectives={objectives}
        objectivesProgress={objectivesProgress}
        upcomingEvents={upcomingEvents}
        confirmedSectorName={confirmedSectorName}
        sessionId={sessionId}
      />

      {/* ZONA 3 — Grid: sinistra 2/3, destra 1/3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Colonna sinistra */}
        <div className="lg:col-span-2 space-y-5">
          <DashboardCalendar events={upcomingEvents} />
          <DashboardObjectives
            objectives={objectives}
            progress={objectivesProgress}
            onToggle={toggleObjective}
            onDelete={deleteObjective}
            onCreate={createObjective}
          />
        </div>

        {/* Colonna destra */}
        <div className="space-y-4">
          <DashboardPersonality
            riasecScores={sessionDetail?.riasecScores}
            spiritScores={sessionDetail?.spiritScores}
            primaryTypes={sessionDetail?.primaryTypes}
          />
          {insights.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                Insight da Wendy
              </p>
              {insights.slice(0, 2).map((insight: import("@/hooks/useProactiveInsights").ProactiveInsight) => (
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
        <JourneyToolsSection journeyType={journeyType} sectorId={topSectorId} />
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
