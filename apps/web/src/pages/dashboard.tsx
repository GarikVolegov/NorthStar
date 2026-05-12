import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useAgentAnalysis } from "@/hooks/useAgentAnalysis";
import type { ProfessionResult, EducationResult, WorkModeResult } from "@/hooks/useAgentAnalysis";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { usePageMeta } from "@/lib/seo";
import {
  Bot, Briefcase, GraduationCap, TrendingUp, Zap, Crown, Lock,
  Loader2, ArrowRight, CheckCircle2, Sparkles, AlertTriangle,
  DollarSign, Clock, MessageSquare, Map, Network, Newspaper,
  Target, BrainCircuit, Mic2, HelpCircle, Rocket,
  Building2, BarChart3, MapPin, ChevronRight, LayoutGrid,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// Dashboard components
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardObjectives } from "@/components/dashboard/DashboardObjectives";
import { DashboardPersonality } from "@/components/dashboard/DashboardPersonality";
import { DashboardCareerPipeline } from "@/components/dashboard/DashboardCareerPipeline";
import { DashboardIdeaValidator } from "@/components/dashboard/DashboardIdeaValidator";
import { DashboardCandidateSearch } from "@/components/dashboard/DashboardCandidateSearch";
import { DashboardMarketInsights } from "@/components/dashboard/DashboardMarketInsights";
import { DashboardCalendar } from "@/components/dashboard/DashboardCalendar";
import { DashboardGrowth } from "@/components/dashboard/DashboardGrowth";

const BASE = import.meta.env.BASE_URL || "/";

/* ── Types ─────────────────────────────────────────────── */
type SessionDetail = {
  id: number;
  riasecScores: Record<string, number>;
  primaryTypes: string[];
  spiritScores: Record<string, number>;
  recommendations: Array<{ sectorId: number; sectorName: string; matchScore: number; matchReason: string }>;
};

/* ── Data hooks ─────────────────────────────────────────── */
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

/* ── Journey type config ─────────────────────────────── */
type JourneyId = "indeciso" | "dipendente" | "autonomo" | "azienda" | "investitore";

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
  investitore: { label: "Investitore",Icon: BarChart3,   color: "text-primary",      bgColor: "bg-primary/10",      borderColor: "border-primary/30",      headline: "Analizza le opportunità",         subline: "Settori in crescita, trend di mercato e analisi delle competenze richieste" },
};

