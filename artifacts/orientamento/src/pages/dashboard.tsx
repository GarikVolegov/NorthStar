import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { useAgentAnalysis } from "@/hooks/useAgentAnalysis";
import type { ProfessionResult, EducationResult, WorkModeResult } from "@/hooks/useAgentAnalysis";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { usePageMeta } from "@/lib/seo";
import {
  Bot, Briefcase, GraduationCap, TrendingUp, Zap, Crown, Lock,
  Loader2, ArrowRight, CheckCircle2, Sparkles, AlertTriangle,
  DollarSign, Clock, MessageSquare, Map, Network, Newspaper,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL || "/";

type SessionDetail = {
  id: number;
  riasecScores: Record<string, number>;
  primaryTypes: string[];
  spiritScores: Record<string, number>;
  recommendations: Array<{ sectorId: number; sectorName: string; matchScore: number; matchReason: string }>;
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
          <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
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

function WorkModePanel({ wm, isPremium }: { wm: WorkModeResult; isPremium: boolean }) {
  const colorMap: Record<string, string> = {
    dipendente: "text-blue-700 bg-blue-50 border-blue-200",
    autonomo: "text-violet-700 bg-violet-50 border-violet-200",
    ibrido: "text-emerald-700 bg-emerald-50 border-emerald-200",
  };
  const labelMap: Record<string, string> = {
    dipendente: "Dipendente",
    autonomo: "Autonomo / Freelance",
    ibrido: "Ibrido",
  };
  const color = colorMap[wm.recommended] ?? "text-primary bg-primary/10 border-primary/20";
  const label = wm.recommendedLabel ?? labelMap[wm.recommended] ?? wm.recommended;

  return (
    <div className="rounded-2xl border bg-card p-5 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-700">
          <Briefcase className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Modalità lavorativa consigliata</h3>
          {!isPremium && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 mt-0.5">
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

function AgentLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-primary animate-pulse">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm font-medium">Analisi AI in corso — potrebbe richiedere 20-30 secondi…</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border p-5 space-y-3">
            <Skeleton className="h-4 w-20 rounded-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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

  const { data: latestSession, isLoading: sessionLoading } = useLatestSession();
  const sessionId = latestSession?.sessionId ?? null;
  const { data: sessionDetail, isLoading: detailLoading } = useSessionDetail(sessionId);

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

  if (!authReady || sessionLoading) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-5xl">
        <Skeleton className="h-10 w-72 mb-3" />
        <Skeleton className="h-5 w-96 mb-12" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (!sessionId && !sessionLoading && authReady) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-2xl text-center">
        <Bot className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-60" />
        <h1 className="text-3xl font-serif font-bold mb-3">Dashboard AI</h1>
        <p className="text-muted-foreground mb-8">
          Completa il test di orientamento per sbloccare l'analisi AI personalizzata.
        </p>
        <Button asChild size="lg" className="rounded-full">
          <Link href="/test"><Sparkles className="w-4 h-4 mr-2" />Inizia il test</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 md:py-16 max-w-5xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium mb-3">
          <Bot className="w-3.5 h-3.5" /> Dashboard AI
        </div>
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-2">
          La tua analisi personalizzata
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          L'orchestratore AI elabora il tuo profilo RIASEC e suggerisce professioni, percorsi formativi
          {isPremium ? " e modalità lavorativa ottimale" : ""} specifici per te.
        </p>
        {isPremium ? (
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
            <Crown className="w-3 h-3" /> Piano Premium attivo — analisi completa
          </div>
        ) : (
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted rounded-full px-3 py-1">
            Piano gratuito — <Link href="/premium" className="text-primary font-medium hover:underline ml-1">passa a Premium per analisi completa</Link>
          </div>
        )}
      </div>

      {(agentLoading || detailLoading) && <AgentLoadingSkeleton />}

      {agentError && !agentLoading && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 flex items-start gap-4">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-destructive text-sm mb-1">Analisi non disponibile</p>
            <p className="text-sm text-muted-foreground">
              Non è stato possibile eseguire l'analisi AI. Riprova tra qualche minuto.
            </p>
          </div>
        </div>
      )}

      {agentData && !agentLoading && (
        <div className="space-y-10">

          {/* Professions */}
          {professions.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Zap className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h2 className="font-serif text-xl font-bold text-foreground">Professioni consigliate</h2>
                  <p className="text-xs text-muted-foreground">
                    {isPremium ? `${professions.length} professioni — analisi completa` : `${professions.length} professioni — piano gratuito`}
                  </p>
                </div>
                {sessionId && (
                  <Link href={`/risultati/${sessionId}`} className="ml-auto">
                    <div className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline">
                      Vedi risultati <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </Link>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {professions.map((p, i) => (
                  <ProfessionCard key={`${p.title}-${i}`} p={p} index={i} />
                ))}
              </div>
            </section>
          )}

          {/* Work Mode — premium */}
          {workMode && (
            <section>
              <WorkModePanel wm={workMode} isPremium={isPremium} />
            </section>
          )}

          {!isPremium && !workMode && (
            <section>
              <div className="rounded-2xl border border-dashed p-6 flex items-center gap-4">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground text-sm">Modalità lavorativa + Percorsi formativi</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Con Premium l'AI consiglia la modalità di lavoro ottimale e i percorsi di studio più adatti al tuo profilo.
                  </p>
                </div>
                <Button asChild size="sm" variant="outline" className="shrink-0 rounded-full border-amber-300 text-amber-700 hover:bg-amber-50">
                  <Link href="/premium"><Crown className="w-3.5 h-3.5 mr-1.5" />Sblocca</Link>
                </Button>
              </div>
            </section>
          )}

          {/* Education paths — premium */}
          {isPremium && educationPaths.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
                  <GraduationCap className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h2 className="font-serif text-xl font-bold text-foreground">Percorsi formativi</h2>
                  <p className="text-xs text-muted-foreground">Percorsi di studio consigliati per il tuo profilo</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {educationPaths.map((e, i) => (
                  <EducationCard key={`${e.path}-${i}`} e={e} />
                ))}
              </div>
            </section>
          )}

          {/* Premium Tools Hub */}
          {sessionId && (
            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--brand-light)", color: "var(--brand)" }}>
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-serif text-xl font-bold text-foreground">I tuoi strumenti</h2>
                  <p className="text-xs text-muted-foreground">Esplora, pianifica e cresci nel tuo settore</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    href: `${BASE}wiki/${latestSession?.recommendations?.[0]?.sectorId ?? ""}`,
                    icon: MessageSquare,
                    title: "Wiki AI",
                    description: "Chiedi tutto sul tuo settore a un esperto AI",
                  },
                  {
                    href: `${BASE}roadmap/${latestSession?.recommendations?.[0]?.sectorId ?? ""}`,
                    icon: Map,
                    title: "Roadmap",
                    description: "Percorsi formativi con fit score personalizzato",
                  },
                  {
                    href: `${BASE}grafo`,
                    icon: Network,
                    title: "Grafo Conoscenza",
                    description: "Note, skill e documenti collegati",
                  },
                  {
                    href: `${BASE}news`,
                    icon: Newspaper,
                    title: "News di Settore",
                    description: "Aggiornamenti live dal mondo del lavoro",
                  },
                ].map(({ href, icon: Icon, title, description }) => (
                  <Link key={title} href={href}>
                    <div className="group rounded-2xl border bg-card p-5 flex flex-col gap-3 hover:border-[var(--brand-border)] hover:shadow-md transition-all duration-200 cursor-pointer h-full">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors" style={{ background: "var(--brand-light)", color: "var(--brand)" }}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm leading-snug">{title}</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 mt-auto self-end text-muted-foreground group-hover:text-[var(--brand)] group-hover:translate-x-1 transition-all" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            {sessionId && (
              <Button asChild variant="outline" className="rounded-full">
                <Link href={`/risultati/${sessionId}`}><ArrowRight className="w-4 h-4 mr-2" />Vai ai risultati completi</Link>
              </Button>
            )}
            <Button asChild variant="ghost" className="rounded-full">
              <Link href="/">Torna alla home</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
