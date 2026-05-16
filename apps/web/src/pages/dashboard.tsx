import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useAgentAnalysis } from "@/hooks/useAgentAnalysis";
import { useWendyPageContext } from "@/hooks/useWendyPageContext";
import type { ProfessionResult, EducationResult, WorkModeResult } from "@/hooks/useAgentAnalysis";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { usePageMeta } from "@/lib/seo";
import {
  Bot, Briefcase, GraduationCap, TrendingUp, Zap, Crown, Lock,
  Loader2, ArrowRight, CheckCircle2, Sparkles, AlertTriangle,
  DollarSign, Clock, MessageSquare, Map, Network, Newspaper,
  Target, BrainCircuit, HelpCircle, Rocket, Building2, BarChart3,
  MapPin, ChevronRight, LayoutGrid,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardObjectives } from "@/components/dashboard/DashboardObjectives";
import { DashboardPersonality } from "@/components/dashboard/DashboardPersonality";
import { DashboardCalendar } from "@/components/dashboard/DashboardCalendar";
import { DashboardGrowth } from "@/components/dashboard/DashboardGrowth";

import { JourneyToolsSection } from "@/components/dashboard/JourneyToolsSection";
import { ProfessionCard } from "@/components/dashboard/ProfessionCard";
import { EducationCard } from "@/components/dashboard/EducationCard";
import { WorkModePanel } from "@/components/dashboard/WorkModePanel";
import { AgentLoadingSkeleton } from "@/components/dashboard/AgentLoadingSkeleton";
import { DashboardSectionRenderer, type JourneyId } from "@/components/dashboard/dashboard-sections";

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
  const educationPaths = summary?.educationPaths ?? [];
  const workMode = summary?.workMode;

  const { data: dashData, isLoading: dashLoading } = useDashboardData();
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

  const sectionProps = {
    userId: user.id,
    journeyType,
    sessionDetail: sessionDetail ?? null,
    sessionId,
    isPremium,
    topSectorId,
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 md:py-14 space-y-8">

      <DashboardHero journeyType={journeyType} session={sessionDetail ?? null} isPremium={isPremium} />

      <DashboardObjectives
        objectives={objectives}
        progress={objectivesProgress}
        onToggle={toggleObjective}
        onDelete={deleteObjective}
        onCreate={createObjective}
      />

      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
            <LayoutGrid className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-xl text-foreground">I tuoi strumenti</h2>
            <p className="text-xs text-muted-foreground">
              {journeyMeta ? `Selezionati per il percorso: ${journeyMeta.label}` : "Esplora e cresci nel tuo settore"}
            </p>
          </div>
        </div>
        <Tabs defaultValue="personalizzati">
          <TabsList className="mb-5">
            <TabsTrigger value="personalizzati">Per te</TabsTrigger>
            <TabsTrigger value="avanzati">Approfondisci</TabsTrigger>
          </TabsList>
          <TabsContent value="personalizzati">
            <JourneyToolsSection journeyType={journeyType} sectorId={topSectorId} />
          </TabsContent>
          <TabsContent value="avanzati">
            {sessionId ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { href: `${BASE}wiki/${topSectorId ?? ""}`,    icon: MessageSquare, title: "Guida AI",          desc: "Chiedi tutto sul tuo settore" },
                  { href: `${BASE}roadmap/${topSectorId ?? ""}`, icon: Map,           title: "Piano di crescita", desc: "Piano formativo personalizzato" },
                  { href: "/grafo",                              icon: Network,       title: "Mappa delle conoscenze", desc: "Note, competenze e documenti collegati" },
                  { href: "/news",                               icon: Newspaper,     title: "Notizie del settore",   desc: "Aggiornamenti live dal mondo del lavoro" },
                ].map(({ href, icon: Icon, title, desc }) => (
                  <Link key={title} href={href}>
                    <div className="group rounded-2xl border border-border bg-card p-5 flex flex-col gap-3 hover:border-primary/30 transition-all duration-200 cursor-pointer h-full">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 group-hover:bg-primary/15 transition-colors">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{title}</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 mt-auto self-end text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Completa il test per sbloccare strumenti avanzati.</p>
            )}
          </TabsContent>
        </Tabs>
      </section>

      <DashboardSectionRenderer {...sectionProps} />

      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-xl text-foreground">Analisi personalizzata</h2>
            <p className="text-xs text-muted-foreground">
              {isPremium ? "Analisi completa basata sul tuo profilo" : "Piano gratuito — aggiorna per l'analisi completa"}
            </p>
          </div>
          {sessionId && (
            <Link href={`/risultati/${sessionId}`} className="ml-auto">
              <div className="inline-flex items-center gap-1.5 text-sm text-primary font-semibold hover:gap-2 transition-all">
                Risultati completi <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          )}
        </div>

        {(agentLoading || detailLoading) && <AgentLoadingSkeleton />}

        {agentError && !agentLoading && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 flex items-start gap-4">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-destructive text-sm mb-1">Analisi non disponibile</p>
              <p className="text-sm text-muted-foreground">Non è stato possibile eseguire l'analisi. Riprova tra qualche minuto.</p>
            </div>
          </div>
        )}

        {agentData && !agentLoading && (
          <div className="space-y-8">
            {professions.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-foreground">Professioni consigliate</h3>
                  <span className="text-xs text-muted-foreground ml-1">{professions.length} professioni</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {professions.map((p, i) => (
                    <ProfessionCard key={`${p.title}-${i}`} p={p} index={i} />
                  ))}
                </div>
              </div>
            )}

            {workMode && (
              <WorkModePanel wm={workMode} isPremium={isPremium} />
            )}

            {!isPremium && !workMode && (
              <div className="rounded-2xl border border-dashed border-primary/20 p-6 flex items-center gap-4">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/20">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground text-sm">Modalità lavorativa + Percorsi formativi</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Con Pro l'intelligenza artificiale consiglia la modalità di lavoro ottimale e i percorsi di studio più adatti al tuo profilo.
                  </p>
                </div>
                <Button asChild size="sm" variant="outline" className="shrink-0 rounded-full border-primary/30 text-primary hover:bg-primary/5">
                  <Link href="/premium"><Crown className="w-3.5 h-3.5 mr-1.5" />Sblocca</Link>
                </Button>
              </div>
            )}

            {isPremium && educationPaths.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <GraduationCap className="w-4 h-4 text-growth" />
                  <h3 className="font-semibold text-foreground">Percorsi formativi</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {educationPaths.map((e, i) => (
                    <EducationCard key={`${e.path}-${i}`} e={e} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <DashboardCalendar events={upcomingEvents} />
      <DashboardGrowth />

      <div className="flex flex-col sm:flex-row gap-3 border-t border-border pt-6">
        {sessionId && (
          <Button asChild variant="outline" className="rounded-full">
            <Link href={`/risultati/${sessionId}`}><ArrowRight className="w-4 h-4 mr-2" />Risultati completi</Link>
          </Button>
        )}
        <Button asChild variant="ghost" className="rounded-full">
          <Link href="/">Torna alla home</Link>
        </Button>
      </div>
    </div>
  );
}