/* ── Persona-aware tools grid ───────────────────────── */
function JourneyToolsSection({ journeyType, sessionId, sectorId }: {
  journeyType: string | null | undefined;
  sessionId: number | null;
  sectorId?: number;
}) {
  type ToolItem = { href: string; icon: React.ElementType; title: string; desc: string; badge?: string };

  const TOOLS_BY_JOURNEY: Record<JourneyId, ToolItem[]> = {
    indeciso: [
      { href: "/test",                          icon: Zap,         title: "Test di personalità",    desc: "Mappa la tua personalità professionale",               badge: "Gratuito" },
      { href: "/settori",                       icon: Target,      title: "Esplora settori",        desc: "28 settori con stipendi, crescita e dati" },
      { href: `${BASE}coach`,                   icon: BrainCircuit,title: "Consulente di carriera",  desc: "Sessioni di consulenza personalizzate",                badge: "AI" },
      { href: "/news",                          icon: Newspaper,   title: "Notizie lavoro",         desc: "Ultime notizie dal mercato del lavoro" },
    ],
    dipendente: [
      { href: sectorId ? `${BASE}skills-gap/${sectorId}` : "/dashboard", icon: Target,     title: "Competenze da sviluppare",desc: "Identifica cosa ti manca per salire di livello",             badge: "AI" },
      { href: sectorId ? `${BASE}colloquio/${sectorId}` : "/dashboard",  icon: Mic2,       title: "Simulatore Colloquio",    desc: "Allenati con domande reali del tuo settore",               badge: "AI" },
      { href: `${BASE}coach`,                                              icon: BrainCircuit,title: "Consulente di carriera",  desc: "Piano di crescita personalizzato per la tua carriera",     badge: "AI" },
      { href: "/candidature",                                              icon: Briefcase,  title: "Le mie candidature",     desc: "Gestisci le tue richieste e traccia i progressi" },
    ],
    autonomo: [
      { href: "/validatore-idea",               icon: Rocket,      title: "Valida la tua idea",     desc: "Score AI + analisi su 12 dimensioni + incubatori",     badge: "AI" },
      { href: `${BASE}coach`,                   icon: BrainCircuit,title: "Consulente per la tua attività", desc: "Consigli strategici per far crescere la tua attività",  badge: "AI" },
      { href: "/settori",                       icon: TrendingUp,  title: "Mercati in crescita",    desc: "Scopri i settori più profittevoli in Italia" },
      { href: `/grafo`,                         icon: Network,     title: "Mappa delle conoscenze", desc: "Mappa le connessioni tra settori e competenze" },
    ],
    azienda: [
      { href: "/settori",                       icon: Building2,   title: "Profili personalità",    desc: "Esplora i profili psicologici per ogni settore" },
      { href: "/affiliazione",                  icon: Briefcase,   title: "Pubblica offerta",       desc: "Raggiungi i candidati qualificati sulla piattaforma" },
      { href: "/crescita",                      icon: Sparkles,    title: "Crescita aziendale",     desc: "Articoli su cultura, team building e leadership" },
      { href: "/news",                          icon: Newspaper,   title: "News HR & Lavoro",       desc: "Tendenze del mercato del lavoro italiano" },
    ],
    investitore: [
      { href: "/settori",                       icon: BarChart3,   title: "Settori in crescita",    desc: "Analisi approfondita dei settori più dinamici" },
      { href: "/news",                          icon: Newspaper,   title: "Notizie mercati",        desc: "Ultime notizie economia, finanza e mercati" },
      { href: "/crescita",                      icon: TrendingUp,  title: "Crescita di settore",   desc: "Dati e analisi per decisioni di investimento" },
      { href: "/grafo",                         icon: Network,     title: "Mappa delle conoscenze", desc: "Rete di connessioni tra settori e competenze" },
    ],
  };

  const tools = (journeyType && TOOLS_BY_JOURNEY[journeyType as JourneyId])
    ? TOOLS_BY_JOURNEY[journeyType as JourneyId]
    : TOOLS_BY_JOURNEY.indeciso;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {tools.map(({ href, icon: Icon, title, desc, badge }) => (
        <Link key={title} href={href}>
          <div className="group rounded-2xl border border-border bg-card p-5 flex flex-col gap-3 hover:border-primary/30 hover:shadow-md hover:shadow-black/10 transition-all duration-200 cursor-pointer h-full">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 group-hover:bg-primary/15 transition-colors">
                <Icon className="w-5 h-5" />
              </div>
              {badge && (
                <span className="text-xs font-semibold bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5">{badge}</span>
              )}
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm leading-snug">{title}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
            </div>
            <ArrowRight className="w-4 h-4 mt-auto self-end text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </Link>
      ))}
    </div>
  );
}

/* ── Profession card ─────────────────────────────────── */
function ProfessionCard({ p, index }: { p: ProfessionResult; index: number }) {
  return (
    <div className="rounded-2xl border bg-card p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full mb-1.5">
            #{index + 1}
          </div>
          <h3 className="font-semibold text-foreground leading-snug">{p.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{p.sector}</p>
        </div>
        {p.growthOutlook && (
          <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-growth bg-growth/10 border border-growth/20 rounded-full px-2.5 py-0.5">
            <TrendingUp className="w-3 h-3" /> {p.growthOutlook}
          </span>
        )}
      </div>

      {p.salaryRange && (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <DollarSign className="w-3.5 h-3.5 shrink-0" />
          <span className="font-medium text-foreground">{p.salaryRange}</span>
        </div>
      )}

      {p.skills && p.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {p.skills.slice(0, 4).map((sk) => (
            <span key={sk} className="text-xs bg-primary/8 text-primary rounded-full px-2.5 py-0.5 font-medium">
              {sk}
            </span>
          ))}
        </div>
      )}

      {p.riasecAlignment && (
        <p className="text-xs text-muted-foreground leading-relaxed">{p.riasecAlignment}</p>
      )}
    </div>
  );
}

