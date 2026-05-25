import type { WorkPreference } from "@/components/WorkModeSelector";
import { WorkModeSelector, useWorkPreference } from "@/components/WorkModeSelector";
import { CareerChat } from "@/components/ai/CareerChat";
import { PersonalityInsightCard } from "@/components/ai/PersonalityInsightCard";
import { ResultsSkeleton } from "@/components/skeletons/ResultsSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { RecommendationsSection } from "@/features/results/RecommendationsSection";
import { PostTestWizardControls, PremiumUpgradeCta, StatsFooter } from "@/features/results/ResultsFooter";
import { RIASEC_SUGGESTED_WORK_MODE, SPIRIT_META, SpiritBar, SpiritRadarChart, type Rec } from "@/features/results/resultsComponents";
import { useAgentAnalysis } from "@/hooks/useAgentAnalysis";
import { useWendyPageContext } from "@/hooks/useWendyPageContext";
import { getJson } from "@/lib/apiClient";
import { useReducedMotion } from "@/lib/motion";
import { usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { getGetTestSessionQueryKey, useConfirmSector, useGetStatsSummary, useGetTestSession } from "@workspace/api-client-react";
import { AlertTriangle, ArrowRight, Bot, CheckCircle2, Crown, DollarSign, GraduationCap, Loader2, Lock, Sparkles, Star, TrendingUp, UserCheck, Zap } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

export default function Results() {
  useWendyPageContext({ page: 'risultati', title: 'Risultati Test' });
  const { t } = useTranslation();
  const prefersReduced = useReducedMotion();
  usePageMeta({
    title: t("seo.test.title"),
    description: t("seo.test.description"),
    noIndex: true,
  });
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: session, isLoading, error } = useGetTestSession(id, {
    query: { queryKey: getGetTestSessionQueryKey(id), enabled: !!id }
  });

  const { data: stats } = useGetStatsSummary();
  const confirmSector = useConfirmSector();
  const queryClient = useQueryClient();

  const { workPreference, save: saveWorkPreference, isLoading: isSavingWorkPref } = useWorkPreference(user?.id);
  const [workModeConfirmed, setWorkModeConfirmed] = useState(false);
  const [anonymousWorkMode, setAnonymousWorkMode] = useState<WorkPreference | null>(null);
  const [overriddenRecs, setOverriddenRecs] = useState<typeof session | null>(null);
  const [showWizard, setShowWizard] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("onboarding") === "1";
    }
    return false;
  });

  // Effective session merges server data with any anonymous work-mode re-rank
  const effectiveSession = overriddenRecs ?? session;

  const handleConfirm = (sectorId: number) => {
    confirmSector.mutate({ id, data: { sectorId } }, {
      onSuccess: () => {
        if (user) {
          setLocation("/");
        } else {
          const wm = anonymousWorkMode ?? "unknown";
          setLocation(`/registra?session=${id}&sector=${sectorId}&work_mode=${wm}`);
        }
      },
    });
  };

  const handleInlineWorkModeSelect = async (mode: WorkPreference) => {
    if (user) {
      await saveWorkPreference(mode);
      await queryClient.refetchQueries({ queryKey: getGetTestSessionQueryKey(id) });
    } else {
      // For anonymous users: re-fetch session with work_mode override to re-rank recommendations
      setAnonymousWorkMode(mode);
      try {
        const data = await getJson<typeof session>(`${BASE}api/test-sessions/${id}?work_mode=${mode}`);
        setOverriddenRecs(data);
      } catch {
        // non-critical - keep current rankings if fetch fails
      }
    }
    setWorkModeConfirmed(true);
  };

  // useAgentAnalysis deve stare prima di tutti i return condizionali (Rules of Hooks)
  const sessionWithSpirit = session as { spiritScores?: Record<string, number> | undefined };
  const { data: agentData, isLoading: agentLoading, isError: agentError } = useAgentAnalysis({
    sessionId: Number(id),
    riasecScores: session?.riasecScores as Record<string, number> | undefined,
    primaryTypes: session?.primaryTypes as string[] | undefined,
    spiritScores: sessionWithSpirit.spiritScores,
    topSectors: ((session?.recommendations as Rec[] | undefined) ?? [])
      .map((r: Rec) => ({ sectorName: r.sector?.name ?? "" }))
      .filter((r: { sectorName: string }) => r.sectorName),
    enabled: !!user,
  });
  const riasecScoresForAI = session?.riasecScores as Record<string, number> | undefined;

  if (isLoading) {
    return <ResultsSkeleton />;
  }

  if (error || !session) {
    return (
      <div className="container mx-auto px-4 py-24 text-center max-w-lg">
        <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-6 opacity-80" />
        <h2 className="text-3xl font-serif font-bold mb-4">{t("results.sessionNotFound")}</h2>
        <p className="text-muted-foreground mb-8">{t("results.sessionNotFoundDesc")}</p>
        <Button asChild><Link href="/test">{t("results.retakeTest")}</Link></Button>
      </div>
    );
  }

  type SessionExt = typeof session & {
    spiritScores?: Record<string, number> | null;
    dominantSpirit?: string | null;
    spiritInsight?: string | null;
    suggestedWorkMode?: WorkPreference | null;
  };
  const s = session as SessionExt;

  const primaryTypes = s.primaryTypes as string[];
  const primaryProfile = primaryTypes.join(" + ");
  const spiritScores = s.spiritScores;
  const dominantSpirit = s.dominantSpirit;
  const spiritInsight = s.spiritInsight;
  const hasSpiritData = spiritScores && Object.keys(spiritScores).length > 0;
  const dominantMeta = dominantSpirit ? SPIRIT_META[dominantSpirit] : null;

  const suggestedWorkMode: WorkPreference =
    s.suggestedWorkMode ?? (RIASEC_SUGGESTED_WORK_MODE[primaryTypes[0] ?? ""] ?? "ibrido");
  const suggestedLabel = t(`results.workModes.${suggestedWorkMode}`);

  const agentProfessions = agentData?.data?.summary?.professions ?? [];
  const agentEducation = agentData?.data?.summary?.educationPaths ?? [];
  const agentWorkMode = agentData?.data?.summary?.workMode;
  const isPremiumAgent = agentData?.plan === "premium";

  return (
    <>
    <div className="container mx-auto px-4 py-12 md:py-20 max-w-6xl">

      {/* Saved banner - shown when logged in */}
      {user && (
        <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl px-5 py-3 mb-8 animate-in slide-in-from-top-2 fade-in duration-500">
          <UserCheck className="w-5 h-5 shrink-0 text-emerald-400" />
          <p className="text-sm font-medium">
            {t("results.savedBanner", { name: user.name })}
          </p>
        </div>
      )}

      {/* Profile Header */}
      <div className="text-center mb-12 max-w-3xl mx-auto animate-in slide-in-from-bottom-4 fade-in duration-700">
        <Badge variant="outline" className="mb-6 border-primary/20 text-primary bg-primary/5 px-4 py-1 text-sm rounded-full">
          {t("results.riasecProfile")}
        </Badge>
        <h1 className="text-4xl md:text-6xl font-serif font-bold mb-6 capitalize text-foreground">
          {primaryProfile}
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
          {session.profileSummary}
        </p>
      </div>

      {/* AI Personality Insight Card */}
      {user && (
        <PersonalityInsightCard
          riasecScores={riasecScoresForAI ?? null}
          spiritScores={spiritScores as Record<string, number> | undefined}
          primaryTypes={session.primaryTypes as string[]}
          isPremium={isPremiumAgent}
        />
      )}

      {/* Bussola Interiore - Spirit Panel */}
      {hasSpiritData && (
        <div className="mb-14 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
          <div className="bg-gradient-to-br from-primary/5 via-background to-primary/5 border border-primary/15 rounded-3xl p-6 md:p-8">

            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-serif text-xl font-bold text-foreground">{t("results.innerCompass")}</h2>
                <p className="text-sm text-muted-foreground">{t("results.fiveSpirits")}</p>
              </div>
              {dominantMeta && (
                <div className={cn("ml-auto flex items-center gap-2 border rounded-full px-4 py-1.5 text-sm font-semibold", dominantMeta.color)}>
                  <span>{dominantMeta.emoji}</span>
                  {t(`results.spirits.${dominantSpirit}`, { defaultValue: dominantMeta.label })} {t("results.dominantSpirit")}
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div className="flex flex-col items-center justify-center bg-background/40 rounded-2xl border border-primary/10 py-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                  {t("results.innerCompass")}
                </p>
                <SpiritRadarChart spiritScores={spiritScores!} />
              </div>
              {spiritInsight && (
                <div className="flex flex-col justify-center bg-background/60 rounded-2xl p-6 border border-primary/10">
                  <div className="text-2xl mb-3">{dominantMeta?.emoji ?? "*"}</div>
                  <h3 className="font-semibold text-foreground mb-2 text-sm uppercase tracking-wide">
                    {t("results.innerCompass")}
                  </h3>
                  <p className="text-foreground leading-relaxed">{spiritInsight}</p>
                </div>
              )}
            </div>

            <div className="bg-background/40 rounded-2xl border border-primary/10 p-5 space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                {t("results.fiveSpirits")}
              </p>
              {(["shen", "hun", "po", "yi", "zhi"] as const).map((key) => {
                const score = spiritScores![key];
                if (score == null) return null;
                return <SpiritBar key={key} spirit={key} score={score} />;
              })}
            </div>
          </div>
        </div>
      )}

      <Separator className="mb-12" />

      {/* Work Mode Step - shown inline BEFORE sector confirmation for all users */}
      {(!workModeConfirmed && (!user || workPreference === "unknown")) && (
        <div className="mb-12 bg-gradient-to-br from-primary/3 via-background to-primary/3 border border-primary/15 rounded-3xl p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <WorkModeSelector
            suggestedMode={suggestedWorkMode}
            suggestedLabel={suggestedLabel}
            onSelect={handleInlineWorkModeSelect}
            isPending={isSavingWorkPref}
          />
        </div>
      )}

      <RecommendationsSection
        anonymousWorkMode={anonymousWorkMode}
        confirmSector={confirmSector}
        effectiveSession={effectiveSession}
        handleConfirm={handleConfirm}
        prefersReduced={prefersReduced}
        session={session}
        t={t}
        user={user}
        workPreference={workPreference}
      />

      {/* Journey Type Next Step */}
      {user?.journeyType && user.journeyType !== "indeciso" && (() => {
        const topSectorId = (effectiveSession?.recommendations as Rec[])?.[0]?.sectorId ?? null;
        const jt = user.journeyType as string;
        const NEXT_STEP_CONFIG: Record<string, { emoji: string; title: string; desc: string; cta: string; href: string }> = {
          dipendente: {
            emoji: "ðŸ’¼",
            title: "Trova offerte nel tuo settore",
            desc: "Esplora le posizioni aperte che corrispondono al tuo profilo RIASEC e al settore scelto.",
            cta: "Vai alle Offerte",
            href: "/lavori",
          },
          autonomo: {
            emoji: "ðŸš€",
            title: "Parla con Wendy",
            desc: "Chiedi a Wendy di analizzare il potenziale della tua idea di business.",
            cta: "Chiedi a Wendy",
            href: "#wendy",
          },
          azienda: {
            emoji: "ðŸ“Š",
            title: "Analisi del settore per la tua azienda",
            desc: "Approfondisci crescita, trend e opportunita del settore con i dati di mercato.",
            cta: "Analisi settore",
            href: topSectorId ? `/settore/${topSectorId}` : "/settori",
          },
          investitore: {
            emoji: "ðŸ“ˆ",
            title: "Opportunita d'investimento nel settore",
            desc: "Analizza rischio automazione, crescita e prospettive del settore con gli occhi dell'investitore.",
            cta: "Vedi trend",
            href: topSectorId ? `/settore/${topSectorId}` : "/settori",
          },
        };
        const cfg = NEXT_STEP_CONFIG[jt];
        if (!cfg) return null;
        return (
          <div className="mt-10 mb-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/3 p-5 md:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center text-2xl shrink-0">
                {cfg.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
                  Prossimo passo consigliato
                </div>
                <h3 className="font-semibold text-foreground text-base leading-snug">{cfg.title}</h3>
                <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{cfg.desc}</p>
              </div>
              <Button asChild className="rounded-xl shrink-0">
                <Link href={cfg.href}>
                  {cfg.cta} <ArrowRight className="w-4 h-4 ml-1.5" />
                </Link>
              </Button>
            </div>
          </div>
        );
      })()}

      {/* AI Analysis Section */}
      <div className="mt-16">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-serif text-2xl font-bold text-foreground">{t("results.aiSection.title")}</h2>
            <p className="text-sm text-muted-foreground">
              {!user
                ? t("results.aiSection.loginDesc")
                : agentLoading
                  ? t("results.aiSection.loadingDesc")
                  : agentData
                    ? isPremiumAgent
                      ? t("results.aiSection.planPremium", { count: agentProfessions.length })
                      : t("results.aiSection.planFree", { count: agentProfessions.length })
                    : t("results.aiSection.genericDesc")}
            </p>
          </div>
          {isPremiumAgent && (
            <div className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1">
              <Crown className="w-3 h-3" /> Premium
            </div>
          )}
        </div>

        {!user && (
          <div className="rounded-3xl border border-dashed p-8 text-center">
            <Bot className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="font-serif text-xl font-bold mb-2">{t("results.aiSection.loginTitle")}</h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-lg mx-auto">
              {t("results.aiSection.loginBody")}
            </p>
            <Button asChild size="sm" className="rounded-full">
              <Link href="/registra"><Sparkles className="w-3.5 h-3.5 mr-1.5" />{t("results.aiSection.loginBtn")}</Link>
            </Button>
          </div>
        )}

        {user && agentLoading && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-primary animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium">{t("results.aiSection.loadingMsg")}</span>
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
        )}

        {user && agentError && !agentLoading && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">{t("results.aiSection.errorMsg")}</p>
          </div>
        )}

        {user && agentData && !agentLoading && (
          <div className="space-y-8">

            {/* Professions */}
            {agentProfessions.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-foreground">{t("results.aiSection.professionsTitle")}</h3>
                  {!isPremiumAgent && (
                    <span className="text-xs text-muted-foreground bg-muted rounded-full px-2.5 py-0.5 ml-1">{t("results.aiSection.freeLabel")}</span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {agentProfessions.map((p, i) => (
                    <div key={`${p.title}-${i}`} className="rounded-2xl border bg-card p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full mb-1.5 inline-block">#{i + 1}</span>
                          <h4 className="font-semibold text-foreground leading-snug">{p.title}</h4>
                          <p className="text-xs text-muted-foreground">{p.sector}</p>
                        </div>
                        {p.growthOutlook && (
                          <span className="shrink-0 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> {p.growthOutlook}
                          </span>
                        )}
                      </div>
                      {p.salaryRange && (
                        <div className="flex items-center gap-1.5 text-sm">
                          <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-medium text-foreground">{p.salaryRange}</span>
                        </div>
                      )}
                      {p.skills && p.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {p.skills.slice(0, 4).map((sk) => (
                            <span key={sk} className="text-xs bg-primary/8 text-primary rounded-full px-2.5 py-0.5 font-medium">{sk}</span>
                          ))}
                        </div>
                      )}
                      {p.riasecAlignment && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{p.riasecAlignment}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Work Mode - premium */}
            {agentWorkMode && (
              <div className="rounded-2xl border bg-card p-5 md:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center text-violet-700">
                    <Star className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{t("results.aiSection.workModeTitle")}</h3>
                    {isPremiumAgent && <span className="text-xs text-amber-400">{t("results.aiSection.premiumBadge")}</span>}
                  </div>
                  <span className="ml-auto text-sm font-semibold text-primary border border-primary/20 bg-primary/5 rounded-full px-3 py-1">
                    {agentWorkMode.recommendedLabel ?? agentWorkMode.recommended}
                  </span>
                </div>
                {agentWorkMode.riasecFit && <p className="text-sm text-muted-foreground mb-3">{agentWorkMode.riasecFit}</p>}
                {agentWorkMode.contextualAdvice && (
                  <div className="bg-muted rounded-xl p-4">
                    <p className="text-sm text-foreground">{agentWorkMode.contextualAdvice}</p>
                  </div>
                )}
              </div>
            )}

            {/* Premium upsell */}
            {!isPremiumAgent && (
              <div className="rounded-2xl border border-dashed p-5 flex items-center gap-4">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground text-sm">{t("results.aiSection.upsellTitle")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("results.aiSection.upsellDesc")}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline" className="shrink-0 rounded-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                  <Link href="/premium"><Crown className="w-3.5 h-3.5 mr-1.5" />{t("results.aiSection.upsellBtn")}</Link>
                </Button>
              </div>
            )}

            {/* Education paths - premium only */}
            {isPremiumAgent && agentEducation.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <GraduationCap className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-semibold text-foreground">{t("results.aiSection.educationTitle")}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {agentEducation.map((e, i) => (
                    <div key={`${e.path}-${i}`} className="rounded-2xl border bg-card p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <h4 className="font-semibold text-foreground">{e.path}</h4>
                          <p className="text-xs text-muted-foreground">{e.type}</p>
                        </div>
                        <div className="shrink-0 text-right space-y-0.5">
                          {e.duration && <p className="text-xs text-muted-foreground">{e.duration}</p>}
                          {e.cost && <p className="text-xs font-medium text-primary">{e.cost}</p>}
                        </div>
                      </div>
                      {e.steps?.slice(0, 3).map((step, si) => (
                        <div key={si} className="flex items-start gap-2 text-xs text-muted-foreground mb-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" /> {step}
                        </div>
                      ))}
                      {e.careerOutcomes && e.careerOutcomes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {e.careerOutcomes.slice(0, 3).map((o) => (
                            <span key={o} className="text-xs bg-muted text-muted-foreground rounded-full px-2.5 py-0.5">{o}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Link href="/dashboard">
                <div className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline">
                  {t("results.aiSection.dashboardLink")} <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* AI Career Chat */}
      {user && (
        <div className="mt-14 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-foreground">Chatta con NorthStar AI</h2>
              <p className="text-sm text-muted-foreground">Domande sul tuo profilo, carriera e opportunita</p>
            </div>
          </div>
          <CareerChat
            profile={{
              riasecScores: riasecScoresForAI,
              primaryTypes: session.primaryTypes,
              sectors: agentData?.data?.summary ? agentData.data.summary : undefined,
              dominantSpirit: spiritScores
                ? Object.entries(spiritScores as Record<string, number>).sort(([, a], [, b]) => b - a)[0]?.[0]
                : undefined,
            }}
            isPremium={isPremiumAgent}
          />
        </div>
      )}

      {/* Stats Footer */}
      <StatsFooter stats={stats} t={t} />
      <PremiumUpgradeCta t={t} />

    </div>

    <PostTestWizardControls
      effectiveSession={effectiveSession}
      id={id}
      onClose={() => setShowWizard(false)}
      onOpen={() => setShowWizard(true)}
      showWizard={showWizard}
      user={user}
    />
  </>
  );
}