/* ── Education card ──────────────────────────────────── */
function EducationCard({ e }: { e: EducationResult }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-foreground leading-snug">{e.path}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{e.type}</p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          {e.duration && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" /> {e.duration}
            </span>
          )}
          {e.cost && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              <DollarSign className="w-3 h-3" /> {e.cost}
            </span>
          )}
        </div>
      </div>
      {e.steps && e.steps.length > 0 && (
        <ol className="space-y-1 mb-3">
          {e.steps.slice(0, 3).map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              {step}
            </li>
          ))}
        </ol>
      )}
      {e.careerOutcomes && e.careerOutcomes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {e.careerOutcomes.slice(0, 3).map((o) => (
            <span key={o} className="text-xs bg-muted text-muted-foreground rounded-full px-2.5 py-0.5">
              {o}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Work mode panel ─────────────────────────────────── */
function WorkModePanel({ wm, isPremium }: { wm: WorkModeResult; isPremium: boolean }) {
  const colorMap: Record<string, string> = {
    dipendente: "text-chart-3 bg-chart-3/10 border-chart-3/20",
    autonomo:   "text-chart-4 bg-chart-4/10 border-chart-4/20",
    ibrido:     "text-growth bg-growth/10 border-growth/20",
  };
  const labelMap: Record<string, string> = {
    dipendente: "Dipendente",
    autonomo:   "Autonomo / Freelance",
    ibrido:     "Ibrido",
  };
  const color = colorMap[wm.recommended] ?? "text-primary bg-primary/10 border-primary/20";
  const label = wm.recommendedLabel ?? labelMap[wm.recommended] ?? wm.recommended;

  return (
    <div className="rounded-2xl border bg-card p-5 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <Briefcase className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Modalità lavorativa consigliata</h3>
          {!isPremium && (
            <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5 mt-0.5">
              <Crown className="w-3 h-3" /> Premium
            </span>
          )}
        </div>
        <span className={cn("ml-auto text-sm font-semibold border rounded-full px-3 py-1", color)}>
          {label}
        </span>
      </div>
      {wm.riasecFit && (
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">{wm.riasecFit}</p>
      )}
      {wm.contextualAdvice && (
        <div className="bg-muted rounded-xl p-4">
          <p className="text-sm text-foreground">{wm.contextualAdvice}</p>
        </div>
      )}
    </div>
  );
}

/* ── AI loading skeleton ─────────────────────────────── */
function AgentLoadingSkeleton() {
  const LOADING_MESSAGES = [
    "Analizzo il tuo profilo RIASEC…",
    "Confronto con 28 settori di mercato…",
    "Calcolo le professioni più adatte…",
    "Valuto i percorsi formativi…",
    "Preparo i tuoi insights personalizzati…",
  ];
  const [msgIndex, setMsgIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setMsgIndex(i => (i + 1) % LOADING_MESSAGES.length), 4000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-primary">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm font-medium transition-all">{LOADING_MESSAGES[msgIndex]}</span>
      </div>
      <div className="h-1 bg-primary/10 rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full animate-[grow_25s_ease-in-out_forwards]" />
      </div>
    </div>
  );
}

/* ── Dashboard main ──────────────────────────────────── */
export default function Dashboard() {
  usePageMeta({
    title: "Dashboard AI — NorthStar",
    description: "La tua analisi AI personalizzata: professioni consigliate, percorsi formativi e modalità di lavoro ottimale per il tuo profilo RIASEC.",
  });

  const { user, authReady } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (authReady && !user) navigate("/");
  }, [user, authReady, navigate]);

  const journeyType = user?.journeyType as JourneyId | null | undefined;
  const journeyMeta = journeyType ? JOURNEY_META[journeyType] : null;
  const JourneyIcon = journeyMeta?.Icon;

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

  /* ── Dashboard data (objectives, events) ────────── */
  const { data: dashData, isLoading: dashLoading } = useDashboardData();
  const objectives = dashData?.objectives ?? [];
  const objectivesProgress = dashData?.objectivesProgress ?? { done: 0, total: 0, percent: 0 };
  const upcomingEvents = dashData?.upcomingEvents ?? [];

  /* ── Objective mutations ────────────────────────── */
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

  /* ── Seed objectives if none exist ──────────────── */
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

  /* No test yet */
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

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 md:py-14 space-y-8">

      {/* ── Hero ──────────────────────────────────── */}
      <DashboardHero journeyType={journeyType} session={sessionDetail ?? null} isPremium={isPremium} />

      {/* ── Objectives ────────────────────────────── */}
      <DashboardObjectives
        objectives={objectives}
        progress={objectivesProgress}
        onToggle={toggleObjective}
        onDelete={deleteObjective}
        onCreate={createObjective}
      />

      {/* ── Strumenti unificati ───────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
            <LayoutGrid className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-xl text-foreground">I tuoi strumenti</h2>
            <p className="text-xs text-muted-foreground">
              {journeyType ? `Selezionati per il percorso: ${JOURNEY_META[journeyType]?.label}` : "Esplora e cresci nel tuo settore"}
            </p>
          </div>
        </div>
        <Tabs defaultValue="personalizzati">
          <TabsList className="mb-5">
            <TabsTrigger value="personalizzati">Per te</TabsTrigger>
            <TabsTrigger value="avanzati">Approfondisci</TabsTrigger>
          </TabsList>
          <TabsContent value="personalizzati">
            <JourneyToolsSection journeyType={journeyType} sessionId={sessionId} sectorId={topSectorId} />
          </TabsContent>
          <TabsContent value="avanzati">
            {sessionId ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { href: `${BASE}wiki/${topSectorId ?? ""}`,    icon: MessageSquare, title: "Guida AI",          desc: "Chiedi tutto sul tuo settore" },
                  { href: `${BASE}roadmap/${topSectorId ?? ""}`, icon: Map,           title: "Piano di crescita", desc: "Percorso formativo personalizzato" },
                  { href: `/grafo`,                              icon: Network,       title: "Mappa delle conoscenze", desc: "Note, competenze e documenti collegati" },
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

      {/* ── Sezione personalizzata per persona ─────── */}
      {journeyType === "indeciso" && sessionDetail && (
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <BrainCircuit className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-xl text-foreground">Il tuo profilo</h2>
              <p className="text-xs text-muted-foreground">Scopri le tue inclinazioni professionali</p>
            </div>
            {sessionId && (
              <Link href={`/risultati/${sessionId}`} className="ml-auto">
                <div className="inline-flex items-center gap-1.5 text-sm text-primary font-semibold hover:gap-2 transition-all">
                  Dettaglio <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            )}
          </div>
          <DashboardPersonality
            riasecScores={sessionDetail.riasecScores}
            spiritScores={sessionDetail.spiritScores}
            primaryTypes={sessionDetail.primaryTypes}
          />
        </section>
      )}

      {journeyType === "dipendente" && (
        <section>
          <DashboardCareerPipeline />
        </section>
      )}

      {journeyType === "autonomo" && (
        <section>
          <DashboardIdeaValidator userId={user.id} />
        </section>
      )}

      {journeyType === "azienda" && (
        <section>
          <DashboardCandidateSearch />
        </section>
      )}

      {journeyType === "investitore" && (
        <section>
          <DashboardMarketInsights />
        </section>
      )}

      {/* ── AI Analysis ───────────────────────────── */}
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

            {/* Professions */}
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

            {/* Work mode */}
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

            {/* Education paths */}
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

      {/* ── Calendar widget ────────────────────────── */}
      <DashboardCalendar events={upcomingEvents} />

      {/* ── Growth articles ────────────────────────── */}
      <DashboardGrowth />

      {/* ── Bottom actions ──────────────────────────── */}
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

